/**
 * Content Moderation Module
 * Three-layer content safety filtering for search
 */

const { logger } = require('@librechat/data-schemas');

// Blocked domains (can be moved to config in future)
const BLOCKED_DOMAINS = [
  'spam-site.com',
  'malware-example.com',
  // Add more as needed - this is a placeholder
];

// Blocked keywords for query filtering
const BLOCKED_KEYWORDS = [
  // This is a minimal set for demonstration
  // In production, this would come from a config file or database
  // DO NOT expose full list to frontend
];

// Low-quality source patterns (for result filtering)
const LOW_QUALITY_PATTERNS = [
  /forum/i,
  /bbs/i,
  /blogspot\.com/i,
  /wordpress\.com/i,
  /tieba\.baidu\.com/i,
  /douban\.com\/group/i,
];

// High-quality source patterns (for ranking)
const HIGH_QUALITY_PATTERNS = [
  /\.gov\.cn$/i,
  /\.edu\.cn$/i,
  /\.gov$/i,
  /\.edu$/i,
  /zhihu\.com$/i,
  /stackoverflow\.com$/i,
  /github\.com$/i,
  /juejin\.cn$/i,
  /36kr\.com$/i,
  /ifanr\.com$/i,
  /theverge\.com$/i,
  /techcrunch\.com$/i,
];

/**
 * @typedef {Object} ModerationResult
 * @property {boolean} passed
 * @property {string} reason
 * @property {'low' | 'medium' | 'high'} riskLevel
 */

// TODO: Extend with actual moderation API integration
const MODERATION_API_CONFIG = {
  enabled: false,
  apiKey: process.env.MODERATION_API_KEY || '',
  endpoint: process.env.MODERATION_API_ENDPOINT || '',
};

class ModerationService {
  constructor() {
    this.blockedDomains = new Set(BLOCKED_DOMAINS);
    this.blockedKeywords = BLOCKED_KEYWORDS;
  }

  /**
   * Layer 1: Input moderation - check user query before processing
   * @param {string} query
   * @param {string} userId
   * @returns {Promise<ModerationResult>}
   */
  async checkInput(query, userId) {
    if (!query || typeof query !== 'string') {
      return { passed: false, reason: 'empty_query', riskLevel: 'low' };
    }

    const trimmed = query.trim();

    // Check blocked keywords
    for (const keyword of this.blockedKeywords) {
      if (trimmed.toLowerCase().includes(keyword.toLowerCase())) {
        await this.logViolation(userId, query, 'blocked_keyword', 'high');
        return {
          passed: false,
          reason: '这个问题可能涉及不适合生成的内容，请换一种问法。',
          riskLevel: 'high',
        };
      }
    }

    // TODO: Call external moderation API if enabled
    if (MODERATION_API_CONFIG.enabled && MODERATION_API_CONFIG.apiKey) {
      const apiResult = await this.callModerationAPI(trimmed);
      if (!apiResult.passed) {
        await this.logViolation(userId, query, 'api_rejection', apiResult.riskLevel);
        return {
          passed: false,
          reason: '这个问题可能涉及不适合生成的内容，请换一种问法。',
          riskLevel: apiResult.riskLevel,
        };
      }
    }

    return { passed: true, reason: 'ok', riskLevel: 'low' };
  }

  /**
   * Layer 2: Query moderation - check query before sending to search
   * @param {string} query
   * @param {string} userId
   * @returns {Promise<ModerationResult>}
   */
  async checkQuery(query, userId) {
    if (!query || typeof query !== 'string') {
      return { passed: false, reason: 'empty_query', riskLevel: 'low' };
    }

    const trimmed = query.trim();

    // Additional query-specific checks
    for (const keyword of this.blockedKeywords) {
      if (trimmed.toLowerCase().includes(keyword.toLowerCase())) {
        await this.logViolation(userId, query, 'query_blocked_keyword', 'high');
        return {
          passed: false,
          reason: '无法搜索该内容，请换一种问法。',
          riskLevel: 'high',
        };
      }
    }

    // Query length check
    if (trimmed.length > 500) {
      return {
        passed: false,
        reason: '搜索内容过长，请精简后重试。',
        riskLevel: 'medium',
      };
    }

    return { passed: true, reason: 'ok', riskLevel: 'low' };
  }

  /**
   * Layer 3: Results moderation - filter search results
   * @param {Array<{title: string, url: string, snippet: string, source: string}>} results
   * @returns {Array<{title: string, url: string, snippet: string, source: string}>}
   */
  filterResults(results) {
    if (!Array.isArray(results)) {
      return [];
    }

    return results.filter((result) => {
      // Check blocked domains
      for (const domain of this.blockedDomains) {
        if (result.url && result.url.includes(domain)) {
          logger.debug(`[Moderation] Filtered result from blocked domain: ${domain}`);
          return false;
        }
      }

      // Check for low-quality sources
      for (const pattern of LOW_QUALITY_PATTERNS) {
        if (pattern.test(result.url || '')) {
          logger.debug(`[Moderation] Marked as low-quality: ${result.url}`);
          // Don't filter out completely, but mark for lower ranking
        }
      }

      return true;
    });
  }

  /**
   * Rank results by quality
   * @param {Array<{title: string, url: string, snippet: string, source: string}>} results
   * @returns {Array<{title: string, url: string, snippet: string, source: string, quality: number}>}
   */
  rankResults(results) {
    const scored = results.map((result) => {
      let quality = 50; // Base quality score

      // Boost high-quality sources
      for (const pattern of HIGH_QUALITY_PATTERNS) {
        if (pattern.test(result.url || '')) {
          quality += 30;
          break;
        }
      }

      // Lower score for low-quality sources
      for (const pattern of LOW_QUALITY_PATTERNS) {
        if (pattern.test(result.url || '')) {
          quality -= 20;
          break;
        }
      }

      // Ensure quality is within bounds
      quality = Math.max(0, Math.min(100, quality));

      return { ...result, quality };
    });

    // Sort by quality (descending)
    return scored.sort((a, b) => b.quality - a.quality);
  }

  /**
   * Call external moderation API
   * @param {string} text
   * @returns {Promise<{passed: boolean, riskLevel: string}>}
   */
  async callModerationAPI(text) {
    // TODO: Implement actual API call
    // This is a placeholder for future integration
    logger.debug(`[Moderation] Would call API for: ${text.substring(0, 50)}...`);
    return { passed: true, riskLevel: 'low' };
  }

  /**
   * Log moderation violations
   * @param {string} userId
   * @param {string} query
   * @param {string} reason
   * @param {string} riskLevel
   */
  async logViolation(userId, query, reason, riskLevel) {
    const logEntry = {
      userId,
      query: query.substring(0, 200),
      reason,
      riskLevel,
      timestamp: new Date().toISOString(),
    };

    // TODO: Persist to database
    logger.warn('[Moderation] Violation logged:', logEntry);

    // Could also send to external logging service
    // await this.sendToLoggingService(logEntry);
  }

  /**
   * Get moderation stats (for admin)
   * @returns {Object}
   */
  getStats() {
    // TODO: Return actual stats from database
    return {
      totalChecked: 0,
      violations: 0,
      blocked: 0,
    };
  }
}

// Singleton instance
const moderationService = new ModerationService();

module.exports = {
  ModerationService,
  moderationService,
  BLOCKED_DOMAINS,
  BLOCKED_KEYWORDS,
  HIGH_QUALITY_PATTERNS,
  LOW_QUALITY_PATTERNS,
};
