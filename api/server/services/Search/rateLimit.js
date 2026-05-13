/**
 * Search Rate Limiting Module
 * User-level rate limiting for search features
 */

const { logger } = require('@librechat/data-schemas');

// Default limits (can be overridden by user subscription level)
const DEFAULT_LIMITS = {
  free: {
    autoSearch: parseInt(process.env.FREE_AUTO_SEARCH_DAILY_LIMIT || '20', 10),
    deepSearch: parseInt(process.env.FREE_DEEP_SEARCH_DAILY_LIMIT || '0', 10),
  },
  default: {
    autoSearch: parseInt(process.env.DEFAULT_AUTO_SEARCH_DAILY_LIMIT || '100', 10),
    deepSearch: parseInt(process.env.DEFAULT_DEEP_SEARCH_DAILY_LIMIT || '5', 10),
  },
  pro: {
    autoSearch: 300,
    deepSearch: 20,
  },
};

class SearchRateLimiter {
  constructor() {
    /** @type {Map<string, {autoSearch: {count: number, resetAt: number}, deepSearch: {count: number, resetAt: number}}>} */
    this.userLimits = new Map();
  }

  /**
   * Get or create user limit entry
   * @param {string} userId
   * @returns {Object}
   */
  getUserEntry(userId) {
    if (!this.userLimits.has(userId)) {
      const now = Date.now();
      const resetAt = this.getResetTime();

      this.userLimits.set(userId, {
        autoSearch: { count: 0, resetAt },
        deepSearch: { count: 0, resetAt },
      });
    }

    const entry = this.userLimits.get(userId);
    const now = Date.now();

    // Reset if past reset time
    if (now > entry.autoSearch.resetAt) {
      entry.autoSearch = { count: 0, resetAt: this.getResetTime() };
    }
    if (now > entry.deepSearch.resetAt) {
      entry.deepSearch = { count: 0, resetAt: this.getResetTime() };
    }

    return entry;
  }

  /**
   * Get reset time (midnight UTC)
   * @returns {number}
   */
  getResetTime() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(0, 0, 0, 0);
    return tomorrow.getTime();
  }

  /**
   * Check if user can perform search
   * @param {string} userId
   * @param {'autoSearch' | 'deepSearch'} searchType
   * @param {string} userLevel - 'free' | 'default' | 'pro'
   * @returns {{allowed: boolean, remaining: number, resetAt: number, limit: number}}
   */
  checkLimit(userId, searchType, userLevel = 'default') {
    const entry = this.getUserEntry(userId);
    const limits = DEFAULT_LIMITS[userLevel] || DEFAULT_LIMITS.default;
    const limit = limits[searchType];

    if (limit === 0) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: entry[searchType].resetAt,
        limit: 0,
        reason: 'not_available_for_tier',
      };
    }

    const current = entry[searchType].count;

    if (current >= limit) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: entry[searchType].resetAt,
        limit,
        reason: 'daily_limit_exceeded',
      };
    }

    return {
      allowed: true,
      remaining: limit - current,
      resetAt: entry[searchType].resetAt,
      limit,
    };
  }

  /**
   * Increment search count
   * @param {string} userId
   * @param {'autoSearch' | 'deepSearch'} searchType
   */
  incrementCount(userId, searchType) {
    const entry = this.getUserEntry(userId);
    entry[searchType].count++;
    logger.debug(`[SearchRateLimiter] User ${userId} used ${searchType}, count: ${entry[searchType].count}`);
  }

  /**
   * Get user's current usage
   * @param {string} userId
   * @param {string} userLevel
   * @returns {Object}
   */
  getUsage(userId, userLevel = 'default') {
    const entry = this.getUserEntry(userId);
    const limits = DEFAULT_LIMITS[userLevel] || DEFAULT_LIMITS.default;

    return {
      autoSearch: {
        used: entry.autoSearch.count,
        limit: limits.autoSearch,
        remaining: Math.max(0, limits.autoSearch - entry.autoSearch.count),
        resetAt: entry.autoSearch.resetAt,
      },
      deepSearch: {
        used: entry.deepSearch.count,
        limit: limits.deepSearch,
        remaining: Math.max(0, limits.deepSearch - entry.deepSearch.count),
        resetAt: entry.deepSearch.resetAt,
      },
    };
  }

  /**
   * Reset user's limits (admin function)
   * @param {string} userId
   */
  resetUser(userId) {
    if (this.userLimits.has(userId)) {
      this.userLimits.delete(userId);
      logger.info(`[SearchRateLimiter] Reset limits for user ${userId}`);
    }
  }

  /**
   * Clear all limits (for testing)
   */
  clearAll() {
    this.userLimits.clear();
    logger.info('[SearchRateLimiter] Cleared all user limits');
  }

  /**
   * Get default limits configuration (without exposing to client)
   * @returns {Object}
   */
  getConfig() {
    return {
      free: DEFAULT_LIMITS.free,
      default: DEFAULT_LIMITS.default,
      pro: DEFAULT_LIMITS.pro,
    };
  }
}

// Singleton instance
const searchRateLimiter = new SearchRateLimiter();

module.exports = {
  SearchRateLimiter,
  searchRateLimiter,
  DEFAULT_LIMITS,
};
