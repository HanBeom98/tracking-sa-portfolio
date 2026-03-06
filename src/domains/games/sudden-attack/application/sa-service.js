import { RecentStats } from '../domain/stats.js';

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
      // 1. Search Player
      const player = await this.repository.getPlayer(characterName);
      
      // 2. Sync Nickname if crew member
      await this.syncCrewNickname(player);

      // 3. Load Matches
      const matches = await this.repository.getRecentMatches(player.ouid, 20, player.nickname);
      let seasonMatches = matches;
      if (this.crewRepository && typeof this.crewRepository.getSeasonStartDate === 'function') {
        try {
          const seasonStart = await this.crewRepository.getSeasonStartDate();
          if (seasonStart instanceof Date && !Number.isNaN(seasonStart.getTime()) && seasonStart.getTime() > 0) {
            seasonMatches = matches.filter((m) => m.matchDate && new Date(m.matchDate) >= seasonStart);
          }
        } catch (err) {
          console.warn('[ApplicationService] Season start lookup failed (non-critical):', err);
        }
      }

      // 4. Fetch Crew Data from local list or DB
      let memberData = currentRankings.find(m => m.id === player.ouid);
      if (!memberData && this.crewRepository) {
        memberData = await this.crewRepository.findMemberByOuid(player.ouid);
      }

      // 5. Load Metadata (Recent Info from Nexon)
      const rawStats = await this.repository.apiClient.getRecentInfo(player.ouid);

      // 6. Construct Stats with ALL required data at once
      const stats = new RecentStats(rawStats, seasonMatches, memberData, { forceMatchMetrics: true });

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
