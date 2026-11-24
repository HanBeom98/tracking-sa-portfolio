import { NOTICE_DISPLAY_LIMIT, getNoticeCreatedAtMs, isNoticeDateActive } from '../board/domain/notice-policy.js';
import { HOME_NOTICE_CACHE_POLICY, getHomeNoticeCacheKey, isContentCacheFresh } from '../board/domain/content-cache-policy.js';
import { requestJson, withRequestDeadline, RequestFailure, requestFailureCode, recordOperation } from '../shared/http-request.js';
export const HOME_NOTICE_CACHE_TTL_MS = HOME_NOTICE_CACHE_POLICY.ttlMs;

export function readHomeNoticeCache({ projectId, storage, nowMs = Date.now() } = {}) {
  if (!projectId) return null;
  try {
    if (storage === undefined) storage = globalThis.localStorage;
    if (!storage) return null;
    const cached = JSON.parse(storage.getItem(getHomeNoticeCacheKey(projectId)) || 'null');
    if (!cached || !Array.isArray(cached.notices) || !cached.notices.length || !isContentCacheFresh(cached, nowMs)) {
      storage.removeItem(getHomeNoticeCacheKey(projectId));
      return null;
    }
    return cached.notices.filter((notice) => isNoticeDateActive(notice.createdAt, nowMs));
  } catch {
    return null;
  }
}

export function writeHomeNoticeCache(notices, {
  projectId,
  storage,
  nowMs = Date.now(),
  ttlMs = HOME_NOTICE_CACHE_TTL_MS
} = {}) {
  if (!projectId || !Array.isArray(notices)) return false;
  try {
    if (storage === undefined) storage = globalThis.localStorage;
    if (!storage) return false;
    storage.setItem(getHomeNoticeCacheKey(projectId), JSON.stringify({
      expiresAt: nowMs + ttlMs,
      notices
    }));
    return true;
  } catch {
    return false;
  }
}

export function normalizeFirestoreNotice(result) {
  const document = result?.document;
  if (!document) return null;

  const fields = document.fields || {};
  const id = String(document.name || '').split('/').pop();
  const title = fields.title?.stringValue || '';
  const category = fields.category?.stringValue || '';
  const createdAt = getNoticeCreatedAtMs(fields.createdAt?.timestampValue);

  if (!id || !title || category !== 'notice' || !Number.isFinite(createdAt)) return null;
  return { id, title, category, createdAt };
}

export function getActiveHomeNotices(results = [], nowMs = Date.now()) {
  return results
    .map(normalizeFirestoreNotice)
    .filter((notice) => notice && isNoticeDateActive(notice.createdAt, nowMs))
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, NOTICE_DISPLAY_LIMIT);
}

export function getFirestoreNoticeEndpoint(config = globalThis.window?.FIREBASE_CONFIG) {
  const projectId = String(config?.projectId || '').trim();
  const apiKey = String(config?.apiKey || '').trim();
  if (!projectId || !apiKey) return '';
  return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents:runQuery?key=${encodeURIComponent(apiKey)}`;
}

export async function getFirebaseAppCheckToken(firebaseApp = globalThis.firebase) {
  try {
    if (!firebaseApp?.appCheck) return '';
    const result = await firebaseApp.appCheck().getToken(false);
    return String(result?.token || '');
  } catch {
    return '';
  }
}

export async function fetchHomeNotices({
  config,
  fetchImpl = fetch,
  nowMs = Date.now(),
  storage,
  firebaseApp = globalThis.firebase,
  timeoutMs = 10000,
} = {}) {
  const endpoint = getFirestoreNoticeEndpoint(config);
  if (!endpoint) return [];
  const projectId = String(config?.projectId || '').trim();
  const cached = readHomeNoticeCache({ projectId, storage, nowMs });
  if (cached) return cached;
  const startedAt = Date.now();
  try {
    const notices = await withRequestDeadline(async (signal) => {
      const appCheckToken = await getFirebaseAppCheckToken(firebaseApp);
      const { response, data } = await requestJson(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(appCheckToken ? { 'X-Firebase-AppCheck': appCheckToken } : {})
        },
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId: 'board_posts' }],
            where: {
              fieldFilter: {
                field: { fieldPath: 'category' },
                op: 'EQUAL',
                value: { stringValue: 'notice' }
              }
            },
            orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' }],
            limit: NOTICE_DISPLAY_LIMIT
          }
        })
      }, { fetchImpl, timeoutMs, signal });

      if (!response.ok) throw new RequestFailure('HTTP_ERROR', { status: response.status });
      return getActiveHomeNotices(data, nowMs);
    }, { timeoutMs });
    writeHomeNoticeCache(notices, { projectId, storage, nowMs });
    recordOperation('home_notice', { durationMs: Date.now() - startedAt });
    return notices;
  } catch (error) {
    recordOperation('home_notice', { code: requestFailureCode(error), status: error.status, durationMs: Date.now() - startedAt });
    throw error;
  }
}

export function updateHomeNoticeMarquee(link, viewport = globalThis.window) {
  const text = link?.querySelector?.('[data-home-notice-text]');
  if (!link || !text) return;

  const isMobile = viewport?.matchMedia?.('(max-width: 640px)').matches;
  const overflow = Math.max(0, Number(text.scrollWidth) - Number(link.clientWidth));
  const shouldMove = Boolean(isMobile && overflow > 4);
  link.classList.toggle('is-marquee', shouldMove);
  link.style.setProperty('--notice-marquee-distance', `${overflow}px`);
  link.style.setProperty('--notice-marquee-duration', `${Math.max(10, Math.min(24, 8 + overflow / 28))}s`);
}

export function mountHomeNoticeTicker(root, notices, viewport = globalThis.window) {
  if (!root || !notices.length) return;

  const link = root.querySelector('[data-home-notice-link]');
  const controls = root.querySelector('[data-home-notice-controls]');
  const previous = root.querySelector('[data-home-notice-prev]');
  const next = root.querySelector('[data-home-notice-next]');
  const text = root.querySelector('[data-home-notice-text]');
  if (!link || !text) return;

  let index = 0;
  const refreshMarquee = () => updateHomeNoticeMarquee(link, viewport);
  const render = () => {
    const notice = notices[index];
    text.textContent = notice.title;
    link.href = `/board/post?id=${encodeURIComponent(notice.id)}`;
    link.setAttribute('aria-label', `공지사항: ${notice.title}`);
    link.classList.remove('is-marquee');
    (viewport?.requestAnimationFrame || ((callback) => callback()))(refreshMarquee);
  };

  previous?.addEventListener('click', () => {
    index = (index - 1 + notices.length) % notices.length;
    render();
  });
  next?.addEventListener('click', () => {
    index = (index + 1) % notices.length;
    render();
  });

  if (controls) controls.hidden = notices.length < 2;
  root.hidden = false;
  viewport?.addEventListener?.('resize', refreshMarquee, { passive: true });
  render();
}

async function initializeHomeNoticeTicker() {
  const root = document.querySelector('[data-home-notices]');
  if (!root) return;

  try {
    const notices = await fetchHomeNotices({ config: window.FIREBASE_CONFIG });
    mountHomeNoticeTicker(root, notices);
  } catch {
    // fetchHomeNotices already records a redacted failure event.
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeHomeNoticeTicker, { once: true });
  } else {
    initializeHomeNoticeTicker();
  }
}
