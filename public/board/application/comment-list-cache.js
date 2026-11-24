import { COMMENT_LIST_CACHE_POLICY, isContentCacheFresh } from '../domain/content-cache-policy.js?v=c92293a2a152';
export const COMMENT_LIST_CACHE_TTL_MS = COMMENT_LIST_CACHE_POLICY.ttlMs;

function getCacheKey(postId) {
  return `${COMMENT_LIST_CACHE_POLICY.prefix}${String(postId || "")}`;
}

export function readCommentListCache({
  postId,
  storage,
  now = Date.now()
} = {}) {
  if (!postId) return null;
  try {
    if (storage === undefined) storage = globalThis.localStorage;
    if (!storage) return null;
    storage.removeItem(`${COMMENT_LIST_CACHE_POLICY.legacyPrefix}${String(postId)}`);
    const cached = JSON.parse(storage.getItem(getCacheKey(postId)) || "null");
    if (!cached || !Array.isArray(cached.comments) || !isContentCacheFresh(cached, now)) {
      storage.removeItem(getCacheKey(postId));
      return null;
    }
    return cached.comments;
  } catch {
    return null;
  }
}

export function writeCommentListCache(comments, {
  postId,
  storage,
  now = Date.now(),
  ttlMs = COMMENT_LIST_CACHE_TTL_MS
} = {}) {
  if (!postId || !Array.isArray(comments)) return false;
  try {
    if (storage === undefined) storage = globalThis.localStorage;
    if (!storage) return false;
    storage.setItem(getCacheKey(postId), JSON.stringify({
      expiresAt: now + ttlMs,
      comments
    }));
    return true;
  } catch {
    return false;
  }
}

export function clearCommentListCache(postId, storage) {
  if (!postId) return;
  try {
    if (storage === undefined) storage = globalThis.localStorage;
    if (!storage) return;
    storage.removeItem(getCacheKey(postId));
  } catch {}
}
