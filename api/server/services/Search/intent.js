/**
 * Search Intent Detection Module
 * Determines whether a user query requires web search based on rules.
 */

/** Keywords that indicate search is needed */
const NEED_SEARCH_PATTERNS = [
  // Time-sensitive
  /\b(最新|最近|现在|今天|今年|昨日|本周|本月)\b/,
  /20\d{2}[年./-]\d{1,2}/, // Years like 2026
  /\b\d{4}[年./-]\d{1,2}[月./-]\d{1,2}\b/, // Dates

  // Information needs
  /\b(新闻|最新消息|实时)\b/,
  /\b(价格|报价|多少钱|费用|收费)\b/,
  /\b(汇率|利率|股市|行情)\b/,
  /\b(政策|规定|公告|通知)\b/,
  /\b(发布|上线|更新|版本)\b/,
  /\b(官网|官方网站|官方网站)\b/,
  /\b(来源|出处|引用|参考)\b/,

  // Questions requiring current info
  /^(查一下|搜一下|搜索|查找)/,
  /\b(联网|联网搜索|网上搜)/,
  /\b(资料|相关信息|最新信息)/,
  /\b(是否还可用|还能用吗|停运了吗)/,
  /\b(怎么收费|如何计费|收费标准)/,
  /\b(哪个更好|哪个更强|推荐哪个)/,
  /\b(排名|排行榜|评测|对比)\b/,
  /\b(如何使用|怎么用|教程)\b/,

  // English patterns
  /\b(latest|recent|current|newest)\b/i,
  /\b(news|update|release|version)\b/i,
  /\b(price|how much|cost)\b/i,
  /\b(official|website|docs)\b/i,
  /\b(search|lookup|find)\b/i,
];

/** Keywords that indicate NO search is needed */
const NO_SEARCH_PATTERNS = [
  // Writing tasks
  /\b(翻译|润色|改写|缩写|扩写)\b/,
  /\b(总结|概括|摘要)\s*[\u4e00-\u9fa5]+/,
  /\b(写作|写文章|写代码|写报告)/,
  /\b(翻译以下|翻译成)/,

  // Code tasks
  /\b(代码|编程|写代码|调试|debug)\b.*\b(代码|编程|写代码|调试)/,
  /\b(解释代码|这段代码|代码分析)/,
  /\b(写个函数|写个方法|写个组件)/,

  // Creative tasks
  /\b(脑暴|头脑风暴|创意)\b/,
  /\b(角色扮演|扮演|模拟)\b/,
  /\b(故事|小说|诗歌|文案)/,

  // User explicitly says no search
  /不联网/,
  /不用搜索/,
  /不需要搜索/,

  // Context tasks
  /^(上面|前文|之前)提到的/,
  /继续/,
  /接着说/,
  /\b(解释一下|说明一下)/,
];

/**
 * Determines if a query likely needs web search.
 * Uses rule-based pattern matching without calling LLM.
 *
 * @param {string} query - The user's query
 * @returns {{ needsSearch: boolean, reason: string }}
 */
function detectSearchIntent(query) {
  if (!query || typeof query !== 'string') {
    return { needsSearch: false, reason: 'empty_query' };
  }

  const trimmedQuery = query.trim().toLowerCase();

  // Check NO search patterns first (higher priority for exclusion)
  for (const pattern of NO_SEARCH_PATTERNS) {
    if (pattern.test(trimmedQuery)) {
      return { needsSearch: false, reason: `matched_no_search_pattern: ${pattern.toString()}` };
    }
  }

  // Check NEED search patterns
  let matchCount = 0;
  let matchedPatterns = [];

  for (const pattern of NEED_SEARCH_PATTERNS) {
    if (pattern.test(trimmedQuery)) {
      matchCount++;
      matchedPatterns.push(pattern.toString());
    }
  }

  // Require at least one match to trigger search
  if (matchCount > 0) {
    return {
      needsSearch: true,
      reason: `matched_${matchCount}_patterns`,
      patterns: matchedPatterns,
    };
  }

  // Default: don't search
  return { needsSearch: false, reason: 'no_pattern_match' };
}

/**
 * Normalize query for cache key generation
 * @param {string} query
 * @returns {string}
 */
function normalizeQuery(query) {
  return query
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\u4e00-\u9fa5a-z0-9\s]/g, '');
}

module.exports = {
  detectSearchIntent,
  normalizeQuery,
  NEED_SEARCH_PATTERNS,
  NO_SEARCH_PATTERNS,
};
