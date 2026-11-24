export const MEASUREMENT_VERSION = 'v1';
export const MEASUREMENT_SCOPE_KEY = 'tracking_sa_measurement_scope_v1';
export const MEASUREMENT_SCOPE_PARAM = 'measurement_scope';
export const MAX_PENDING_EVENTS = 100;
export const EVENT_TTL_MS = 60_000;

const values = (...items) => (value) => items.includes(value);
const entryPoint = values('input_button', 'input_enter', 'recent', 'favorite', 'direct_link', 'history', 'in_page', 'refresh');
const source = values('network', 'fresh_cache', 'stale_cache', 'none');
const outcome = values('success', 'partial', 'failure', 'superseded', 'cancelled');
const duration = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER;
const errorCode = values('timeout', 'network', 'invalid_response', 'http', 'rate_limited', 'not_found', 'permission', 'same_player', 'unknown');
const vsSource = values('modal', 'favorite_chip');
const shareSource = values('image_button', 'link_button');
const schemas = {
  sa_search_start: { entry_point: entryPoint },
  sa_search_first_result: { entry_point: entryPoint, result_source: source, duration_ms: duration },
  sa_search_finish: {
    entry_point: entryPoint, outcome, result_shown: values(0, 1), result_source: source,
    revalidation: values('not_needed', 'success', 'failure', 'interrupted'), duration_ms: duration,
  },
  sa_summary_view: { entry_point: entryPoint },
  sa_favorite_change: {
    action: values('add', 'remove'), action_source: values('result_button', 'favorite_chip'),
    persistence: values('unknown', 'persisted', 'page_only'),
  },
  sa_vs_start: { vs_source: vsSource },
  sa_vs_finish: { vs_source: vsSource, outcome: values('success', 'failure', 'superseded', 'cancelled'), result_source: source, duration_ms: duration },
  sa_share_start: { share_source: shareSource },
  sa_share_finish: {
    share_source: shareSource, method: values('native', 'clipboard_image', 'clipboard_link', 'png_download'),
    outcome: values('success', 'failure', 'cancelled', 'download_requested'), duration_ms: duration,
  },
};

// Only known fields are read. Raw URLs, names, errors and caller IDs are ignored.
function validatedFields(name, input) {
  if (!Object.hasOwn(schemas, name) || !input || typeof input !== 'object') return null;
  const result = {};
  for (const [field, valid] of Object.entries(schemas[name])) {
    const value = input[field];
    if (!valid(value)) return null;
    result[field] = field === 'duration_ms' ? Math.round(value) : value;
  }
  if (['failure', 'partial'].includes(result.outcome)) {
    if (!errorCode(input.error_code)) return null;
    result.error_code = input.error_code;
  }
  if (name === 'sa_search_first_result' && result.result_source === 'none') return null;
  if (name === 'sa_search_finish') {
    if ((result.result_shown === 0) !== (result.result_source === 'none')) return null;
    if (result.outcome === 'success' && (result.result_shown !== 1 || !['not_needed', 'success'].includes(result.revalidation))) return null;
    if (result.outcome === 'partial' && (result.result_shown !== 1 || result.result_source !== 'stale_cache' || result.revalidation !== 'failure')) return null;
    if (result.outcome === 'failure' && (result.result_shown !== 0 || result.revalidation !== 'not_needed')) return null;
    if (result.revalidation === 'success' && result.result_source !== 'network') return null;
  }
  if (name === 'sa_vs_finish' && result.outcome === 'success' && result.result_source === 'none') return null;
  if (name === 'sa_share_finish') {
    if ((result.outcome === 'download_requested') !== (result.method === 'png_download' && result.outcome !== 'failure')) return null;
    if (result.outcome === 'cancelled' && result.method !== 'native') return null;
    if ((result.share_source === 'link_button') !== (result.method === 'clipboard_link')) return null;
  }
  return result;
}

export function getPublicMeasurementContext(windowRef, documentRef) {
  try {
    const url = new URL(windowRef.location.href);
    if (!['http:', 'https:'].includes(url.protocol) || url.pathname.replace(/\/$/, '') !== '/stats/sudden-attack') return null;
    let pageReferrer = '';
    try {
      const referrer = new URL(documentRef.referrer);
      if (['http:', 'https:'].includes(referrer.protocol)) pageReferrer = referrer.origin + '/';
    } catch { /* Empty or malformed referrers carry no measurement context. */ }
    return {
      page_location: url.origin + '/stats/sudden-attack/',
      page_referrer: pageReferrer,
      page_title: '서든어택 전적 검색 | Tracking SA',
    };
  } catch { return null; }
}

export function getMeasurementScope(windowRef) {
  try {
    const url = new URL(windowRef.location.href);
    if (!['trackingsa.com', 'www.trackingsa.com'].includes(url.hostname)) return 'verification';
    // A fixed, page-scoped opt-in permits repeatable checks without a console or persistent setting.
    if (url.pathname.replace(/\/$/, '') === '/stats/sudden-attack'
      && url.searchParams.getAll(MEASUREMENT_SCOPE_PARAM).length === 1
      && url.searchParams.get(MEASUREMENT_SCOPE_PARAM) === 'verification') return 'verification';
    return windowRef.sessionStorage?.getItem(MEASUREMENT_SCOPE_KEY) === 'verification' ? 'verification' : 'production';
  } catch { return 'production'; }
}

export function createProductAnalytics({ getPageContext, trafficScope = 'production', now = () => performance.now() } = {}) {
  const contexts = new WeakMap();
  const pending = [];
  let transport = null;
  let disabled = false;
  let flushing = false;
  let sent = 0;
  let dropped = 0;
  let duplicates = 0;

  function expire() {
    const time = now();
    while (pending.length && time - pending[0].createdAt >= EVENT_TTL_MS) {
      pending.shift();
      dropped += 1;
    }
  }

  function flush() {
    if (flushing || disabled || !transport) return;
    flushing = true;
    try {
      expire();
      while (pending.length) {
        // Consume before invoking transport: exceptions and re-entry must not retry it.
        const event = pending.shift();
        try { transport(event.name, { ...event.fields }); sent += 1; }
        catch { dropped += 1; }
      }
    } finally { flushing = false; }
  }

  return Object.freeze({
    createContext() {
      const context = Object.freeze({});
      contexts.set(context, new Set());
      return context;
    },
    track(name, input, context) {
      try {
        if (disabled) return false;
        const seen = contexts.get(context);
        if (!seen) return false;
        const fields = validatedFields(name, input);
        const page = getPageContext?.();
        if (!fields || !page) return false;
        if (seen.has(name)) { duplicates += 1; return false; }
        // Context is built internally, never merged from caller page parameters.
        const url = new URL(page.page_location);
        if (url.search || url.hash || url.username || url.password || url.pathname !== '/stats/sudden-attack/') return false;
        const safePage = {
          page_location: url.origin + '/stats/sudden-attack/',
          page_referrer: '',
          page_title: '서든어택 전적 검색 | Tracking SA',
        };
        try {
          const referrer = new URL(page.page_referrer);
          if (['http:', 'https:'].includes(referrer.protocol)) safePage.page_referrer = referrer.origin + '/';
        } catch { /* Do not forward invalid referrers. */ }
        if (!['http:', 'https:'].includes(url.protocol)) return false;
        expire();
        const createdAt = now();
        if (!Number.isFinite(createdAt)) return false;
        seen.add(name);
        if (pending.length >= MAX_PENDING_EVENTS) { pending.shift(); dropped += 1; }
        pending.push({ name, createdAt, fields: {
          ...fields, ...safePage, measurement_version: MEASUREMENT_VERSION,
          traffic_scope: trafficScope === 'verification' ? 'verification' : 'production',
          ...(trafficScope === 'verification' ? { debug_mode: true } : {}),
        } });
        flush();
        return true;
      } catch { return false; }
    },
    setTransport(next) {
      try {
        if (disabled || transport || typeof next !== 'function') return false;
        transport = next;
        flush();
        return true;
      } catch { return false; }
    },
    disable() {
      disabled = true;
      dropped += pending.length;
      pending.length = 0;
      transport = null;
    },
    getStatus() {
      try { expire(); } catch { /* Status must not affect the product. */ }
      return Object.freeze({ pending: pending.length, sent, dropped, duplicates, ready: Boolean(transport), disabled });
    },
  });
}

const clients = new WeakMap();
export function getProductAnalytics(windowRef = globalThis.window, documentRef = globalThis.document) {
  if (!windowRef || (typeof windowRef !== 'object' && typeof windowRef !== 'function')) return null;
  if (!clients.has(windowRef)) clients.set(windowRef, createProductAnalytics({
    getPageContext: () => getPublicMeasurementContext(windowRef, documentRef),
    trafficScope: getMeasurementScope(windowRef),
  }));
  return clients.get(windowRef);
}
