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

    console.log('[Repository] Player Basic Info:', JSON.stringify(basic, null, 2));
    console.log('[Repository] Player Rank Info:', JSON.stringify(rank, null, 2));
    
    return new Player(ouid, basic, rank);
  }

  /**
   * Fetch recent matches for a player (Resilient Sequential Scan)
   */
  async getRecentMatches(ouid, limit = 5) {
    const modes = [
      { id: 1, name: "일반전" },
      { id: 2, name: "랭크전" },
      { id: 3, name: "클랜전" },
      { id: 4, name: "생존모드" },
      { id: 5, name: "영토전" }
    ];

    const combinedMatches = [];
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    try {
      console.log(`[Repository] Starting sequential scan for OUID: ${ouid}`);
      
      for (const mode of modes) {
        try {
          // Add a small delay between requests to avoid 429
          await delay(150); 
          const data = await this.apiClient.getMatchList(ouid, mode.id);
          const matches = (data.match_list || []).map(m => ({ ...m, typeName: mode.name }));
          combinedMatches.push(...matches);
          console.log(`[Repository] Successfully loaded ${matches.length} matches from ${mode.name}`);
        } catch (err) {
          if (err.message === 'TEST_KEY_LIMITATION') {
            console.warn(`[Repository] Test key scope limitation for mode ${mode.name}`);
          } else {
            console.warn(`[Repository] No data or error for mode ${mode.name}:`, err.message);
          }
        }
      }

      // Sort by date (descending) and take top N
      const sortedIds = combinedMatches
        .sort((a, b) => new Date(b.match_date) - new Date(a.match_date))
        .slice(0, limit);
      
      const details = [];
      for (const m of sortedIds) {
        try {
          await delay(100);
          const detail = await this.apiClient.getMatchDetail(m.match_id);
          details.push(new MatchRecord(detail, m.typeName));
        } catch (err) {
          console.error(`[Repository] Failed to get detail for match ${m.match_id}:`, err.message);
        }
      }
      
      return details;
    } catch (error) {
      console.error('[Repository] Fatal error during match scanning:', error);
      throw error;
    }
  }
}
