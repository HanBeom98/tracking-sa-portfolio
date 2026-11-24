import { BOARD_LIST_CACHE_POLICY, isContentCacheFresh, isHomeNoticeCacheKey } from '../domain/content-cache-policy.js';
export const BOARD_LIST_CACHE_TTL_MS = BOARD_LIST_CACHE_POLICY.ttlMs;

function getCacheKey(category) {
  return `${BOARD_LIST_CACHE_POLICY.prefix}${category || "all"}`;
}

export function readBoardListCache({
  category = null,
  storage,
  now = Date.now()
} = {}) {
  try {
    if (storage === undefined) storage = globalThis.localStorage;
    if (!storage) return null;
    for (const oldCategory of ['all', 'free', 'notice']) storage.removeItem(`${BOARD_LIST_CACHE_POLICY.legacyPrefix}${oldCategory}`);
    const cached = JSON.parse(storage.getItem(getCacheKey(category)) || "null");
    if (
      !cached
      || !Array.isArray(cached.posts)
      || !isContentCacheFresh(cached, now)
    ) {
      storage.removeItem(getCacheKey(category));
      return null;
    }
    return cached.posts;
  } catch {
    return null;
  }
}

export function writeBoardListCache(posts, {
  category = null,
  storage,
  now = Date.now(),
  ttlMs = BOARD_LIST_CACHE_TTL_MS
} = {}) {
  if (!Array.isArray(posts)) return false;
  try {
    if (storage === undefined) storage = globalThis.localStorage;
    if (!storage) return false;
    storage.setItem(getCacheKey(category), JSON.stringify({
      expiresAt: now + ttlMs,
      posts
    }));
    return true;
  } catch {
    return false;
  }
}

export function clearBoardListCache(storage) {
  try {
    if (storage === undefined) storage = globalThis.localStorage;
    if (!storage) return;
    [null, "free", "notice"].forEach((category) => {
      storage.removeItem(getCacheKey(category));
      storage.removeItem(`${BOARD_LIST_CACHE_POLICY.legacyPrefix}${category || 'all'}`);
    });
    // Home keeps a separate notice cache; invalidate it after board mutations too.
    const noticeKeys = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (isHomeNoticeCacheKey(key)) noticeKeys.push(key);
    }
    noticeKeys.forEach((key) => storage.removeItem(key));
  } catch {}
}
