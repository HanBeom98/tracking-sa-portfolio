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
   * Fetch recent matches for a player (All Modes Scan)
   */
  async getRecentMatches(ouid, limit = 5) {
    const modes = [
      { id: 1, name: "일반전" },
      { id: 2, name: "랭크전" },
      { id: 3, name: "클랜전" },
      { id: 4, name: "생존모드" },
      { id: 5, name: "영토전" }
    ];

    try {
      // Parallel scan all modes, each with its own error boundary
      const results = await Promise.all(
        modes.map(async (mode) => {
          try {
            const data = await this.apiClient.getMatchList(ouid, mode.id);
            return (data.match_list || []).map(m => ({ ...m, typeName: mode.name }));
          } catch (err) {
            // Silently ignore 400 errors for modes without data
            console.warn(`[Repository] No data for mode ${mode.name} (ID: ${mode.id})`);
            return [];
          }
        })
      );

      const combinedMatches = results.flat();

      // Sort by date (descending) and take top N
      const sortedIds = combinedMatches
        .sort((a, b) => new Date(b.match_date) - new Date(a.match_date))
        .slice(0, limit);
      
      const details = await Promise.all(
        sortedIds.map(async (m) => {
          try {
            const detail = await this.apiClient.getMatchDetail(m.match_id);
            return new MatchRecord(detail, m.typeName);
          } catch (err) {
            console.error(`[Repository] Failed to get detail for match ${m.match_id}:`, err);
            return null;
          }
        })
      );
      
      return details.filter(d => d !== null);
    } catch (error) {
      console.error('[Repository] Fatal error during match scanning:', error);
      throw error;
    }
  }
}
