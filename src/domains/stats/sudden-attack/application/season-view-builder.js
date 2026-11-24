import { RecentStats } from '../domain/stats.js';
import { buildTrendViews, applySeasonTrend } from './trend-view-builder.js';

function buildSeasonViews(allMatches, seasonStart, rawStats, memberData, archivedPreviousTrend = [], abandonSummary = { current: 0, previous: 0 }, options = {}) {
  const safeMatches = Array.isArray(allMatches) ? allMatches : [];
  const scope = options.scope || 'league';
  if (scope === 'public') {
    const recentMatches = safeMatches.slice(0, 20);
    const olderMatches = safeMatches.slice(20, 40);
    const trendViews = buildTrendViews(memberData, seasonStart, archivedPreviousTrend);

    const currentStats = new RecentStats(rawStats, recentMatches, memberData, {
      forceMatchMetrics: true,
      abandonCount: 0
    });
    applySeasonTrend(currentStats, trendViews.current);
    currentStats.seasonLabel = '전체 최근 20경기';

    const previousStats = new RecentStats(rawStats, olderMatches, memberData, {
      forceMatchMetrics: true,
      abandonCount: 0
    });
    applySeasonTrend(previousStats, trendViews.previous);
    previousStats.seasonLabel = '전체 이전 20경기';

    return {
      current: { key: 'current', label: '전체 최근 20경기', matches: recentMatches, stats: currentStats },
      previous: { key: 'previous', label: '전체 이전 20경기', matches: olderMatches, stats: previousStats }
    };
  }

  const isCurrentSeasonMatch = (match) => match?.matchDate && new Date(match.matchDate) >= seasonStart;
  const currentMatches = safeMatches.filter(isCurrentSeasonMatch);
  const previousMatches = safeMatches.filter((match) => !isCurrentSeasonMatch(match));
  const recentCurrentMatches = currentMatches.slice(0, 20);
  const recentPreviousMatches = previousMatches.slice(0, 20);
  const currentStatsMatches = (scope === 'public'
    ? recentCurrentMatches
    : recentCurrentMatches.filter((m) => m.isCustomMatch)
  );
  const previousStatsMatches = (scope === 'public'
    ? recentPreviousMatches
    : recentPreviousMatches.filter((m) => m.isCustomMatch)
  );

  const trendViews = buildTrendViews(memberData, seasonStart, archivedPreviousTrend);

  const currentStats = new RecentStats(rawStats, currentStatsMatches, memberData, {
    forceMatchMetrics: true,
    abandonCount: Number(abandonSummary?.current || 0)
  });
  applySeasonTrend(currentStats, trendViews.current);
  currentStats.seasonLabel = '이번 시즌';

  const previousStats = new RecentStats(rawStats, previousStatsMatches, memberData, {
    forceMatchMetrics: true,
    abandonCount: Number(abandonSummary?.previous || 0)
  });
  applySeasonTrend(previousStats, trendViews.previous);
  previousStats.seasonLabel = '지난 시즌';

  return {
    current: { key: 'current', label: '이번 시즌', matches: currentMatches, stats: currentStats },
    previous: { key: 'previous', label: '지난 시즌', matches: previousMatches, stats: previousStats }
  };
}

export { buildSeasonViews };
