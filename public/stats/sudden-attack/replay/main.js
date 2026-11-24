import { analyzeReplay, getDetailAnalysis, getKeyMoments, getReplayPlayers, parseReplayText, validateReplayFile } from './domain/replay-analyzer.js?v=5f9d9c6fc575';
import { NexonApiClient } from '../infra/nexon-api-client.js?v=04b8ade22090';
import { buildReplayPlayback } from './domain/replay-playback.js?v=bc9d6a4e5b8c';
import { mountReplayPlayback } from './ui/replay-playback.js?v=66338ab313fe';
import { createLazyReplayComparison } from './ui/replay-lazy-comparison.js?v=caa5127d0c52';
import { renderReplayResults, renderReplayPlayerOptions, renderReplayDetail } from './ui/replay-results-view.js?v=e2693ca45851';
import { mountReplayWorkspace } from './ui/replay-workspace.js?v=1d4f0f71fcf3';
import { createReplayWorkspaceSession } from './application/replay-workspace-session.js?v=fb2a3da34c64';
import { createReplayForecastController } from './ui/replay-forecast-controller.js?v=a8fe0a7a2632';
import { createReplayOutputController } from './ui/replay-output-controller.js?v=42134d7be0b3';
import { createReplayPreviewController } from './ui/replay-preview-controller.js?v=b878c2a04403';

const $ = (selector) => document.querySelector(selector);
const el = { drop: $('#replayDropzone'), file: $('#replayFile'), status: $('#replayFileStatus'), name: $('#replaySelectedFileName'),
  privacy: $('#localPrivacyState'), step: $('#playerStep'), player: $('#replayPlayer'), category: $('#replayCategory'),
  analyze: $('#analyzeReplayButton'), reset: $('#resetReplayButton'), results: $('#replayResults'), detail: $('#replayDetail') };
const session = createReplayWorkspaceSession();
let playback = null;
const currentAnalysis = () => session.currentAnalysis(el.player.value);
const scrollBehavior = matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
const forecast = createReplayForecastController({ apiClient: new NexonApiClient(), category: el.category, results: el.results,
  getReplay: () => session.replay, isSample: () => session.isSample, getAnalysis: currentAnalysis, status });
const outputs = createReplayOutputController({ results: el.results, getAnalysis: currentAnalysis,
  getPlayback: () => playback, isVisible: () => !$('#replaySinglePanel').hidden, location });
const previews = createReplayPreviewController({ results: el.results, shell: $('.replay-shell'), location,
  getAnalysis: currentAnalysis, getPlayback: () => playback, scrollBehavior });
const comparison = createLazyReplayComparison(document.querySelector('#replayComparison'));
const sampleNotice = $('#replaySampleNotice');
const comparisonSampleNotice = $('#replayComparisonSampleNotice');
const { setHelpExpanded, selectMode } = mountReplayWorkspace(document, { onCompare: () => { outputs.closeShare(); playback?.pause(); void comparison.open(); } });

globalThis.addEventListener('pagehide', event => {
  if (!event.persisted) {
    session.dispose(); forecast.dispose(); outputs.dispose(); previews.dispose();
    comparison.dispose(); clearPlayback();
  }
});
const messages = { FILE_REQUIRED: '분석할 파일을 선택해 주세요.', JSON_ONLY: 'JSON 파일만 사용할 수 있습니다.',
  FILE_TOO_LARGE: '파일이 너무 큽니다. 최대 2MB까지 분석할 수 있습니다.', EMPTY_FILE: '빈 파일입니다.',
  INVALID_JSON: 'JSON 형식을 읽을 수 없습니다.', UNSUPPORTED_REPLAY: '지원하는 병영수첩 리플레이 형식이 아닙니다.', PLAYER_NOT_FOUND: '플레이어를 찾을 수 없습니다.' };
const requestedNickname = new URLSearchParams(location.search).get('nickname')?.trim().toLocaleLowerCase('ko-KR') || '';

function status(text, tone = '') {
  el.status.textContent = text;
  el.status.dataset.tone = tone;
  el.status.setAttribute('role', tone === 'error' ? 'alert' : 'status');
}
// File acceptance is independent of optional OpenAPI lookup progress.
function showFileSelection(state, file = null) {
  el.drop.dataset.fileState = state;
  el.drop.setAttribute('aria-busy', String(state === 'reading'));
  el.drop.querySelector('.file-icon').textContent = ({idle:'JSON',reading:'…',ready:'✓',error:'!'})[state];
  el.drop.querySelector('[data-file-title]').textContent = ({idle:'리플레이 파일 선택',reading:'파일 확인 중…',ready:'파일 선택 완료',error:'파일을 읽지 못했습니다'})[state];
  $('#replayFileHelp').textContent = ({idle:'끌어놓거나 눌러서 선택 · JSON 최대 2MB',reading:'리플레이 형식과 플레이어 목록을 확인하고 있습니다.',ready:'아래에서 플레이어 선택 · 누르면 다른 파일로 변경',error:'아래 오류를 확인하고 눌러서 다시 선택해 주세요.'})[state];
  el.name.textContent = file?.name ? `선택한 파일: ${file.name}` : '';
  el.name.hidden = !file?.name;
}
function showPlayerNextStep() {
  const needsPlayer = !el.player.value;
  el.step.dataset.needsPlayer = String(needsPlayer);
  $('#replayFileHelp').textContent = needsPlayer
    ? '아래에서 플레이어 선택 · 누르면 다른 파일로 변경'
    : '선택한 파일로 분석합니다 · 누르면 다른 파일로 변경';
  $('#replayPlayerHelp').textContent = needsPlayer
    ? '다음 단계: 분석할 플레이어를 선택해 주세요.'
    : '플레이어 선택 완료 · 이 플레이어 분석 버튼을 눌러주세요.';
}
function clearPlayback() { playback?.dispose(); playback = null; el.results.querySelector('#replayPlayback')?.remove(); }
function clearResults() {
  session.clearAnalysis(); outputs.clear(); clearPlayback(); previews.clear();
  el.results.classList.add('hidden'); el.detail.classList.add('hidden');
}
function canAnalyze() { return session.canAnalyze(el.player.value); }
async function load(file, { sample = false } = {}) {
  showFileSelection('reading', file);
  const requestId = session.beginLoad({ sample });
  forecast.reset();
  sampleNotice.hidden = !sample;
  clearResults();
  el.step.classList.add('hidden');
  el.player.innerHTML = '';
  el.category.value = '';
  el.category.disabled = true;
  el.category.options[0].textContent = '자동 확인 중';
  el.analyze.disabled = true;
  let parsed;
  try {
    validateReplayFile(file); status('파일 구조를 확인하고 있습니다…');
    parsed = parseReplayText(await file.text());
    if (!session.isLoadCurrent(requestId)) return;
    session.acceptReplay(requestId, parsed);
    const players = getReplayPlayers(parsed);
    setHelpExpanded(false);
    el.player.innerHTML = renderReplayPlayerOptions(players, Number(parsed.replay_info.replayMatchSummaryInfo.winTeam));
    const requestedPlayer = players.find(player => player.nickName.toLocaleLowerCase('ko-KR') === requestedNickname);
    el.player.value = requestedPlayer?.nexonSN || '';
    showFileSelection('ready', file);
    showPlayerNextStep();
    el.step.classList.remove('hidden');
    el.analyze.disabled = !canAnalyze();
    if (!$('#replaySinglePanel').hidden) el.player.focus({ preventScroll: true });
    if (sample) {
      forecast.setSample();
      el.category.options[0].textContent = '샘플 · 전력 조회 없음';
      el.privacy.textContent = '가상의 샘플을 기기 안에서만 분석합니다. 넥슨·유료 AI 요청과 파일·결과 저장은 하지 않습니다.';
      status('샘플 체험 · 실제 경기 기록이 아닙니다.', 'success');
      return parsed;
    }
    el.privacy.textContent = '리플레이 파일은 기기 안에서만 처리합니다. 경기 ID와 닉네임을 넥슨 OpenAPI 조회에 사용하며 결과는 브라우저 메모리에만 보관합니다.';
    const forecastWindow = forecast.configureWindow(parsed);
    if (!forecastWindow.eligible) {
      el.category.options[0].textContent = forecastWindow.reason === 'expired' ? '7일 초과 · 전력 비교 제외' : '날짜 확인 불가 · 전력 비교 제외';
      status(forecast.message());
      return parsed;
    }
    forecast.startResolving();
    status(`${file.name} · ${players.length}명의 플레이어를 찾았습니다. 기본 분석은 바로 사용할 수 있습니다.`,'success');
  } catch (error) {
    if (!session.isLoadCurrent(requestId)) return;
    session.failLoad(requestId);
    sampleNotice.hidden = true;
    setHelpExpanded(true);
    el.file.value = '';
    el.player.innerHTML = '';
    el.category.disabled = false;
    el.analyze.disabled = true;
    showFileSelection('error', file);
    status(messages[error.message] || '파일을 분석하지 못했습니다.', 'error');
    return;
  }
  // Type lookup is optional enhancement; parsed players/basic analysis are already usable.
  await forecast.resolveType(parsed, file.name, () => session.isLoadCurrent(requestId));
  return parsed;
}

function render(a) {
  outputs.clear(); clearPlayback(); previews.clearReview();
  const playbackModel = buildReplayPlayback(session.replay);
  el.results.innerHTML = renderReplayResults(a, playbackModel, { sourceLabel: el.name.textContent });
  el.results.classList.remove('hidden');
  playback = mountReplayPlayback(el.results.querySelector('#replayPlayback'), playbackModel);
  void previews.show(a, playbackModel);
  if (!$('#replaySinglePanel').hidden) {
    el.results.focus({ preventScroll: true });
    el.results.scrollIntoView({ behavior: scrollBehavior });
  }
}
function detail(type) {
  const data = getDetailAnalysis(session.analysis, type);
  el.detail.innerHTML = renderReplayDetail(data);
  el.detail.classList.remove('hidden');
  el.detail.focus({ preventScroll: true });
  el.detail.scrollIntoView({ behavior: scrollBehavior, block: 'center' });
}
function filterRounds(filter, button) {
  const rounds = [...el.results.querySelectorAll('.round')];
  rounds.forEach((round) => round.classList.remove('is-collapsed'));
  el.results.querySelector('[data-expand-rounds]')?.classList.add('hidden');
  let visible = 0;
  for (const round of rounds) {
    const show = filter === 'all' || round.dataset[filter] === 'true';
    round.hidden = !show;
    if (show) visible += 1;
  }
  el.results.querySelectorAll('[data-round-filter]').forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
  const filterStatus = el.results.querySelector('.filter-status');
  if (filterStatus) filterStatus.textContent = `${visible}개 라운드 표시 중`;
}
function jumpToRound(roundNumber) {
  const allButton = el.results.querySelector('[data-round-filter="all"]');
  if (allButton) filterRounds('all', allButton);
  const round = el.results.querySelector(`#replayRound-${Number(roundNumber)}`);
  if (!round) return;
  round.focus({ preventScroll: true });
  round.scrollIntoView({ behavior: scrollBehavior, block: 'center' });
}
function jumpToMoment(index) {
  const analysis = currentAnalysis();
  if (!analysis || !Number.isSafeInteger(index) || index < 0) return;
  const moment = getKeyMoments(analysis)[index];
  if (!moment) return;
  if (!playback?.seekToMoment(moment, analysis.player.nexonSN)) { jumpToRound(moment.round); return; }
  const panel = el.results.querySelector('#replayPlayback');
  panel.focus({ preventScroll: true });
  panel.scrollIntoView({ behavior: scrollBehavior, block: 'start' });
}
el.file.addEventListener('change', () => load(el.file.files?.[0]));
el.drop.addEventListener('dragover', (e) => { e.preventDefault(); el.drop.classList.add('dragging'); });
el.drop.addEventListener('dragleave', () => el.drop.classList.remove('dragging'));
el.drop.addEventListener('drop', (e) => { e.preventDefault(); el.drop.classList.remove('dragging'); load(e.dataTransfer?.files?.[0]); });
el.player.addEventListener('change', () => { showPlayerNextStep(); clearResults(); el.analyze.disabled = !canAnalyze(); });
el.category.addEventListener('change', () => { clearResults(); forecast.prepare(); el.analyze.disabled = !canAnalyze(); });
el.analyze.addEventListener('click', () => {
  if (!canAnalyze()) return;
  const sourceReplay = session.replay;
  const playerId = el.player.value;
  const original = el.analyze.textContent;
  try {
    el.analyze.disabled = true;
    el.analyze.textContent = '리플레이 분석 중…';
    const next = analyzeReplay(sourceReplay, playerId);
    Object.assign(next, forecast.snapshot(), { isSample: session.isSample });
    session.setAnalysis(next);
    render(next);
  } catch (error) {
    status(messages[error.message] || '분석하지 못했습니다.', 'error');
  } finally {
    el.analyze.textContent = original;
    el.analyze.disabled = !canAnalyze();
  }
});
el.reset.addEventListener('click', () => {
  session.reset(); forecast.reset(); sampleNotice.hidden = true;
  el.file.value = ''; el.player.innerHTML = ''; el.category.value = '';
  showFileSelection('idle');
  delete el.step.dataset.needsPlayer;
  el.category.options[0].textContent = '자동 확인 중'; el.category.disabled = false;
  el.analyze.disabled = true; el.step.classList.add('hidden'); clearResults(); setHelpExpanded(true);
  status('아직 선택한 파일이 없습니다.');
  el.privacy.textContent = '리플레이 파일은 전송하거나 저장하지 않습니다. 경기 유형과 전력 비교를 위해 경기 ID와 닉네임을 넥슨 OpenAPI 조회에 사용합니다.';
});
export async function trySample(mode) {
  const requestId = session.beginSample();
  try {
    const { createReplaySamples } = await import('./domain/replay-samples.js?v=a6c959677aa6');
    if (!session.isSampleCurrent(requestId)) return;
    const samples = createReplaySamples();
    selectMode(mode);
    if (mode === 'compare') {
      comparisonSampleNotice.hidden = false;
      await comparison.loadFiles(samples);
      if (session.isSampleCurrent(requestId)) comparison.selectPlayer('sample-player');
    } else {
      const parsed = await load(samples[0], { sample: true });
      if (!parsed || !session.isSampleCurrent(requestId)) return;
      el.player.value = 'sample-player';
      showPlayerNextStep();
      el.analyze.disabled = !canAnalyze();
      el.analyze.click();
    }
  } catch {
    if (session.isSampleCurrent(requestId)) status('샘플을 불러오지 못했습니다. 다시 시도하거나 JSON 파일을 선택해 주세요.', 'error');
  }
}
// Home lazily mounts this same page UI before passing the in-memory Files here.
// Normal replay-page file inputs and all analysis/validation paths stay shared.
export function openReplayFiles(files) {
  const selected = Array.from(files ?? []);
  if (selected.length > 1) {
    session.cancelSample(); session.cancelLoad(); forecast.invalidate();
    comparisonSampleNotice.hidden = true;
    selectMode('compare');
    void comparison.loadFiles(selected);
  } else if (selected.length === 1) {
    selectMode('single');
    void load(selected[0]);
  }
}
export function pauseReplayPlayback() { outputs.closeShare(); playback?.pause(); }

document.querySelectorAll('[data-replay-sample]').forEach(button => button.addEventListener('click', () => { void trySample(button.dataset.replaySample); }));
document.querySelectorAll('[data-replay-mode]').forEach(button => button.addEventListener('click', () => { session.cancelSample(); }));
document.querySelector('[data-comparison-files]').addEventListener('change', () => { session.cancelSample(); comparisonSampleNotice.hidden = true; });
document.querySelector('[data-comparison-clear]').addEventListener('click', () => { session.cancelSample(); comparisonSampleNotice.hidden = true; });
el.results.addEventListener('click', (e) => {
  const printButton = e.target.closest('[data-print-replay]');
  if (printButton) void outputs.print(printButton);
  const shareButton = e.target.closest('[data-share-replay], [data-share-playback]');
  if (shareButton) void outputs.share(shareButton);
  const filterButton = e.target.closest('[data-round-filter]');
  if (filterButton) filterRounds(filterButton.dataset.roundFilter, filterButton);
  const reviewJump = e.target.closest('[data-review-jump]');
  if (reviewJump) previews.jumpToReview(reviewJump.dataset.reviewJump);
  const playbackJump = e.target.closest('[data-review-playback]');
  if (playbackJump) previews.jumpToPlayback(playbackJump.dataset.reviewPlayback);
  const roundJump = e.target.closest('[data-round-jump]');
  if (roundJump) jumpToRound(roundJump.dataset.roundJump);
  const momentJump = e.target.closest('[data-key-moment]');
  if (momentJump) jumpToMoment(Number(momentJump.dataset.keyMoment));
  const expandRounds = e.target.closest('[data-expand-rounds]');
  if (expandRounds) {
    el.results.querySelectorAll('.round.is-collapsed').forEach((round) => round.classList.remove('is-collapsed'));
    expandRounds.classList.add('hidden');
    const filterStatus = el.results.querySelector('.filter-status');
    if (filterStatus) filterStatus.textContent = `${session.analysis.rounds.length}개 라운드 표시 중`;
  }
  const detailButton = e.target.closest('[data-type]');
  if (detailButton) {
    el.results.querySelectorAll('[data-type]').forEach((item) => item.setAttribute('aria-pressed', String(item === detailButton)));
    detail(detailButton.dataset.type);
  }
  if (e.target.closest('[data-new]')) {
    el.reset.click();
    el.drop.scrollIntoView({ behavior: scrollBehavior });
    el.file.click();
  }
});
