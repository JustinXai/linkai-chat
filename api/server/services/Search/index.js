/**
 * Search Service Index
 * 搜索服务统一导出
 */

const { detectSearchIntent, normalizeQuery } = require('./intent');
const { searchProviderManager } = require('./providers');
const { searchCache } = require('./cache');
const { searchRateLimiter } = require('./rateLimit');
const { moderationService } = require('./moderation');
const {
  creditsService,
  calculateCredits,
  getDailyLimits,
  CREDIT_COSTS,
  DAILY_LIMITS,
  ADVANCED_MODELS,
} = require('./credits');
const { SearchContextBuilder, searchContextBuilder, SEARCH_MODES } = require('./SearchContextBuilder');

/**
 * 执行搜索并返回上下文消息
 * @param {Object} params
 * @param {string} params.query - 搜索查询
 * @param {string} params.userId - 用户 ID
 * @param {Object} params.user - 用户对象
 * @param {'off' | 'auto' | 'deep'} params.searchMode - 搜索模式
 * @param {string} params.locale - 语言
 * @returns {Promise<Object>} 包含 performed, success, results, contextMessage, error
 */
async function performSearchWithContext({ query, userId, user, searchMode = 'off', locale = 'zh-CN' }) {
  return await searchContextBuilder.buildSearchContext({
    query,
    userId,
    user,
    searchMode,
    locale,
  });
}

/**
 * 判断是否需要搜索
 * @param {string} query - 用户查询
 * @param {string} searchMode - 搜索模式
 * @returns {boolean}
 */
function shouldPerformSearch(query, searchMode) {
  return searchContextBuilder.shouldSearch(query, searchMode);
}

/**
 * 注入搜索结果到模型上下文（兼容旧接口）
 * @param {Array} searchResults
 * @returns {string}
 */
function buildSearchContext(searchResults) {
  return searchContextBuilder.buildContextMessage(searchResults);
}

module.exports = {
  // 搜索执行
  performSearchWithContext,
  shouldPerformSearch,
  buildSearchContext,

  // SearchContextBuilder
  SearchContextBuilder,
  searchContextBuilder,
  SEARCH_MODES,

  // 工具函数
  detectSearchIntent,
  normalizeQuery,

  // Provider
  searchProviderManager,

  // 缓存
  searchCache,

  // 限流
  searchRateLimiter,

  // 审核
  moderationService,

  // Credits
  creditsService,
  calculateCredits,
  getDailyLimits,
  CREDIT_COSTS,
  DAILY_LIMITS,
  ADVANCED_MODELS,
};
