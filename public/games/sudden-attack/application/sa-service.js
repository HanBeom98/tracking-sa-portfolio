import { RecentStats } from '../domain/models.js?v=20260228_7';

/**
 * Sudden Attack Application Service (Application Layer)
 * Coordinates user requests and domain operations using a repository.
 */
export class SaService {
  constructor(repository, crewRepository = null) {
    this.repository = repository;
    this.crewRepository = crewRepository;
  }

  /**
   * Search and load full player profile with stats and matches
   */
  async getFullPlayerProfile(characterName, currentRankings = []) {
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
        const ck = memberData.crewKills || 0;
        const cd = memberData.crewDeaths || 0;
        stats.crewKd = cd > 0 ? (ck / cd).toFixed(2) : (ck > 0 ? ck.toFixed(2) : "0.00");

        // Fetch MMR History for chart
        if (this.crewRepository) {
          stats.mmrTrend = await this.crewRepository.getMemberMmrHistory(player.ouid);
        }
      }
      
      stats.calculateCrewStatus();

      return { player, matches, stats };
    } catch (error) {
      console.error('[ApplicationService] Failed to get full profile:', error);
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
}
