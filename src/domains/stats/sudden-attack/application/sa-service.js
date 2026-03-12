import { buildSeasonViews } from './season-view-builder.js';
import { loadPlayerProfileContext } from './player-profile-loader.js';

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
   * Core player-profile fetch logic without cache orchestration.
   */
  async fetchFreshData(characterName, currentRankings = []) {
    try {
      const {
        player,
        memberData,
        archivedPreviousTrend,
        seasonStart,
        rawStats,
        mergedMatches,
        abandonSummary
      } = await loadPlayerProfileContext({
        repository: this.repository,
        crewRepository: this.crewRepository,
        characterName,
        currentRankings
      });

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

  /**
   * Search and load basic player profile
   */
  async searchPlayer(characterName) {
    return await this.repository.getPlayer(characterName);
  }

  /**
   * Load match history for a player
   */
  async getRecentMatches(ouid, nickname = "", limit = 20) {
    return await this.repository.getRecentMatches(ouid, limit, nickname);
  }
}
