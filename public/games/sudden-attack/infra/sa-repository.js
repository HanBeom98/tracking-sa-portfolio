import { Player, MatchRecord, RecentStats } from '../domain/models.js';

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
   * Fetch recent trend stats (K/D, Win Rate)
   */
  async getPlayerStats(ouid) {
    try {
      const data = await this.apiClient.getRecentInfo(ouid);
      console.log('[Repository] Player Recent Info:', JSON.stringify(data, null, 2));
      return new RecentStats(data);
    } catch (error) {
      console.warn('[Repository] Failed to get recent stats:', error.message);
      return null;
    }
  }

  /**
   * Fetch recent matches for a player (Resilient Sequential Scan)
   */
  async getRecentMatches(ouid, limit = 5) {
    const modes = [
      { id: 7, name: "랭크전" },
      { id: 11, name: "클랜전" },
      { id: 12, name: "토너먼트" },
      { id: 13, name: "공식전" }
    ];

    const combinedMatches = [];
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // Get Today and Yesterday in KST (YYYY-MM-DD)
    // Current UTC time + 9 hours = KST
    const now = new Date();
    const kstOffset = 9 * 60 * 60 * 1000;
    const kstDate = new Date(now.getTime() + kstOffset);
    
    // Use toISOString and split at 'T' to get YYYY-MM-DD
    // But be careful: toISOString() uses UTC. We need the KST date.
    // A more robust way to get KST date string:
    const formatDate = (date) => {
      const d = new Date(date.getTime());
      // No need to add offset again, d is already shifted
      return d.toISOString().split('T')[0];
    };

    const dates = [
      formatDate(kstDate), // Today in KST
      formatDate(new Date(kstDate.getTime() - (24 * 60 * 60 * 1000))) // Yesterday in KST
    ];

    try {
      console.log(`[Repository] Starting deep scan for OUID: ${ouid} on Dates: ${dates.join(', ')}`);
      
      for (const date of dates) {
        for (const mode of modes) {
          try {
            await delay(1000); 
            const data = await this.apiClient.getMatchList(ouid, mode.id, date);
            const matches = (data.match_list || []).map(m => ({ ...m, typeName: mode.name }));
            combinedMatches.push(...matches);
            if (matches.length > 0) {
              console.log(`[Repository] Found ${matches.length} matches in ${mode.name} on ${date}`);
            }
          } catch (err) {
            // Silence common errors
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
