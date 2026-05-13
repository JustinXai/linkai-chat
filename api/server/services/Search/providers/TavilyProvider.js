/**
 * Tavily Search Provider
 * Fallback search provider when SearXNG returns insufficient results
 *
 * TODO: Implement actual Tavily API integration
 * - Requires TAVILY_API_KEY environment variable
 * - API endpoint: https://api.tavily.com/search
 * - Documentation: https://docs.tavily.com/docs/python-api
 */

const axios = require('axios');
const { logger } = require('@librechat/data-schemas');

const TAVILY_API_URL = 'https://api.tavily.com/search';

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

class TavilyProvider {
  constructor(apiKey = process.env.TAVILY_API_KEY) {
    this.apiKey = apiKey;
    this.enabled = !!apiKey;
  }

  /**
   * Check if Tavily provider is enabled
   * @returns {boolean}
   */
  isEnabled() {
    return this.enabled;
  }

  /**
   * Search using Tavily API
   * @param {string} query
   * @param {SearchOptions} options
   * @returns {Promise<SearchResult[]>}
   */
  async search(query, options = {}) {
    if (!this.enabled) {
      logger.warn('[TavilyProvider] Tavily API key not configured');
      return [];
    }

    const { maxResults = 5, locale = 'zh-CN' } = options;

    try {
      const response = await axios.post(
        TAVILY_API_URL,
        {
          api_key: this.apiKey,
          query,
          search_depth: 'basic',
          max_results: maxResults,
          include_answer: false,
          include_raw_content: false,
          include_images: false,
        },
        {
          timeout: 8000,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );

      const results = (response.data.results || []).slice(0, maxResults).map((item) => ({
        title: item.title || '',
        url: item.url || '',
        snippet: item.content || item.snippet || '',
        source: this.extractSource(item.url || ''),
        publishedDate: item.published_date || null,
      }));

      logger.info(`[TavilyProvider] Search "${query}" returned ${results.length} results`);
      return results;
    } catch (error) {
      logger.error(`[TavilyProvider] Search error:`, error.message);
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
}

module.exports = TavilyProvider;
