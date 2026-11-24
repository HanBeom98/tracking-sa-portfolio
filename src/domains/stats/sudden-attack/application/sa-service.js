import { buildSeasonViews } from './season-view-builder.js';
import { loadPlayerProfileContext } from './player-profile-loader.js';
import { MatchQueryError } from '../domain/match-query.js';
import { RecentStats } from '../domain/stats.js';
import { getPublicMatchCategory } from './public-match-categories.js';

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
  async fetchFreshData(characterName, currentRankings = [], options = {}) {
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
        currentRankings,
        scope: options.scope || 'league'
      });

      const seasonViews = buildSeasonViews(
        mergedMatches,
        seasonStart,
        rawStats,
        memberData,
        archivedPreviousTrend,
        abandonSummary,
        { scope: options.scope || 'league' }
      );
      const currentView = seasonViews.current;

      return {
        player,
        matches: currentView.matches,
        stats: currentView.stats,
        seasonViews,
        viewContext: options.scope || 'league',
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
  async getRecentMatches(ouid, nickname = "", limit = 20, options = {}) {
    return await this.repository.getRecentMatches(ouid, limit, nickname, options);
  }

  async getPublicMatchCategory(player, category = 'all') {
    const config = getPublicMatchCategory(category);
    const [matches, rawStats] = await Promise.all([
      this.repository.getRecentMatches(player.ouid, 20, player.nickname, {
        scope: 'public',
        matchTypes: config.matchTypes
      }),
      this.repository.apiClient.getRecentInfo(player.ouid)
    ]);
    const recentMatches = matches.slice(0, 20);
    const stats = new RecentStats(rawStats || {}, recentMatches, null, {
      forceMatchMetrics: true,
      abandonCount: 0
    });
    stats.seasonLabel = `${config.label} 최근 20경기`;
    return {
      key: config.key,
      label: `${config.label} 최근 20경기`,
      matches: recentMatches,
      stats
    };
  }

  async getOlderPublicMatches(player, category = 'all', beforeDate = '') {
    const config = getPublicMatchCategory(category);
    return this.repository.getOlderPublicMatches(player.ouid, beforeDate, 20, {
      matchTypes: config.matchTypes,
      player
    });
  }

  async getPlayerActivity(player, options = {}) {
    const config = getPublicMatchCategory('all');
    return this.repository.getPlayerActivityMatches(player.ouid, 31, {
      matchTypes: config.matchTypes,
      onProgress: options.onProgress
    });
  }

  async getPlayerActivityDay(player, activityMatches = [], dateKey = '') {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit'
    });
    const selectedMatches = activityMatches.filter((match) => {
      const date = new Date(match?.matchDate);
      return !Number.isNaN(date.getTime()) && formatter.format(date) === dateKey;
    });
    if (selectedMatches.length === 0) return [];
    const details = await this.repository.getActivityMatchDetails(selectedMatches, player);
    const failures = details.filter(match => match.detailUnavailable);
    if (failures.length) throw new MatchQueryError(failures.map(match => ({ code: match.detailFailureCode })), selectedMatches.length, 'detail');
    return details;
  }
}
