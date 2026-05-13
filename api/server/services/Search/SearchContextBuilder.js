/**
 * SearchContextBuilder
 * 搜索上下文构建器
 *
 * 负责:
 * 1. 判断是否需要搜索
 * 2. 执行搜索（单轮/多轮）
 * 3. 构建注入模型的上下文
 */

const { logger } = require('@librechat/data-schemas');
const { detectSearchIntent } = require('./intent');
const { searchProviderManager } = require('./providers');
const { searchCache } = require('./cache');
const { moderationService } = require('./moderation');
const { creditsService } = require('./credits');

/** 搜索模式常量 */
const SEARCH_MODES = {
  OFF: 'off',
  AUTO: 'auto',
  DEEP: 'deep',
};

/** 自动搜索配置 */
const AUTO_SEARCH_CONFIG = {
  maxResults: 5,
  maxQueries: 1,
};

/** 深度搜索配置 */
const DEEP_SEARCH_CONFIG = {
  maxResults: 12,
  maxRounds: 3,
  maxQueriesPerRound: 2,
  maxContentFetch: 3,
};

/**
 * 搜索结果结构
 * @typedef {Object} SearchResult
 * @property {string} title
 * @property {string} url
 * @property {string} snippet
 * @property {string} source
 * @property {string} [publishedDate]
 */

/**
 * 搜索结果上下文
 * @typedef {Object} SearchContext
 * @property {boolean} performed - 是否执行了搜索
 * @property {boolean} success - 搜索是否成功
 * @property {string} searchMode - 使用的搜索模式
 * @property {SearchResult[]} results - 搜索结果
 * @property {string} contextMessage - 注入模型的上下文消息
 * @property {string} [error] - 错误信息
 */

class SearchContextBuilder {
  constructor() {
    this.currentSearchContext = null;
  }

  /**
   * 判断是否需要执行搜索
   * @param {string} query - 用户查询
   * @param {string} searchMode - 搜索模式
   * @returns {boolean}
   */
  shouldSearch(query, searchMode) {
    if (searchMode === SEARCH_MODES.OFF) {
      return false;
    }

    if (searchMode === SEARCH_MODES.DEEP) {
      return true; // 深度搜索模式强制搜索
    }

    // 自动模式：根据意图判断
    const intent = detectSearchIntent(query);
    return intent.needsSearch;
  }

  /**
   * 执行搜索
   * @param {Object} params
   * @param {string} params.query - 搜索查询
   * @param {string} params.userId - 用户ID
   * @param {Object} params.user - 用户对象
   * @param {string} params.searchMode - 搜索模式
   * @param {string} params.locale - 语言
   * @returns {Promise<{success: boolean, results: SearchResult[], searchMode: string, error?: string}>}
   */
  async performSearch({ query, userId, user, searchMode, locale = 'zh-CN' }) {
    const startTime = Date.now();

    try {
      // 1. 内容审核
      const moderationResult = await moderationService.checkQuery(query, userId);
      if (!moderationResult.passed) {
        logger.warn(`[SearchContextBuilder] Query blocked by moderation for user ${userId}`);
        return {
          success: false,
          results: [],
          searchMode,
          error: moderationResult.reason,
        };
      }

      // 2. 检查缓存
      const cachedResults = searchCache.get(query);
      if (cachedResults) {
        logger.debug(`[SearchContextBuilder] Cache hit for query: ${query.substring(0, 50)}...`);
        return {
          success: true,
          results: cachedResults,
          searchMode,
          fromCache: true,
        };
      }

      // 3. 根据模式执行搜索
      let results;
      if (searchMode === SEARCH_MODES.DEEP) {
        results = await this.performDeepSearch(query, locale);
      } else {
        results = await this.performAutoSearch(query, locale);
      }

      // 4. 结果审核和排序
      results = moderationService.filterResults(results);
      results = moderationService.rankResults(results);

      // 5. 缓存结果
      if (results.length > 0) {
        searchCache.set(query, results);
      }

      const duration = Date.now() - startTime;
      logger.info(`[SearchContextBuilder] Search completed in ${duration}ms, mode: ${searchMode}, results: ${results.length}`);

      return {
        success: true,
        results,
        searchMode,
        fromCache: false,
      };
    } catch (error) {
      logger.error(`[SearchContextBuilder] Search error:`, error);
      return {
        success: false,
        results: [],
        searchMode,
        error: error.message || 'Search failed',
      };
    }
  }

  /**
   * 自动搜索（单轮）
   * @param {string} query
   * @param {string} locale
   * @returns {Promise<SearchResult[]>}
   */
  async performAutoSearch(query, locale) {
    const { maxResults } = AUTO_SEARCH_CONFIG;
    return await searchProviderManager.search(query, { maxResults, locale });
  }

  /**
   * 深度搜索（多轮）
   * @param {string} query
   * @param {string} locale
   * @returns {Promise<SearchResult[]>}
   */
  async performDeepSearch(query, locale) {
    const { maxResults, maxRounds, maxQueriesPerRound } = DEEP_SEARCH_CONFIG;
    const allResults = new Map(); // URL -> result, 用于去重
    const queriesExecuted = [];

    // 第一轮：原始查询
    const initialResults = await searchProviderManager.search(query, { maxResults, locale });
    for (const result of initialResults) {
      allResults.set(result.url, result);
    }
    queriesExecuted.push(query);

    // 后续轮次：生成扩展查询
    for (let round = 1; round < maxRounds && allResults.size < maxResults; round++) {
      // 生成扩展查询
      const extraQueries = this.generateExtraQueries(query, Array.from(allResults.values()), maxQueriesPerRound);

      for (const extraQuery of extraQueries) {
        if (queriesExecuted.includes(extraQuery)) {
          continue; // 避免重复查询
        }

        const extraResults = await searchProviderManager.search(extraQuery, { maxResults: 5, locale });
        for (const result of extraResults) {
          if (!allResults.has(result.url)) {
            allResults.set(result.url, result);
          }
        }
        queriesExecuted.push(extraQuery);

        // 达到目标数量后停止
        if (allResults.size >= maxResults) {
          break;
        }
      }
    }

    // 限制结果数量并返回
    return Array.from(allResults.values()).slice(0, maxResults);
  }

  /**
   * 生成扩展查询
   * @param {string} originalQuery - 原始查询
   * @param {SearchResult[]} results - 当前搜索结果
   * @param {number} maxQueries - 最大查询数量
   * @returns {string[]}
   */
  generateExtraQueries(originalQuery, results, maxQueries = 2) {
    const queries = [];

    // 从原始查询提取关键词
    const keywords = originalQuery.match(/[\u4e00-\u9fa5a-zA-Z0-9]+/g) || [];
    const mainKeyword = keywords.slice(0, 3).join(' ');

    // 提取结果中的实体和话题
    const topics = new Set();
    for (const result of results.slice(0, 3)) {
      const words = result.title.match(/[\u4e00-\u9fa5a-zA-Z0-9]+/g) || [];
      words.slice(0, 5).forEach((w) => topics.add(w));
    }

    // 生成不同类型的补充查询
    const suffixes = ['官网', '最新', '价格', '评测', '对比', '使用教程', '下载地址'];
    const shuffleSuffixes = this.shuffleArray(suffixes);

    for (let i = 0; i < maxQueries && i < shuffleSuffixes.length; i++) {
      const suffix = shuffleSuffixes[i];
      if (mainKeyword) {
        queries.push(`${mainKeyword} ${suffix}`);
      } else if (topics.size > 0) {
        const topicArray = Array.from(topics).slice(0, 2).join(' ');
        queries.push(`${topicArray} ${suffix}`);
      }
    }

    // 从结果 URL 中提取域名生成查询
    const domains = new Set();
    for (const result of results.slice(0, 2)) {
      try {
        const urlObj = new URL(result.url);
        const domain = urlObj.hostname.replace(/^www\./, '');
        if (domain && !domain.includes('search')) {
          domains.add(domain);
        }
      } catch {}
    }

    if (domains.size > 0 && queries.length < maxQueries) {
      queries.push(`site:${Array.from(domains)[0]} ${keywords[0] || ''}`.trim());
    }

    return queries.slice(0, maxQueries);
  }

  /**
   * 打乱数组顺序
   * @param {Array} array
   * @returns {Array}
   */
  shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * 构建搜索上下文消息
   * @param {SearchResult[]} results
   * @returns {string}
   */
  buildContextMessage(results) {
    if (!results || results.length === 0) {
      return '';
    }

    const lines = ['[联网搜索资料]', ''];
    lines.push('以下资料来自联网搜索，可能不完整。请优先基于资料回答；如果资料不足，请明确说明不确定，不要编造。');
    lines.push('');

    results.forEach((result, index) => {
      lines.push(`[${index + 1}] ${result.title}`);
      lines.push(`摘要：${result.snippet.substring(0, 300)}${result.snippet.length > 300 ? '...' : ''}`);
      lines.push(`来源：${result.url}`);
      lines.push('');
    });

    lines.push('---');
    lines.push('要求：');
    lines.push('- 用中文回答');
    lines.push('- 不要编造搜索资料中没有的信息');
    lines.push('- 涉及时效性信息时说明"根据检索结果"');
    lines.push('- 末尾输出"参考来源"，列出所有引用的编号和标题');

    return lines.join('\n');
  }

  /**
   * 完整的搜索上下文构建流程
   * @param {Object} params
   * @param {string} params.query - 用户查询
   * @param {string} params.userId - 用户ID
   * @param {Object} params.user - 用户对象
   * @param {string} params.searchMode - 搜索模式
   * @param {string} params.locale - 语言
   * @returns {Promise<SearchContext>}
   */
  async buildSearchContext({ query, userId, user, searchMode, locale = 'zh-CN' }) {
    // 判断是否需要搜索
    if (!this.shouldSearch(query, searchMode)) {
      return {
        performed: false,
        success: true,
        searchMode,
        results: [],
        contextMessage: '',
      };
    }

    // 检查用户搜索权限
    const searchType = searchMode === SEARCH_MODES.DEEP ? 'deep' : 'auto';
    const accessCheck = creditsService.checkSearchAccess(user, searchType);
    if (!accessCheck.allowed) {
      logger.warn(`[SearchContextBuilder] Search access denied for user ${userId}: ${accessCheck.reason}`);
      return {
        performed: false,
        success: false,
        searchMode,
        results: [],
        contextMessage: '',
        error: accessCheck.message,
        errorCode: accessCheck.reason,
      };
    }

    // 执行搜索
    const searchResult = await this.performSearch({
      query,
      userId,
      user,
      searchMode,
      locale,
    });

    // 构建上下文消息
    const contextMessage = this.buildContextMessage(searchResult.results);

    // 存储搜索上下文
    this.currentSearchContext = {
      performed: true,
      success: searchResult.success,
      searchMode,
      results: searchResult.results,
      contextMessage,
      error: searchResult.error,
    };

    return this.currentSearchContext;
  }

  /**
   * 获取当前搜索上下文
   * @returns {SearchContext | null}
   */
  getCurrentContext() {
    return this.currentSearchContext;
  }

  /**
   * 清除当前搜索上下文
   */
  clearContext() {
    this.currentSearchContext = null;
  }
}

// 单例实例
const searchContextBuilder = new SearchContextBuilder();

module.exports = {
  SearchContextBuilder,
  searchContextBuilder,
  SEARCH_MODES,
  AUTO_SEARCH_CONFIG,
  DEEP_SEARCH_CONFIG,
};
