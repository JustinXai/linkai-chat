/**
 * Search Provider Index
 * Manages provider selection and fallback logic
 */

const SearXNGProvider = require('./SearXNGProvider');
const TavilyProvider = require('./TavilyProvider');

/**
 * @typedef {Object} SearchResult
 * @property {string} title
 * @property {string} url
 * @property {string} snippet
 * @property {string} source
 * @property {string} [publishedDate]
 */

class SearchProviderManager {
  constructor() {
    this.searxng = new SearXNGProvider();
    this.tavily = new TavilyProvider();
  }

  /**
   * Search with provider fallback
   * @param {string} query
   * @param {Object} options
   * @param {number} options.maxResults
   * @param {string} options.locale
   * @returns {Promise<SearchResult[]>}
   */
  async search(query, options = { maxResults: 5, locale: 'zh-CN' }) {
    const { maxResults, locale } = options;

    // Try SearXNG first
    let results = await this.searxng.search(query, { maxResults, locale });

    // Fallback to Tavily if SearXNG returns insufficient results
    if (results.length < 2 && this.tavily.isEnabled()) {
      const tavilyResults = await this.tavily.search(query, { maxResults, locale });
      results = this.mergeResults(results, tavilyResults);
    }

    return results;
  }

  /**
   * Merge results from multiple providers and deduplicate
   * @param {SearchResult[]} results1
   * @param {SearchResult[]} results2
   * @returns {SearchResult[]}
   */
  mergeResults(results1, results2) {
    const urlSet = new Set();
    const merged = [];

    for (const result of [...results1, ...results2]) {
      if (!urlSet.has(result.url)) {
        urlSet.add(result.url);
        merged.push(result);
      }
    }

    return merged;
  }

  /**
   * Check health of all providers
   * @returns {Promise<{searxng: boolean, tavily: boolean}>}
   */
  async healthCheck() {
    const searxngHealth = await this.searxng.healthCheck();
    return {
      searxng: searxngHealth,
      tavily: this.tavily.isEnabled(),
    };
  }
}

// Singleton instance
const searchProviderManager = new SearchProviderManager();

module.exports = {
  SearchProviderManager,
  searchProviderManager,
  SearXNGProvider,
  TavilyProvider,
};
