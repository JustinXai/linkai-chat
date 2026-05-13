/**
 * Search Result Cache Module
 * In-memory cache for search results
 */

const { logger } = require('@librechat/data-schemas');
const { normalizeQuery } = require('./intent');

const CACHE_TTL_SECONDS = parseInt(process.env.SEARCH_CACHE_TTL_SECONDS || '86400', 10); // 24 hours
const MAX_CACHE_SIZE = parseInt(process.env.SEARCH_CACHE_MAX_SIZE || '1000', 10);

class SearchCache {
  constructor() {
    /** @type {Map<string, {data: any, expiresAt: number}>} */
    this.cache = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
    };
  }

  /**
   * Generate cache key from query
   * @param {string} query
   * @returns {string}
   */
  generateKey(query) {
    const normalized = normalizeQuery(query);
    return `search:${normalized}`;
  }

  /**
   * Get cached result
   * @param {string} query
   * @returns {any | null}
   */
  get(query) {
    const key = this.generateKey(query);

    if (!this.cache.has(key)) {
      this.stats.misses++;
      return null;
    }

    const entry = this.cache.get(key);
    const now = Date.now();

    if (entry.expiresAt < now) {
      this.cache.delete(key);
      this.stats.misses++;
      this.stats.evictions++;
      return null;
    }

    this.stats.hits++;
    logger.debug(`[SearchCache] Cache hit for query: ${query.substring(0, 50)}...`);
    return entry.data;
  }

  /**
   * Set cache entry
   * @param {string} query
   * @param {any} data
   */
  set(query, data) {
    const key = this.generateKey(query);

    // Evict oldest entries if cache is full
    if (this.cache.size >= MAX_CACHE_SIZE) {
      this.evictOldest();
    }

    const expiresAt = Date.now() + CACHE_TTL_SECONDS * 1000;
    this.cache.set(key, { data, expiresAt });

    logger.debug(`[SearchCache] Cached result for query: ${query.substring(0, 50)}...`);
  }

  /**
   * Evict oldest cache entry
   */
  evictOldest() {
    let oldestKey = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache) {
      if (entry.expiresAt < oldestTime) {
        oldestTime = entry.expiresAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.stats.evictions++;
    }
  }

  /**
   * Clear expired entries
   */
  cleanExpired() {
    const now = Date.now();
    let count = 0;

    for (const [key, entry] of this.cache) {
      if (entry.expiresAt < now) {
        this.cache.delete(key);
        count++;
      }
    }

    if (count > 0) {
      logger.info(`[SearchCache] Cleaned ${count} expired entries`);
    }

    return count;
  }

  /**
   * Clear all cache
   */
  clear() {
    const size = this.cache.size;
    this.cache.clear();
    this.stats = { hits: 0, misses: 0, evictions: 0 };
    logger.info(`[SearchCache] Cleared ${size} entries`);
  }

  /**
   * Get cache stats
   * @returns {Object}
   */
  getStats() {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      size: this.cache.size,
      hitRate: total > 0 ? (this.stats.hits / total * 100).toFixed(2) + '%' : '0%',
    };
  }
}

// Singleton instance
const searchCache = new SearchCache();

// Clean expired entries periodically (every hour)
setInterval(() => {
  searchCache.cleanExpired();
}, 60 * 60 * 1000);

module.exports = {
  SearchCache,
  searchCache,
};
