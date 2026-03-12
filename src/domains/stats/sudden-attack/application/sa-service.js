import { buildSeasonViews } from './season-view-builder.js';
import { loadPlayerProfileContext } from './player-profile-loader.js';

/**
 * Sudden Attack Application Service (Application Layer)
 * Coordinates user requests and domain operations using a repository.
 */
export class SaService {
  constructor(repository, crewRepository = null) {
    this.repository = repository;
    this.crewRepository = crewRepository;
    this.CACHE_PREFIX = 'sa_cache_';
    this.CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds
  }

  /**
   * Search and load full player profile with SWR Caching
   * @param {string} characterName 
   * @param {Array} currentRankings 
   * @param {Function} onUpdate Callback for background fresh data update
   */
  async getFullPlayerProfile(characterName, currentRankings = [], onUpdate = null) {
    const cacheKey = `${this.CACHE_PREFIX}${characterName.toLowerCase()}`;
    const cached = this.getCache(cacheKey);

    // 1. If cache exists, return it immediately and trigger background update
    if (cached) {
      console.log(`[SaService] Cache hit for ${characterName}. Returning stale data.`);
      
      // Background revalidation
      this.fetchFreshData(characterName, currentRankings).then(freshData => {
        if (onUpdate && JSON.stringify(freshData) !== JSON.stringify(cached.data)) {
          console.log(`[SaService] Background update ready for ${characterName}.`);
          this.setCache(cacheKey, freshData);
          onUpdate(freshData);
        }
      }).catch(err => console.warn('[SaService] Background revalidation failed:', err));

      return { ...cached.data, isStale: true, cacheTime: cached.timestamp };
    }

    // 2. No cache, fetch from server normally
    const freshData = await this.fetchFreshData(characterName, currentRankings);
    this.setCache(cacheKey, freshData);
    return { ...freshData, isStale: false, cacheTime: Date.now() };
  }

  /**
   * Helper: Core data fetching logic (No cache logic here)
   */
  async fetchFreshData(characterName, currentRankings = []) {
    try {
      const {
        player,
        memberData,
        archivedPreviousTrend,
        seasonStart,
        rawStats,
        mergedMatches,
        abandonSummary
      } = await loadPlayerProfileContext({
        repository: this.repository,
        crewRepository: this.crewRepository,
        characterName,
        currentRankings
      });

      const seasonViews = buildSeasonViews(mergedMatches, seasonStart, rawStats, memberData, archivedPreviousTrend, abandonSummary);
      const currentView = seasonViews.current;

      return {
        player,
        matches: currentView.matches,
        stats: currentView.stats,
        seasonViews,
        seasonMeta: {
          currentStartIso: seasonStart && !Number.isNaN(seasonStart.getTime())
            ? seasonStart.toISOString()
            : null
        }
      };
    } catch (error) {
      console.error('[ApplicationService] Fetch failed:', error);
      throw error;
    }
  }

  /**
   * Search and load basic player profile
   */
  async searchPlayer(characterName) {
    return await this.repository.getPlayer(characterName);
  }

  /**
   * Load match history for a player
   */
  async getRecentMatches(ouid, nickname = "", limit = 20) {
    return await this.repository.getRecentMatches(ouid, limit, nickname);
  }

  // --- Caching Utilities ---
  getCache(key) {
    const str = localStorage.getItem(key);
    if (!str) return null;
    try {
      const item = JSON.parse(str);
      // Return both data and timestamp for SWR feedback
      return { data: item.data, timestamp: item.timestamp };
    } catch (e) { return null; }
  }

  setCache(key, data) {
    try {
      const item = { data, timestamp: Date.now() };
      localStorage.setItem(key, JSON.stringify(item));
    } catch (e) { console.warn('[SaService] Cache save failed:', e); }
  }
}
