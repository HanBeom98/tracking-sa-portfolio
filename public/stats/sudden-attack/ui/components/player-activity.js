const DAY_MS = 24 * 60 * 60 * 1000;
export const ACTIVITY_MODE_TABS = Object.freeze([
  { key: 'all', label: '전체', matchTypes: [] },
  { key: 'clan', label: '클랜전', matchTypes: ['퀵매치 클랜전', '클랜전'] },
  { key: 'solo', label: '솔로랭크', matchTypes: ['랭크전 솔로'] },
  { key: 'party', label: '파티랭크', matchTypes: ['랭크전 파티'] },
  { key: 'tournament', label: '토너먼트', matchTypes: ['토너먼트'] }
]);

function getKstParts(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', hourCycle: 'h23'
  }).formatToParts(date);
  const read = (type) => parts.find((part) => part.type === type)?.value;
  return {
    date,
    dateKey: `${read('year')}-${read('month')}-${read('day')}`,
    hour: Number(read('hour') || 0) % 24
  };
}

function calculateMetrics(matches) {
  const total = matches.length;
  const wins = matches.filter((match) => match.matchResult === 'WIN').length;
  const kills = matches.reduce((sum, match) => sum + Number(match.kill || 0), 0);
  const deaths = matches.reduce((sum, match) => sum + Number(match.death || 0), 0);
  return {
    count: total,
    wins,
    winRate: total > 0 ? Math.round((wins / total) * 100) : 0,
    kd: (kills + deaths) > 0 ? Math.round((kills / (kills + deaths)) * 100) : 0
  };
}

function filterMatchesByRecentDays(matches = [], days = 31, now = new Date()) {
  const daysInRange = Math.max(1, Math.min(31, Number(days || 31)));
  const current = new Date(now);
  const todayKey = getKstParts(current)?.dateKey;
  const todayStart = todayKey ? new Date(`${todayKey}T00:00:00+09:00`) : current;
  const rangeStart = new Date(todayStart.getTime() - ((daysInRange - 1) * DAY_MS));
  const rangeEnd = new Date(todayStart.getTime() + DAY_MS);

  return matches.filter((match) => {
    const parts = getKstParts(match?.matchDate);
    return parts && parts.date >= rangeStart && parts.date < rangeEnd;
  });
}

export function filterActivityMatches(matches = [], { date = '', mode = 'all' } = {}) {
  const config = ACTIVITY_MODE_TABS.find((tab) => tab.key === mode) || ACTIVITY_MODE_TABS[0];
  return matches.filter((match) => {
    const matchesDate = !date || getKstParts(match?.matchDate)?.dateKey === date;
    const matchesMode = config.matchTypes.length === 0 || config.matchTypes.includes(match?.matchTypeName);
    return matchesDate && matchesMode;
  });
}

export function buildActivityDayComparison(activityMatches = [], detailMatches = [], options = {}) {
  const date = options.date || '';
  const mode = options.mode || 'all';
  const selectedMatches = filterActivityMatches(detailMatches, { date, mode });
  const recentMatches = filterMatchesByRecentDays(activityMatches, options.days || 31, options.now || new Date());
  const baselineMatches = filterActivityMatches(recentMatches, { mode });
  const selected = calculateMetrics(selectedMatches);
  const baseline = calculateMetrics(baselineMatches);
  const headshots = selectedMatches.reduce((sum, match) => sum + Number(match.headshot || 0), 0);
  const kills = selectedMatches.reduce((sum, match) => sum + Number(match.kill || 0), 0);
  const totalDamage = selectedMatches.reduce((sum, match) => sum + Number(match.damage || 0), 0);
  return {
    date,
    mode,
    ...selected,
    headshotRate: kills > 0 ? Math.round((headshots / kills) * 100) : 0,
    totalDamage,
    averageDamage: selected.count > 0 ? Math.round(totalDamage / selected.count) : 0,
    baseline: {
      ...baseline,
      winRateDelta: selected.winRate - baseline.winRate,
      kdDelta: selected.kd - baseline.kd
    }
  };
}

export function buildPlayerActivitySummary(matches = [], options = {}) {
  const daysInRange = Math.max(1, Math.min(31, Number(options.days || 31)));
  const now = options.now ? new Date(options.now) : new Date();
  const todayKey = getKstParts(now)?.dateKey;
  const todayStart = todayKey ? new Date(`${todayKey}T00:00:00+09:00`) : now;
  const slots = [
    { key: '새벽', range: '00–05시', matches: [] },
    { key: '오전', range: '06–11시', matches: [] },
    { key: '오후', range: '12–17시', matches: [] },
    { key: '밤', range: '18–23시', matches: [] }
  ];
  const normalized = filterMatchesByRecentDays(matches, daysInRange, now)
    .map((match) => ({ match, parts: getKstParts(match?.matchDate) }))
    .filter((entry) => entry.parts);
  const byDate = new Map();

  normalized.forEach(({ match, parts }) => {
    if (!byDate.has(parts.dateKey)) byDate.set(parts.dateKey, []);
    byDate.get(parts.dateKey).push(match);
    slots[Math.min(3, Math.floor(parts.hour / 6))].matches.push(match);
  });

  const daily = Array.from({ length: daysInRange }, (_, offset) => {
    const date = new Date(todayStart.getTime() - ((daysInRange - 1 - offset) * DAY_MS));
    const dateKey = getKstParts(date)?.dateKey;
    const dayMatches = byDate.get(dateKey) || [];
    return { date: dateKey, ...calculateMetrics(dayMatches) };
  });
  const maxDailyCount = Math.max(1, ...daily.map((day) => day.count));
  daily.forEach((day) => {
    day.level = day.count === 0 ? 0 : Math.max(1, Math.min(4, Math.ceil((day.count / maxDailyCount) * 4)));
  });

  const totalMetrics = calculateMetrics(normalized.map((entry) => entry.match));
  const activeDays = daily.filter((day) => day.count > 0).length;
  const primary = [...slots].sort((a, b) => b.matches.length - a.matches.length)[0];
  const latest = [...normalized].sort((a, b) => b.parts.date - a.parts.date)[0]?.parts.dateKey || '기록 없음';

  return {
    ...totalMetrics,
    total: totalMetrics.count,
    days: activeDays,
    latest,
    primary: totalMetrics.count > 0 ? `${primary.key} ${primary.range}` : '데이터 부족',
    daily,
    slots: slots.map((slot) => ({
      key: slot.key,
      range: slot.range,
      ...calculateMetrics(slot.matches),
      percent: totalMetrics.count > 0 ? Math.round((slot.matches.length / totalMetrics.count) * 100) : 0
    }))
  };
}
