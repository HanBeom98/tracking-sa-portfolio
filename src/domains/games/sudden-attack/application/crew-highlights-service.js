export class CrewHighlightsService {
  build(rankings = [], history = [], seasonStart = null) {
    const safeRankings = Array.isArray(rankings) ? rankings : [];
    const safeHistory = Array.isArray(history) ? history : [];
    const safeSeasonStart = seasonStart instanceof Date ? seasonStart : null;
    return {
      todayMvp: this.getTodayMvp(safeRankings, safeHistory),
      weeklyRival: this.getWeeklyRival(safeRankings),
      weeklyMaps: this.getWeeklyMapReport(safeHistory),
      timeline: this.getSeasonTimeline(safeRankings, safeHistory, safeSeasonStart)
    };
  }

  getTodayMvp(rankings, history) {
    if (!rankings.length) return null;
    const latestHistoryDate = history.length ? new Date(history[0].matchDate) : new Date();
    const latestDay = this.toDayKey(latestHistoryDate);
    let best = null;

    rankings.forEach((member) => {
      const series = Array.isArray(member.mmrHistory) ? member.mmrHistory : [];
      const dayEntries = series
        .filter((entry) => entry?.date && this.toDayKey(new Date(entry.date)) === latestDay)
        .sort((a, b) => new Date(a.date) - new Date(b.date));
      if (!dayEntries.length) return;
      const firstMmr = dayEntries[0]?.mmr ?? member.mmr ?? 1200;
      const lastMmr = dayEntries[dayEntries.length - 1]?.mmr ?? member.mmr ?? 1200;
      const diff = Number(lastMmr) - Number(firstMmr);
      const candidate = { name: member.characterName, diff, mmr: member.mmr || 1200 };
      if (!best || candidate.diff > best.diff) best = candidate;
    });

    return best;
  }

  getWeeklyRival(rankings) {
    const active = rankings
      .map((m) => ({ ...m, totalMatches: Number(m.wins || 0) + Number(m.loses || 0) }))
      .filter((m) => m.totalMatches >= 3)
      .sort((a, b) => (b.totalMatches - a.totalMatches) || (b.mmr - a.mmr))
      .slice(0, 12);
    if (active.length < 2) return null;

    let best = null;
    for (let i = 0; i < active.length; i += 1) {
      for (let j = i + 1; j < active.length; j += 1) {
        const a = active[i];
        const b = active[j];
        const diff = Math.abs(Number(a.mmr || 1200) - Number(b.mmr || 1200));
        const score = diff + Math.abs(a.totalMatches - b.totalMatches) * 3;
        if (!best || score < best.score) best = { a, b, diff, score };
      }
    }
    return best;
  }

  getWeeklyMapReport(history) {
    if (!history.length) return [];
    const latestDate = new Date(history[0].matchDate);
    const weekAgo = new Date(latestDate.getTime() - (7 * 24 * 60 * 60 * 1000));
    const mapCount = {};
    history.forEach((h) => {
      const d = new Date(h.matchDate);
      if (d < weekAgo) return;
      mapCount[h.map] = (mapCount[h.map] || 0) + 1;
    });
    return Object.entries(mapCount)
      .map(([map, count]) => ({ map, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
  }

  getSeasonTimeline(rankings, history, seasonStart) {
    const lines = [];
    const climber = rankings
      .map((m) => {
        const series = Array.isArray(m.mmrHistory) ? m.mmrHistory : [];
        const first = series[0]?.mmr ?? 1200;
        const last = series[series.length - 1]?.mmr ?? (m.mmr || 1200);
        return { name: m.characterName, diff: Number(last) - Number(first) };
      })
      .sort((a, b) => b.diff - a.diff)[0];
    if (climber && climber.diff !== 0) {
      lines.push(`상승세 1위: ${climber.name} (${climber.diff > 0 ? '+' : ''}${climber.diff})`);
    }

    const king = rankings
      .map((m) => ({ ...m, total: Number(m.wins || 0) + Number(m.loses || 0) }))
      .filter((m) => m.total >= 5)
      .map((m) => ({ name: m.characterName, wr: Math.round((Number(m.wins || 0) / m.total) * 100), total: m.total }))
      .sort((a, b) => b.wr - a.wr || b.total - a.total)[0];
    if (king) lines.push(`승률왕: ${king.name} (${king.wr}% / ${king.total}전)`);

    if (history.length > 0) {
      const byDay = {};
      history.forEach((h) => {
        const key = this.toDayKey(new Date(h.matchDate));
        byDay[key] = (byDay[key] || 0) + 1;
      });
      const hottest = Object.entries(byDay).sort((a, b) => b[1] - a[1])[0];
      if (hottest) lines.push(`전장 과열일: ${hottest[0]} (${hottest[1]}판)`);
    }

    if (seasonStart instanceof Date && !Number.isNaN(seasonStart.getTime())) {
      lines.push(`시즌 시작일: ${this.toDayKey(seasonStart)}`);
    }
    return lines.slice(0, 4);
  }

  toDayKey(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
}
