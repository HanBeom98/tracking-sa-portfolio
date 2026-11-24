import { getReplayPlayers } from '../domain/replay-analyzer.js?v=5f9d9c6fc575';
import { buildTeamStrengthForecast, getReplayForecastWindow, loadTeamStrengthProfiles, resolveReplayCategory } from '../domain/team-strength-forecast.js?v=137e10f7cbeb';
import { renderReplayForecast } from './replay-results-view.js?v=e2693ca45851';

// Optional forecast work owns its cache and revision, independently of basic
// analysis and playback. Invalidating never launches a replacement request.
export function createReplayForecastController({ apiClient, category, results, getReplay, isSample, getAnalysis, status }) {
  const strengthCache = new Map();
  let revision = 0, disposed = false, state = 'idle', value = null;
  let progress = null, unavailableMessage = '', cutoffDate = null;
  function message() {
    if (state === 'resolving') return '기본 분석은 바로 사용할 수 있습니다. 경기 유형을 확인하고 있습니다…';
    if (state === 'loading') return progress?.total
      ? `기본 분석은 바로 사용할 수 있습니다. 전력 정보 확인 중 · ${progress.completed}/${progress.total}명`
      : '기본 분석은 바로 사용할 수 있습니다. 전력 정보를 확인하고 있습니다…';
    return unavailableMessage;
  }
  function snapshot() {
    return { forecast: value, forecastUnavailableMessage: message(), forecastPending: state === 'resolving' || state === 'loading' };
  }
  function updatePanel() {
    const analysis = getAnalysis();
    if (disposed || !analysis) return;
    Object.assign(analysis, snapshot());
    const panel = results.querySelector('#replayForecast');
    if (panel) panel.outerHTML = renderReplayForecast(analysis.forecast, analysis.forecastUnavailableMessage, analysis.forecastPending);
  }
  function showProgress(next) {
    progress = next;
    if (!progress?.total) return;
    const complete = progress.completed === progress.total;
    status(complete
      ? `전력 정보 확인 완료 · ${progress.successful}/${progress.total}명 조회 성공`
      : `전력 정보 확인 중 · ${progress.completed}/${progress.total}명`, complete ? 'success' : '');
    updatePanel();
  }
  function prepare() {
    const ticket = ++revision, source = getReplay(), selectedCategory = category.value;
    value = null; progress = null;
    if (disposed || !source || !selectedCategory || isSample()) {
      state = 'idle'; updatePanel(); return;
    }
    const current = () => !disposed && ticket === revision && source === getReplay()
      && selectedCategory === category.value && !isSample();
    state = 'loading'; updatePanel();
    const players = getReplayPlayers(source);
    const winTeam = Number(source.replay_info.replayMatchSummaryInfo.winTeam);
    void loadTeamStrengthProfiles(players, apiClient, selectedCategory, {
      cache: strengthCache, concurrency: 3, cutoffDate, isCurrent: current,
      onProgress: next => { if (current()) showProgress(next); },
    }).then(profiles => buildTeamStrengthForecast(profiles, winTeam, selectedCategory)).catch(() => null).then(next => {
      if (!current()) return;
      value = next; state = 'ready'; updatePanel();
    });
  }
  return {
    snapshot, message, prepare,
    reset() {
      revision++; strengthCache.clear();
      value = null; state = 'idle'; progress = null; unavailableMessage = ''; cutoffDate = null;
    },
    invalidate() { revision++; },
    setSample() { unavailableMessage = '샘플 체험은 가상의 경기 기록입니다. 외부 전력 조회 없이 기기 안에서만 분석합니다.'; },
    configureWindow(replay) {
      const window = getReplayForecastWindow(replay);
      cutoffDate = window.matchDate;
      unavailableMessage = window.reason === 'expired'
        ? '당시 전력 비교는 경기 후 7일 이내 리플레이만 지원합니다. 라운드 분석은 계속 확인할 수 있습니다.'
        : window.eligible ? '' : '경기 날짜를 확인할 수 없어 전력 비교를 제공하지 않습니다. 라운드 분석은 계속 확인할 수 있습니다.';
      return window;
    },
    startResolving() { state = 'resolving'; },
    async resolveType(source, fileName, isLoadCurrent) {
      const ticket = revision;
      let selectedCategory = '';
      try { selectedCategory = await resolveReplayCategory(source, apiClient, fileName); } catch {}
      if (disposed || ticket !== revision || !isLoadCurrent() || source !== getReplay() || isSample()) return;
      category.value = selectedCategory;
      category.disabled = Boolean(selectedCategory);
      if (selectedCategory) prepare();
      else {
        state = 'idle';
        unavailableMessage = '경기 유형을 자동 확인하지 못했습니다. 전력 비교 기준을 선택해 주세요. 기본 분석과 재생은 계속 사용할 수 있습니다.';
        updatePanel(); status(unavailableMessage);
      }
    },
    dispose() { disposed = true; revision++; strengthCache.clear(); },
  };
}
