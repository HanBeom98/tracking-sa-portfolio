export function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function formatMetric(value, digits = 0) {
  return finiteNumber(value).toFixed(digits);
}

export function createShareCardModel(profile, view, pageUrl = '') {
  const matches = Array.isArray(view?.matches) ? view.matches : [];
  const stats = view?.stats || {};
  const headshotRate = finiteNumber(stats.seasonPrecisionRate) > 0
    ? finiteNumber(stats.seasonPrecisionRate) * 100
    : finiteNumber(stats.officialRecentHeadshotRate);
  const url = new URL(pageUrl || 'https://trackingsa.com/stats/sudden-attack/');
  url.searchParams.set('n', String(profile?.player?.nickname || '').trim());

  return {
    nickname: String(profile?.player?.nickname || 'PLAYER').trim(),
    clanName: String(profile?.player?.clanName || '').trim(),
    rankName: String(profile?.player?.rankName || '정보 없음').trim(),
    rankImage: String(profile?.player?.rankImage || '').trim(),
    isCrew: Boolean(profile?.player?.isCrew),
    soloTier: String(profile?.player?.soloTier || 'UNRANK').trim(),
    soloImage: String(profile?.player?.soloImage || '').trim(),
    partyTier: String(profile?.player?.partyTier || 'UNRANK').trim(),
    partyImage: String(profile?.player?.partyImage || '').trim(),
    winRate: finiteNumber(stats.winRate),
    kdPercent: finiteNumber(stats.officialRecentKd, finiteNumber(stats.kdPercent)),
    headshotRate,
    assaultRate: finiteNumber(stats.recentAssaultRate),
    sniperRate: finiteNumber(stats.recentSniperRate),
    specialRate: finiteNumber(stats.recentSpecialRate),
    matchCount: matches.length,
    url: url.toString(),
    date: new Intl.DateTimeFormat('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date()),
  };
}

