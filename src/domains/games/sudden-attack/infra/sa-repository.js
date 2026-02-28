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
    const now = new Date();
    // Use Intl to get KST date parts regardless of local system time
    const kstFormatter = new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });

    const formatDateParts = (date) => {
      const parts = kstFormatter.formatToParts(date);
      const y = parts.find(p => p.type === 'year').value;
      const m = parts.find(p => p.type === 'month').value;
      const d = parts.find(p => p.type === 'day').value;
      return `${y}-${m}-${d}`;
    };

    const todayKstStr = formatDateParts(now);
    const yesterdayKstStr = formatDateParts(new Date(now.getTime() - (24 * 60 * 60 * 1000)));

    // Try current date, yesterday, and also a "null" date (latest)
    const dates = [todayKstStr, yesterdayKstStr, ""];

    try {
      console.log(`[Repository] Starting deep scan for OUID: ${ouid} on Dates: ${dates.filter(d => d).join(', ') || 'Latest'}`);
      
      for (const date of dates) {
        for (const mode of modes) {
          try {
            await delay(800); // Respect rate limits
            const data = await this.apiClient.getMatchList(ouid, mode.id, date);
            const matches = (data.match_list || []).map(m => ({ ...m, typeName: mode.name }));
            
            // Avoid duplicates if we search with multiple dates
            for (const m of matches) {
              if (!combinedMatches.find(cm => cm.match_id === m.match_id)) {
                combinedMatches.push(m);
              }
            }

            if (matches.length > 0) {
              console.log(`[Repository] Found ${matches.length} matches in ${mode.name} on ${date || 'Latest'}`);
            }
          } catch (err) {
            // Silently skip modes/dates that return 400 or have no data
            if (!err.message.includes('400')) {
               console.warn(`[Repository] Skipping mode ${mode.name} on ${date}:`, err.message);
            }
          }
        }
        // If we found enough matches, we can stop early
        if (combinedMatches.length >= limit * 2) break;
      }

      // Sort by date (descending) and take top N
      const sortedMatches = combinedMatches
        .sort((a, b) => new Date(b.match_date) - new Date(a.match_date))
        .slice(0, limit);
      
      const details = [];
      for (const m of sortedMatches) {
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
