import { RecentStats } from '../domain/models.js?v=20260228_7';

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
        if (onUpdate && JSON.stringify(freshData) !== JSON.stringify(cached)) {
          console.log(`[SaService] Background update ready for ${characterName}.`);
          this.setCache(cacheKey, freshData);
          onUpdate(freshData);
        }
      }).catch(err => console.warn('[SaService] Background revalidation failed:', err));

      return { ...cached, isStale: true };
    }

    // 2. No cache, fetch from server normally
    const freshData = await this.fetchFreshData(characterName, currentRankings);
    this.setCache(cacheKey, freshData);
    return { ...freshData, isStale: false };
  }

  /**
   * Helper: Core data fetching logic (No cache logic here)
   */
  async fetchFreshData(characterName, currentRankings = []) {
    try {
      // 1. Search Player
      const player = await this.repository.getPlayer(characterName);
      
      // 2. Sync Nickname if crew member
      await this.syncCrewNickname(player);

      // 3. Load Matches
      const matches = await this.repository.getRecentMatches(player.ouid, 20, player.nickname);

      // 4. Process Stats
      const rawStats = await this.repository.apiClient.getRecentInfo(player.ouid);
      const stats = new RecentStats(rawStats, matches);

      // 5. Inject Crew Data and MMR Trend
      const memberData = currentRankings.find(m => m.id === player.ouid);
      if (memberData) {
        stats.crewMatchCount = (memberData.wins || 0) + (memberData.loses || 0);
        stats.crewWinRate = stats.crewMatchCount > 0 ? Math.round((memberData.wins / stats.crewMatchCount) * 100) : 0;
        stats.crewMmr = memberData.mmr || 1200;
        stats.crewKills = memberData.crewKills || 0;
        stats.crewDeaths = memberData.crewDeaths || 0;

        if (this.crewRepository) {
          stats.mmrTrend = await this.crewRepository.getMemberMmrHistory(player.ouid);
        }
      }
      
      stats.calculateCrewStatus();

      return { player, matches, stats };
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
   * Sync player's current nickname with crew database if they are a member
   */
  async syncCrewNickname(player) {
    if (!this.crewRepository) return;
    
    try {
      const existingMember = await this.crewRepository.findMemberByOuid(player.ouid);
      if (existingMember && existingMember.characterName !== player.nickname) {
        console.log(`[ApplicationService] Nickname sync: ${existingMember.characterName} -> ${player.nickname}`);
        await this.crewRepository.updateNickname(player.ouid, player.nickname);
        return true; 
      }
    } catch (err) {
      console.warn('[ApplicationService] Crew sync failed (non-critical):', err);
    }
    return false;
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
      // Check if data is too old (Optional: Even old data can be returned as SWR)
      return item.data;
    } catch (e) { return null; }
  }

  setCache(key, data) {
    try {
      const item = { data, timestamp: Date.now() };
      localStorage.setItem(key, JSON.stringify(item));
    } catch (e) { console.warn('[SaService] Cache save failed:', e); }
  }
}
