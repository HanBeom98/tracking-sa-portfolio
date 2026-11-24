import { requestJson, withRequestDeadline, RequestFailure, requestFailureCode, recordOperation } from '../shared/http-request.js';
import { MAX_SOOP_PAGES, selectSoopBroadcasts } from './soop-broadcasts.js';

const DEFAULT_ENDPOINT = '/api/soop-live';

export function getSoopLiveEndpoint(globalWindow = typeof window !== 'undefined' ? window : null) {
  const apiBaseUrl = String(globalWindow?.runtimeConfig?.apiBaseUrl || '').replace(/\/$/, '');
  return apiBaseUrl ? `${apiBaseUrl}/soop-live` : DEFAULT_ENDPOINT;
}

function getSoopLiveMode() {
  return typeof window !== 'undefined' && window.runtimeConfig?.soopLiveMode === 'paged' ? 'paged' : 'legacy';
}

export async function fetchSoopLive({ endpoint, fetchImpl = fetch, timeoutMs = 15000, mode = 'legacy' }) {
  return withRequestDeadline(async signal => {
    const read = async page => {
      const url = page === null ? endpoint : `${endpoint}${endpoint.includes('?') ? '&' : '?'}page=${page}`;
      const { response, data } = await requestJson(url, { headers: { Accept: 'application/json' } }, {
        // The outer signal owns the total budget. Do not start shorter per-page
        // timers near that deadline: they can expire first and fan out more work.
        fetchImpl, signal, timeoutMs: page === null ? timeoutMs : 10000,
      });
      if (!response.ok) throw new RequestFailure(response.status === 504 ? 'REQUEST_TIMEOUT' : 'HTTP_ERROR', {
        status: response.status, requestId: response.headers.get('X-Request-ID') || '',
      });
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new RequestFailure('INVALID_RESPONSE');
      if (data.status === 'error') throw new RequestFailure('HTTP_ERROR');
      if (page !== null && data.status !== 'pending' && (data.status !== 'ready' || data.mode !== 'page'
        || data.page !== page || !Number.isInteger(data.pageCount) || data.pageCount < 1 || data.pageCount > MAX_SOOP_PAGES
        || !Array.isArray(data.broadcasts) || data.broadcasts.length > 60)) throw new RequestFailure('INVALID_RESPONSE');
      return data;
    };
    const first = await read(mode === 'paged' ? 1 : null);
    if (mode !== 'paged' || first.status === 'pending') return first;
    const pages = new Array(first.pageCount);
    pages[0] = first;
    let nextPage = 2, partialFailures = 0;
    await Promise.all(Array.from({ length: Math.min(4, first.pageCount - 1) }, async () => {
      while (nextPage <= first.pageCount && !signal.aborted) {
        const pageNo = nextPage++;
        try {
          const page = await read(pageNo);
          if (page.status !== 'ready') throw new RequestFailure('INVALID_RESPONSE');
          pages[pageNo - 1] = page;
        } catch (error) {
          if (signal.aborted) throw error;
          partialFailures++;
        }
      }
    }));
    const available = pages.filter(Boolean);
    return {
      status: 'ready', broadcasts: selectSoopBroadcasts(available),
      stale: available.some(page => page.stale), partialFailures, updatedAt: first.updatedAt,
    };
  }, { timeoutMs });
}

export function escapeSoopText(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

export function formatSoopViewerCount(value) {
  const count = Math.max(0, Number(value) || 0);
  return new Intl.NumberFormat('ko-KR').format(count);
}

function renderPlaceholder(grid, { title, description, tone = 'pending' }) {
  grid.innerHTML = `
    <article class="live-message ${tone}">
      <div class="live-preview-icon" aria-hidden="true">${tone === 'error' ? '!' : '●'}</div>
      <h3>${escapeSoopText(title)}</h3>
      <p>${escapeSoopText(description)}</p>
    </article>`;
}

export function renderSoopBroadcasts(grid, broadcasts) {
  grid.innerHTML = broadcasts.map((broadcast) => {
    const title = escapeSoopText(broadcast.title || '제목 없는 방송');
    const streamer = escapeSoopText(broadcast.streamerName || 'SOOP 스트리머');
    const watchUrl = escapeSoopText(broadcast.watchUrl);
    const thumbnail = broadcast.thumbnailUrl
      ? `<img class="live-card-thumb" src="${escapeSoopText(broadcast.thumbnailUrl)}" alt="" loading="lazy" referrerpolicy="no-referrer">`
      : '<div class="live-card-thumb live-card-thumb-fallback" aria-hidden="true">SOOP</div>';
    return `
      <a class="live-card" href="${watchUrl}" target="_blank" rel="noopener noreferrer" aria-label="${streamer} 방송 보기">
        <div class="live-card-media">
          ${thumbnail}
          <span class="live-badge">LIVE</span>
          <span class="live-viewers">${formatSoopViewerCount(broadcast.viewerCount)}명</span>
        </div>
        <div class="live-card-body">
          <strong class="live-streamer">${streamer}</strong>
          <span class="live-card-title">${title}</span>
        </div>
      </a>`;
  }).join('');
}

export function setupSoopLiveDisclosure(root, broadcastCount, viewport = typeof window !== 'undefined' ? window : null) {
  const actions = root?.querySelector?.('[data-soop-live-actions]');
  const toggle = root?.querySelector?.('[data-soop-live-toggle]');
  if (!actions || !toggle) return;

  const hasMobileOverflow = broadcastCount > 3;
  const hasDesktopOverflow = broadcastCount > 6;
  root.dataset.hasMobileOverflow = String(hasMobileOverflow);
  root.dataset.hasDesktopOverflow = String(hasDesktopOverflow);
  root.dataset.expanded = 'false';
  actions.hidden = !hasMobileOverflow;

  const updateLabel = () => {
    const expanded = root.dataset.expanded === 'true';
    const mobile = viewport?.matchMedia?.('(max-width: 640px)').matches;
    const initialCount = mobile ? 3 : 6;
    const hiddenCount = Math.max(0, broadcastCount - initialCount);
    toggle.hidden = !expanded && hiddenCount === 0;
    toggle.textContent = expanded ? '방송 접기' : `방송 더 보기 (${hiddenCount})`;
    toggle.setAttribute('aria-expanded', String(expanded));
  };

  toggle.addEventListener('click', () => {
    root.dataset.expanded = String(root.dataset.expanded !== 'true');
    updateLabel();
  });
  viewport?.matchMedia?.('(max-width: 640px)').addEventListener?.('change', updateLabel);
  updateLabel();
}

export async function loadSoopLive({ root, fetchImpl = fetch, endpoint = getSoopLiveEndpoint(), viewport = typeof window !== 'undefined' ? window : null, timeoutMs = 15000, mode = getSoopLiveMode() } = {}) {
  if (!root) return;
  const grid = root.querySelector('[data-soop-live-grid]');
  const meta = root.querySelector('[data-soop-live-meta]');
  if (!grid) return;

  root.dataset.state = 'loading';
  meta && (meta.textContent = '라이브 방송 확인 중');
  renderPlaceholder(grid, { title: 'SOOP 라이브 불러오는 중', description: '현재 방송 중인 서든어택 스트리머를 확인하고 있습니다.' });

  const startedAt = Date.now();
  try {
    const payload = await fetchSoopLive({ endpoint, fetchImpl, timeoutMs, mode });
    if (payload.status === 'pending') {
      root.dataset.state = 'pending';
      meta && (meta.textContent = '공식 API 연동 준비 중');
      renderPlaceholder(grid, { title: 'SOOP Developers 승인 대기', description: payload.message || 'API 승인 후 실제 라이브 카드가 표시됩니다.' });
      return;
    }
    if (payload.status === 'error') throw new RequestFailure('HTTP_ERROR');
    const broadcasts = Array.isArray(payload.broadcasts) ? payload.broadcasts.filter((item) => item?.watchUrl) : [];
    root.dataset.state = broadcasts.length ? 'ready' : 'empty';
    meta && (meta.textContent = payload.stale ? '최근 확인된 방송' : `현재 ${broadcasts.length}개 방송`);
    if (!broadcasts.length) {
      renderPlaceholder(grid, { title: '현재 진행 중인 방송이 없습니다', description: '새로운 서든어택 방송이 시작되면 이곳에 자동으로 표시됩니다.' });
      return;
    }
    renderSoopBroadcasts(grid, broadcasts);
    setupSoopLiveDisclosure(root, broadcasts.length, viewport);
  } catch (error) {
    recordOperation('soop_live', { code: requestFailureCode(error), status: error?.status || 0, requestId: error?.requestId || '', durationMs: Date.now() - startedAt });
    root.dataset.state = 'error';
    meta && (meta.textContent = '일시적인 연결 오류');
    renderPlaceholder(grid, { title: '라이브 정보를 불러오지 못했습니다', description: error?.code === 'REQUEST_TIMEOUT' ? '응답 대기 시간이 초과되었습니다. 잠시 후 다시 확인해 주세요.' : '잠시 후 다시 확인해 주세요.', tone: 'error' });
  }
}

if (typeof document !== 'undefined') {
  const root = document.querySelector('[data-soop-live-root]');
  if (root) loadSoopLive({ root });
}
