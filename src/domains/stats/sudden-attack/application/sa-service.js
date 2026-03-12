import { buildSeasonViews } from './season-view-builder.js';
import { buildSyntheticAbandonMatches, mergeMatchesWithSyntheticAbandons } from './abandon-match-service.js';
import { normalizeTrendEntries } from './trend-view-builder.js';

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

      // 3. Load enough matches to support season toggle (current / previous)
      const allMatches = await this.repository.getRecentMatches(player.ouid, 80, player.nickname);

      // 4. Fetch Crew Data from local list or DB
      let memberData = currentRankings.find(m => m.id === player.ouid);
      if (!memberData && this.crewRepository) {
        memberData = await this.crewRepository.findMemberByOuid(player.ouid);
      }
      const archivedPreviousTrend = await this.getArchivedPreviousTrendSafe(player.ouid);
      const seasonStart = await this.getSeasonStartDateSafe();
      const seasonHistory = this.crewRepository
        ? await this.crewRepository.getHistory(300)
        : [];
      const syntheticAbandonMatches = this.crewRepository
        ? buildSyntheticAbandonMatches(allMatches, seasonHistory, {
            ouid: player.ouid,
            nickname: player.nickname
          })
        : [];
      const mergedMatches = mergeMatchesWithSyntheticAbandons(allMatches, syntheticAbandonMatches);
      const abandonSummary = this.crewRepository
        ? this.crewRepository.buildMemberAbandonSummary(seasonHistory, {
            ouid: player.ouid,
            nickname: player.nickname,
            seasonStart
          })
        : { current: 0, previous: 0 };

      // 5. Load Metadata (Recent Info from Nexon)
      const rawStats = await this.repository.apiClient.getRecentInfo(player.ouid);

      // 6. Construct season views (default = current season)
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

  async getSeasonStartDateSafe() {
    if (!this.crewRepository || typeof this.crewRepository.getSeasonStartDate !== 'function') {
      return new Date(0);
    }
    try {
      const seasonStart = await this.crewRepository.getSeasonStartDate();
      if (seasonStart instanceof Date && !Number.isNaN(seasonStart.getTime()) && seasonStart.getTime() > 0) {
        return seasonStart;
      }
    } catch (err) {
      console.warn('[ApplicationService] Season start lookup failed (non-critical):', err);
    }
    return new Date(0);
  }

  async getArchivedPreviousTrendSafe(ouid) {
    if (!this.crewRepository || typeof this.crewRepository.getLatestSeasonArchiveHistory !== 'function') {
      return [];
    }
    try {
      const archived = await this.crewRepository.getLatestSeasonArchiveHistory(ouid);
      return normalizeTrendEntries(archived);
    } catch (err) {
      console.warn('[ApplicationService] Archived trend lookup failed (non-critical):', err);
      return [];
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
