import { Player, MatchRecord } from '../domain/models.js';

export class SaService {
  constructor(apiClient) {
    this.apiClient = apiClient;
  }

  /**
   * Complete player search and profile load
   */
  async searchPlayer(characterName) {
    try {
      const ouid = await this.apiClient.getOuid(characterName);
      const [basic, rank] = await Promise.all([
        this.apiClient.getPlayerBasic(ouid),
        this.apiClient.getPlayerRank(ouid)
      ]);
      
      return new Player(basic, rank);
    } catch (error) {
      console.error('Failed to search player:', error);
      throw error;
    }
  }

  /**
   * Load match history for a player
   */
  async getRecentMatches(ouid) {
    try {
      const matches = await this.apiClient.getMatchList(ouid);
      // Fetch details for each match (Nexon API often requires individual detail calls)
      // Limit to last 5 matches for initial display performance
      const detailPromises = matches.match_list.slice(0, 5).map(m => 
        this.apiClient.getMatchDetail(m.match_id)
      );
      
      const details = await Promise.all(detailPromises);
      return details.map(d => new MatchRecord(d));
    } catch (error) {
      console.error('Failed to load match history:', error);
      return [];
    }
  }
}
