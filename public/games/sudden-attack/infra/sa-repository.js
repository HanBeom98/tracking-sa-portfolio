import { Player, MatchRecord } from '../domain/models.js';

/**
 * Sudden Attack Data Repository (Infrastructure Layer)
 * Bridges the gap between the Nexon API and the Domain models.
 */
export class SaRepository {
  constructor(apiClient) {
    this.apiClient = apiClient;
  }

  /**
   * Resolve a player by character name
   */
  async getPlayer(characterName) {
    const ouid = await this.apiClient.getOuid(characterName);
    const [basic, rank] = await Promise.all([
      this.apiClient.getPlayerBasic(ouid),
      this.apiClient.getPlayerRank(ouid)
    ]);
    
    return new Player(ouid, basic, rank);
  }

  /**
   * Fetch recent matches for a player (Ranked & Clan)
   */
  async getRecentMatches(ouid, limit = 5) {
    try {
      // Fetch both Ranked (2) and Clan (3) matches in parallel
      const [rankedData, clanData] = await Promise.all([
        this.apiClient.getMatchList(ouid, 2).catch(() => ({ match_list: [] })),
        this.apiClient.getMatchList(ouid, 3).catch(() => ({ match_list: [] }))
      ]);

      const combinedMatches = [
        ...(rankedData.match_list || []).map(m => ({ ...m, typeName: "랭크전" })),
        ...(clanData.match_list || []).map(m => ({ ...m, typeName: "클랜전" }))
      ];

      // Sort by date (descending) and take top N
      const sortedIds = combinedMatches
        .sort((a, b) => new Date(b.match_date) - new Date(a.match_date))
        .slice(0, limit);
      
      const details = await Promise.all(
        sortedIds.map(async (m) => {
          const detail = await this.apiClient.getMatchDetail(m.match_id);
          return new MatchRecord(detail, m.typeName);
        })
      );
      
      return details;
    } catch (error) {
      console.error('[Repository] Failed to get merged matches:', error);
      throw error;
    }
  }
}
