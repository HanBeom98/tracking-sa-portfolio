function parseDateSafe(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateKo(value) {
  const date = parseDateSafe(value);
  if (!date) return '정보 없음';
  return date.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function getSeasonPeriodText(profile, mode) {
  if (profile?.viewContext === 'public') {
    return mode === 'current' ? '전체 최근 20경기' : '전체 이전 20경기';
  }
  const seasonStart = parseDateSafe(profile?.seasonMeta?.currentStartIso);
  if (!seasonStart) return '시즌 기준일 정보 없음';
  if (mode === 'current') return `${formatDateKo(seasonStart)} ~ 현재`;
  const previousEnd = new Date(seasonStart.getTime() - (24 * 60 * 60 * 1000));
  return `~ ${formatDateKo(previousEnd)}`;
}

export function renderSeasonToggle(profile, activeSeasonMode) {
  const currentCls = activeSeasonMode === 'current' ? 'active' : '';
  const previousCls = activeSeasonMode === 'previous' ? 'active' : '';
  const periodText = getSeasonPeriodText(profile, activeSeasonMode);
  const currentLabel = profile?.viewContext === 'public' ? '최근 20경기' : '이번 시즌';
  const previousLabel = profile?.viewContext === 'public' ? '이전 20경기' : '지난 시즌';
  return `
    <div class="season-toggle-bar">
      <div class="season-toggle-group" role="tablist" aria-label="기록 구간 비교">
        <button class="season-toggle-btn ${currentCls}" data-mode="current" type="button">${currentLabel}</button>
        <button class="season-toggle-btn ${previousCls}" data-mode="previous" type="button">${previousLabel}</button>
      </div>
      <span class="season-period">${periodText}</span>
    </div>
  `;
}

export function getSeasonView(profile, mode) {
  const views = profile?.seasonViews || {};
  if (views[mode]) return views[mode];
  if (views.current) return views.current;
  return {
    key: mode,
    label: mode === 'previous' ? '이전 20경기' : '최근 20경기',
    matches: profile?.matches || [],
    stats: profile?.stats || null
  };
}

function formatSigned(value, digits = 1, suffix = '') {
  const numeric = Number(value || 0);
  const sign = numeric > 0 ? '+' : '';
  return `${sign}${numeric.toFixed(digits)}${suffix}`;
}

function renderFormComparison(label, before, after, delta) {
  const bars = [['이전', before, 'previous'], ['최근', after, 'current']].map(([period, value, key]) => {
    const percent = Number(value);
    const valid = value != null && value !== '' && Number.isFinite(percent) && percent >= 0 && percent <= 100;
    return `<div class="sa-form-bar-row ${key}">
      <span>${period}</span>
      <span class="sa-form-bar-track" aria-hidden="true"><span style="width:${valid ? percent : 0}%"></span></span>
      <strong>${valid ? `${percent.toFixed(1)}%` : '—'}</strong>
    </div>`;
  }).join('');
  return `<div class="sa-form-comparison">
    <div class="sa-form-comparison-heading"><span>${label} 차이</span><strong>${formatSigned(delta, 1, '%p')}</strong></div>
    ${bars}
  </div>`;
}

export function renderFormInsight(profile) {
  const recent = getSeasonView(profile, 'current');
  // An absent previous window is not a second copy of the current window.
  const previous = profile?.seasonViews?.previous;
  const recentStats = recent?.stats || {};
  const previousStats = previous?.stats || {};
  const recentCount = Number(recentStats.totalMatchesCount || recent?.matches?.length || 0);
  const previousCount = Number(previousStats.totalMatchesCount || previous?.matches?.length || 0);

  if (recentCount === 0) return '';

  const hasBaseline = recentCount >= 7 && previousCount >= 7;
  const winRateDelta = Number((Number(recentStats.winRate || 0) - Number(previousStats.winRate || 0)).toFixed(1));
  // Match the narrative to the one-decimal percentage-point value shown below.
  const kdPercentDelta = Number((Number(recentStats.kdPercent || 0) - Number(previousStats.kdPercent || 0)).toFixed(1));
  let title = '최근 기록을 더 모아볼 구간';
  let description = '현재 기록만으로 장기적인 실력 변화까지 판단하기는 어렵습니다. 다음 경기에서도 같은 흐름이 이어지는지 확인해 보세요.';

  if (hasBaseline && winRateDelta >= 10 && kdPercentDelta >= 0) {
    title = '직전 20경기보다 성적 상승';
    description = '최신 구간에서 승률이 오르고 킬뎃도 유지 또는 개선되었습니다. 단, 상대 매칭과 맵 구성에 따라 달라질 수 있으니 다음 구간도 함께 확인하세요.';
  } else if (hasBaseline && winRateDelta <= -10 && kdPercentDelta === 0) {
    title = '승률 하락 · 킬뎃 유지';
    description = '최신 구간에서 승률은 낮아졌지만 킬뎃은 유지되었습니다. 맵·매치 구성을 확인한 뒤 다음 기록에서도 승률 변화가 이어지는지 살펴보세요.';
  } else if (hasBaseline && winRateDelta <= -10 && kdPercentDelta < 0) {
    title = '직전 20경기보다 성적 하락';
    description = '최신 구간에서 승률과 킬뎃이 함께 낮아졌습니다. 일시적인 변동일 수 있으므로 맵·매치 구성을 확인한 뒤 다음 기록에서 반복되는지 살펴보세요.';
  } else if (hasBaseline && winRateDelta * kdPercentDelta > 0) {
    title = winRateDelta > 0 ? '승률과 킬뎃 모두 상승' : '승률과 킬뎃 모두 하락';
    description = '두 지표가 같은 방향으로 변했습니다. 변화량 자체가 실력 변화의 확실성을 뜻하지는 않으므로 경기 수와 맵 구성을 함께 확인하세요.';
  } else if (hasBaseline && winRateDelta * kdPercentDelta < 0) {
    title = '승률과 킬뎃 흐름이 다름';
    description = '승률과 킬뎃이 서로 반대 방향으로 변했습니다. 개인 교전 지표만으로 경기 결과의 원인을 단정하지 마세요.';
  } else if (hasBaseline && Math.abs(winRateDelta) < 10 && Math.abs(kdPercentDelta) < 3) {
    title = '직전 20경기와 비슷한 성적';
    description = '최근 성적이 이전 20경기와 큰 차이를 보이지 않습니다. 단일 경기보다 20경기 단위의 추세를 기준으로 보는 편이 안전합니다.';
  } else if (hasBaseline) {
    const direction = (value) => value > 0 ? '상승' : value < 0 ? '하락' : '유지';
    title = '승률 ' + direction(winRateDelta) + ' · 킬뎃 ' + direction(kdPercentDelta);
    description = '한 지표의 변화만으로 전체 경기력을 판단하지 마세요. 선택한 경기 수와 매치 구성을 함께 확인하세요.';
  }

  return `
    <section class="sa-form-insight" aria-labelledby="formInsightTitle">
      <div class="sa-form-insight-head">
        <div>
          <p class="sa-form-insight-kicker">경쟁 모드 최근 흐름 평가</p>
          <h3 id="formInsightTitle">${title}</h3>
        </div>
        <span class="sa-form-insight-confidence">최근 표본 ${recentCount}경기 · 이전 ${previousCount}경기</span>
      </div>
      ${hasBaseline ? `<figure class="sa-form-chart" aria-label="이전 구간과 최근 구간의 승률 및 킬뎃 비교">
        <figcaption>이전 ${previousCount}경기 → 최근 ${recentCount}경기 <span>공통 눈금 0~100%</span></figcaption>
        <div class="sa-form-comparisons">
          ${renderFormComparison('승률', previousStats.winRate, recentStats.winRate, winRateDelta)}
          ${renderFormComparison('킬뎃', previousStats.kdPercent, recentStats.kdPercent, kdPercentDelta)}
        </div>
      </figure>` : `<div class="sa-form-insight-metrics">
        <div><span>최신 구간</span><strong>${recentCount}경기</strong></div>
        <div><span>승률 차이</span><strong>${hasBaseline ? formatSigned(winRateDelta, 1, '%p') : '비교 표본 부족'}</strong></div>
        <div><span>킬뎃 차이</span><strong>${hasBaseline ? formatSigned(kdPercentDelta, 1, '%p') : '비교 표본 부족'}</strong></div>
      </div>`}
      <details class="sa-form-insight-details">
        <summary>평가 이유와 집계 기준</summary>
        <p class="sa-form-insight-comparison">경쟁 모드 최신 1~20번째 경기와 21~40번째 경기를 비교합니다.</p>
        <p class="sa-form-insight-description">${description}</p>
        <p class="sa-form-insight-note">솔랭·파랭·토너먼트·클랜전(퀵매치 포함)의 폭파미션 기록 기준입니다. 이전 구간이 20경기보다 적으면 보유한 경기만 비교하며, 7경기 미만이면 표본 부족으로 표시합니다.</p>
      </details>
    </section>
  `;
}

export function buildPublicPlayerCardData(profile, profileView) {
  return {
    ...profile?.player,
    // Official summaries have their own provider scope, even if a selected window is absent.
    ...Object.fromEntries(['officialRecentKd', 'officialRecentWinRate', 'recentAssaultRate', 'recentSniperRate', 'recentSpecialRate']
      .filter(key => profile?.stats?.[key] !== undefined).map(key => [key, profile.stats[key]])),
    ...(profileView?.stats || {}),
    isCrew: Boolean(profile?.player?.isCrew),
    recentMatches: profileView?.matches || [],
    context: 'public'
  };
}

export function getVsComparisonData(primary, target, mode = 'current', context = 'public') {
  const previous = mode === 'previous';
  const label = context === 'public'
    ? (previous ? '전체 이전 20경기 · 21~40번째' : '전체 최근 20경기 · 1~20번째')
    : (previous ? '지난 시즌' : '이번 시즌');
  const select = profile => {
    // A missing previous window must not silently compare current against previous.
    const view = profile?.seasonViews?.[mode] || (!previous ? {stats:profile?.stats, matches:profile?.matches} : null);
    const count = Number(view?.stats?.totalMatchesCount ?? view?.matches?.length ?? 0);
    return { ...view, matches: view?.matches || [],
      stats: { ...(view?.stats || {}), totalMatchesCount: Number.isFinite(count) && count > 0 ? count : 0 } };
  };
  return { primaryView: select(primary), targetView: select(target), comparisonLabel: label };
}
