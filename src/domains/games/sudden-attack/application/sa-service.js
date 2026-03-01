/**
 * Sudden Attack Application Service (Application Layer)
 * Coordinates user requests and domain operations using a repository.
 */
export class SaService {
  constructor(repository) {
    this.repository = repository;
  }

  /**
   * Search and load player profile
   */
  async searchPlayer(characterName) {
    try {
      return await this.repository.getPlayer(characterName);
    } catch (error) {
      console.error('[ApplicationService] Failed to search player:', error);
      throw error;
    }
  }

  /**
   * Load match history for a player
   */
  async getRecentMatches(ouid, nickname = "") {
    try {
      return await this.repository.getRecentMatches(ouid, 20, nickname);
    } catch (error) {
      console.error('[ApplicationService] Failed to load match history:', error);
      return [];
    }
  }
}
