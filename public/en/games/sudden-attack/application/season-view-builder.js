import { RecentStats } from '../domain/stats.js';
import { buildTrendViews, applySeasonTrend } from './trend-view-builder.js';

function buildSeasonViews(allMatches, seasonStart, rawStats, memberData, archivedPreviousTrend = [], abandonSummary = { current: 0, previous: 0 }) {
  const safeMatches = Array.isArray(allMatches) ? allMatches : [];
  const isCurrentSeasonMatch = (match) => match?.matchDate && new Date(match.matchDate) >= seasonStart;
  const currentMatches = safeMatches.filter(isCurrentSeasonMatch).slice(0, 20);
  const previousMatches = safeMatches.filter((match) => !isCurrentSeasonMatch(match)).slice(0, 20);
  const currentCustom = currentMatches.filter((m) => m.isCustomMatch).slice(0, 20);
  const previousCustom = previousMatches.filter((m) => m.isCustomMatch).slice(0, 20);

  const trendViews = buildTrendViews(memberData, seasonStart, archivedPreviousTrend);

  const currentStats = new RecentStats(rawStats, currentCustom, memberData, {
    forceMatchMetrics: true,
    abandonCount: Number(abandonSummary?.current || 0)
  });
  applySeasonTrend(currentStats, trendViews.current);
  currentStats.seasonLabel = '이번 시즌';

  const previousStats = new RecentStats(rawStats, previousCustom, memberData, {
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
