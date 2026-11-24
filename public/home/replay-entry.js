// The File objects stay in this page. Only canonical static UI/assets are loaded.
const hub = document.getElementById('homeHub');
const workspace = document.getElementById('homeReplayWorkspace');
const mount = workspace.querySelector('[data-home-replay-mount]');
const entry = document.querySelector('[data-home-replay-entry]');
const input = entry.querySelector('[data-home-replay-files]');
const drop = entry.querySelector('[data-home-replay-drop]');
const status = document.getElementById('homeReplayStatus');
const homeTitle = document.title;
const replayHash = '#replay-analysis';
let app = null, preparing = null, stylesheet = null, revision = 0;

function setStatus(text, error = false) {
  status.textContent = text;
  status.dataset.tone = error ? 'error' : '';
  status.setAttribute('role', error ? 'alert' : 'status');
}

function displayReplay(visible, focus = false) {
  hub.hidden = visible;
  workspace.hidden = !visible;
  document.body.dataset.homeView = visible ? 'replay' : 'home';
  if (stylesheet) stylesheet.media = visible ? 'all' : 'not all';
  document.title = visible ? '리플레이 분석실 - Tracking SA' : homeTitle;
  if (!visible) app?.pauseReplayPlayback();
  if (focus) {
    const target = visible ? mount.querySelector('#replayTitle') : hub.querySelector('input[name="n"]');
    if (visible) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
    (visible ? workspace.querySelector('.home-workspace-toolbar') : target).scrollIntoView({ block: 'start' });
  }
}

function loadStylesheet(href) {
  return new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.media = 'not all';
    const timer = setTimeout(() => { link.remove(); reject(new Error('STYLE_TIMEOUT')); }, 10000);
    link.onload = () => { clearTimeout(timer); stylesheet = link; resolve(); };
    link.onerror = () => { clearTimeout(timer); link.remove(); reject(new Error('STYLE_LOAD_FAILED')); };
    document.head.append(link);
  });
}

async function prepare() {
  if (app) return app;
  if (preparing) return preparing;
  preparing = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    let response;
    try { response = await fetch('/stats/sudden-attack/replay/', { signal: controller.signal, cache: 'no-cache' }); }
    finally { clearTimeout(timer); }
    if (!response.ok || new URL(response.url).origin !== location.origin) throw new Error('REPLAY_PAGE_UNAVAILABLE');
    const html = new DOMParser().parseFromString(await response.text(), 'text/html');
    const shell = html.querySelector('main.replay-shell');
    const css = [...html.querySelectorAll('link[rel="stylesheet"]')].find(link =>
      new URL(link.getAttribute('href'), response.url).pathname === '/stats/sudden-attack/replay/style.css');
    if (!shell?.querySelector('#replayFile') || !shell.querySelector('#replayComparison') || !css
      || shell.querySelector('script,iframe,object,embed')) throw new Error('REPLAY_PAGE_INVALID');
    // Keep one canonical replay markup source; never insert its header/scripts/config.
    const content = document.createElement('div');
    content.className = shell.className;
    content.append(...Array.from(shell.childNodes));
    mount.replaceChildren(content);
    await loadStylesheet(new URL(css.getAttribute('href'), response.url).href);
    app = await import('../stats/sudden-attack/replay/main.js?v=e800aff1d595');
    return app;
  })().catch(error => {
    if (!app) { mount.replaceChildren(); stylesheet?.remove(); stylesheet = null; }
    throw error;
  }).finally(() => { preparing = null; });
  return preparing;
}

async function open({ files = [], sample = false, fromHistory = false } = {}) {
  const current = ++revision;
  entry.setAttribute('aria-busy', 'true');
  setStatus('분석 화면을 준비하고 있습니다. 선택한 파일은 이 페이지에서 이어서 사용합니다.');
  try {
    const engine = await prepare();
    if (current !== revision) return;
    if (!fromHistory && location.hash !== replayHash) history.pushState({ ...history.state, homeReplay: true }, '', replayHash);
    displayReplay(true, true);
    if (sample) void engine.trySample('single');
    else if (files.length) engine.openReplayFiles(files);
    setStatus(files.length ? '선택한 파일을 다시 고르지 않고 분석실로 연결했습니다. 원본 JSON은 전송·저장하지 않습니다.'
      : '리플레이 분석실을 열었습니다. JSON 파일을 선택하거나 샘플로 체험해 보세요.');
  } catch {
    if (current !== revision) return;
    displayReplay(false);
    setStatus('분석 화면을 불러오지 못했습니다. 다시 선택하거나 아래 ‘리플레이 분석실 열기’를 이용해 주세요.', true);
  } finally {
    if (current === revision) { entry.setAttribute('aria-busy', 'false'); input.value = ''; }
  }
}

input.addEventListener('change', () => {
  const files = Array.from(input.files ?? []);
  if (files.length) void open({ files });
});
drop.addEventListener('dragover', event => { event.preventDefault(); drop.classList.add('dragging'); });
drop.addEventListener('dragleave', () => drop.classList.remove('dragging'));
drop.addEventListener('drop', event => {
  event.preventDefault(); drop.classList.remove('dragging');
  const files = Array.from(event.dataTransfer?.files ?? []);
  if (files.length) void open({ files });
});
hub.querySelectorAll('[data-home-replay-sample]').forEach(button => button.addEventListener('click', () => { void open({ sample: true }); }));
entry.querySelector('[data-home-replay-open]').addEventListener('click', event => {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault(); void open();
});
workspace.querySelector('[data-home-replay-close]').addEventListener('click', () => {
  revision++; entry.setAttribute('aria-busy', 'false');
  if (history.state?.homeReplay && location.hash === replayHash) history.back();
  else { history.replaceState(null, '', location.pathname + location.search); displayReplay(false, true); }
});
function restoreView() {
  revision++; entry.setAttribute('aria-busy', 'false');
  let anchor = null;
  try { anchor = document.getElementById(decodeURIComponent(location.hash.slice(1))); } catch {}
  if (location.hash === replayHash || (anchor && mount.contains(anchor))) {
    if (app) displayReplay(true, location.hash === replayHash);
    else void open({ fromHistory: true });
  }
  else displayReplay(false, !anchor);
}
window.addEventListener('popstate', restoreView);
if (location.hash === replayHash) void open({ fromHistory: true });
