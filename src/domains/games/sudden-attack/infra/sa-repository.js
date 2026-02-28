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
    
    return new Player(basic, rank);
  }

  /**
   * Fetch recent matches for a player
   */
  async getRecentMatches(ouid, limit = 5) {
    const matches = await this.apiClient.getMatchList(ouid);
    const recentIds = matches.match_list.slice(0, limit);
    
    const details = await Promise.all(
      recentIds.map(m => this.apiClient.getMatchDetail(m.match_id))
    );
    
    return details.map(d => new MatchRecord(d));
  }
}
