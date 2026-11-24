export function getKdColor(kdPercent) {
  const val = parseInt(kdPercent, 10);
  if (val >= 67) return 'kd-god';
  if (val >= 60) return 'kd-pro';
  if (val >= 50) return 'kd-high';
  return 'kd-normal';
}

export function getConfidenceMeta(matchCount = 0, target = 20) {
  const count = Math.max(0, Number(matchCount || 0));
  if (count < 7) return { cls: 'low', text: '신뢰도 낮음 · 샘플 적음' };
  if (count < 14) return { cls: 'mid', text: '신뢰도 보통 · 추가 데이터 필요' };
  if (count < target) return { cls: 'high', text: '신뢰도 높음' };
  return { cls: 'full', text: '신뢰도 매우 높음' };
}

export function getFormColor(data) {
  if (data.streakType === 'WIN') return 'var(--primary)';
  if (data.streakType === 'LOSE') return 'var(--red)';
  return 'var(--sa-text-strong)';
}

export function createProfileStatsViewModel(data) {
  return {
    ...data,
    kdColorClass: getKdColor(data.kdPercent),
    formColor: getFormColor(data),
    recentKillDeathRate: Number(data?.recentKillDeathRate ?? data?.kd ?? 0),
    recentAssaultRate: Number(data?.recentAssaultRate ?? data?.recent_assault_rate ?? 0),
    recentSniperRate: Number(data?.recentSniperRate ?? data?.recent_sniper_rate ?? 0),
    recentSpecialRate: Number(data?.recentSpecialRate ?? data?.recent_special_rate ?? 0),
  };
}

function finiteMetric(value) {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Number(numeric.toFixed(1)) : null;
}

export function getVsMetricRows(primary = {}, target = {}, context = 'league') {
  const matchMetric = (stats, field) => {
    if (!(Number(stats.totalMatchesCount) > 0)) return null;
    if (field === 'kdPercent' && stats.totalKills === 0 && stats.totalDeaths === 0) return null;
    return finiteMetric(stats[field]);
  };
  const crewMetric = (stats, field) => stats.isCrew ? finiteMetric(stats[field]) : null;
  const metrics = [
    { label: 'K/D', field: 'kdPercent', suffix: '%', read: matchMetric },
    { label: '승률', field: 'winRate', suffix: '%', read: matchMetric },
    ...(context === 'public'
      ? [{ label: '경기당 킬', field: 'avgK', suffix: '', read: matchMetric }]
      : [{ label: '내전 MMR', field: 'crewMmr', suffix: '', read: crewMetric },
        { label: '내전 HSR', field: 'crewHsr', suffix: '', read: crewMetric }])
  ];
  return metrics.map(({ label, field, suffix, read }) => {
    const a = read(primary, field), b = read(target, field);
    const available = a !== null && b !== null;
    const delta = available ? Number((a - b).toFixed(1)) : null;
    const format = value => value === null ? '—' : `${value}${suffix}`;
    return { label, primary: a, target: b, suffix, deltaUnit: suffix ? '%p' : field === 'avgK' ? '킬' : '점', available, delta,
      winner: !available ? 'unavailable' : delta > 0 ? 'primary' : delta < 0 ? 'target' : 'draw',
      primaryText: format(a), targetText: format(b) };
  });
}

export function getVsSummary(primaryName, targetName, rows) {
  const comparable = rows.filter(row => row.winner !== 'unavailable');
  if (!comparable.length) return {
    tone: 'neutral', title: '비교할 경기 기록이 부족합니다.',
    detail: '두 사람 모두 값이 있는 항목부터 비교할 수 있습니다.', score: '비교 보류'
  };
  const primaryWins = comparable.filter(row => row.winner === 'primary').length;
  const targetWins = comparable.filter(row => row.winner === 'target').length;
  if (primaryWins === targetWins) return {
    tone: 'neutral', title: '표시 지표의 우세 수가 같습니다.',
    detail: `${primaryName}과 ${targetName}의 승률·K/D와 표본 수를 함께 확인하세요.`,
    score: `${primaryWins}:${targetWins}`
  };
  const winner = primaryWins > targetWins ? 'primary' : 'target';
  const leaderName = winner === 'primary' ? primaryName : targetName;
  const focusText = comparable.filter(row => row.winner === winner).map(row => row.label).join(', ');
  return {
    tone: winner, title: `${leaderName} · 표시 지표 우세`,
    detail: `${focusText}에서 앞섭니다. 우세 항목 수는 ${primaryWins}:${targetWins}입니다.`,
    score: `${primaryWins}:${targetWins}`
  };
}
