function normalizeTrendEntries(entries = []) {
  return (Array.isArray(entries) ? entries : [])
    .map((entry) => {
      const date = entry?.date ? new Date(entry.date) : null;
      return {
        mmr: Number(entry?.mmr || 1200),
        hsr: Number(entry?.hsr || entry?.mmr || 1200),
        date: date && !Number.isNaN(date.getTime()) ? date.toISOString() : null,
      };
    })
    .filter((entry) => !!entry.date)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

function buildTrendViews(memberData, seasonStart, archivedPreviousTrend = []) {
  const rawHistory = Array.isArray(memberData?.mmrHistory) ? memberData.mmrHistory : [];
  const normalized = normalizeTrendEntries(rawHistory);

  const current = normalized.filter((entry) => new Date(entry.date) >= seasonStart);
  let previous = normalized.filter((entry) => new Date(entry.date) < seasonStart);
  const safeArchived = normalizeTrendEntries(archivedPreviousTrend);
  if (previous.length === 0 && safeArchived.length > 0) {
    previous = safeArchived;
  }
  return { current, previous };
}

function applySeasonTrend(stats, trend) {
  const safeTrend = Array.isArray(trend) ? trend : [];
  stats.mmrTrend = safeTrend;
  stats.mmrHistory = safeTrend;
  if (safeTrend.length === 0) {
    stats.crewMmr = 1200;
    stats.crewHsr = 1200;
    return;
  }
  const latest = safeTrend[safeTrend.length - 1];
  stats.crewMmr = Number(latest.mmr || 1200);
  stats.crewHsr = Number(latest.hsr || latest.mmr || 1200);
}

export {
  normalizeTrendEntries,
  buildTrendViews,
  applySeasonTrend,
};
