/**
 * SearXNG Search Provider
 * Uses SearXNG instance for web search
 */

const axios = require('axios');
const { logger } = require('@librechat/data-schemas');

const SEARXNG_DEFAULT_URL = process.env.SEARXNG_INSTANCE_URL || 'http://127.0.0.1:8888';
const SEARXNG_TIMEOUT = parseInt(process.env.SEARCH_TIMEOUT_MS || '8000', 10);

/**
 * @typedef {Object} SearchResult
 * @property {string} title
 * @property {string} url
 * @property {string} snippet
 * @property {string} source
 * @property {string} [publishedDate]
 */

/**
 * @typedef {Object} SearchOptions
 * @property {number} maxResults
 * @property {string} locale
 */

class SearXNGProvider {
  constructor(baseURL = SEARXNG_DEFAULT_URL) {
    this.baseURL = baseURL.replace(/\/$/, '');
    this.timeout = SEARXNG_TIMEOUT;
  }

  /**
   * Search using SearXNG
   * @param {string} query
   * @param {SearchOptions} options
   * @returns {Promise<SearchResult[]>}
   */
  async search(query, options = {}) {
    const { maxResults = 5, locale = 'zh-CN' } = options;

    try {
      const response = await axios.get(`${this.baseURL}/search`, {
        params: {
          q: query,
          format: 'json',
          language: locale,
          engines: 'google,bing,duckduckgo',
          pageno: 1,
        },
        timeout: this.timeout,
        headers: {
          'User-Agent': 'Link-AI-Chat/1.0',
        },
      });

      const results = response.data.results || [];
      const processed = results.slice(0, maxResults).map((item, index) => ({
        title: item.title || `Result ${index + 1}`,
        url: item.url || item.links?.[0] || '',
        snippet: item.content || item.teaser || '',
        source: this.extractSource(item.url || ''),
        publishedDate: item.publishedDate || null,
      }));

      logger.info(`[SearXNGProvider] Search "${query}" returned ${processed.length} results`);
      return processed;
    } catch (error) {
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        logger.warn(`[SearXNGProvider] Cannot connect to SearXNG at ${this.baseURL}`);
      } else if (error.code === 'ETIMEDOUT') {
        logger.warn(`[SearXNGProvider] SearXNG search timed out for query "${query}"`);
      } else {
        logger.error(`[SearXNGProvider] Search error:`, error.message);
      }
      return [];
    }
  }

  /**
   * Extract domain/source from URL
   * @param {string} url
   * @returns {string}
   */
  extractSource(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace(/^www\./, '');
    } catch {
      return '';
    }
  }

  /**
   * Check if the SearXNG instance is available
   * @returns {Promise<boolean>}
   */
  async healthCheck() {
    try {
      await axios.get(`${this.baseURL}/`, {
        timeout: 3000,
      });
      return true;
    } catch {
      return false;
    }
  }
}

module.exports = SearXNGProvider;
