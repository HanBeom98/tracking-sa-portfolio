export const BOARD_LIST_CACHE_POLICY = Object.freeze({
  prefix: 'board-list:v2:', legacyPrefix: 'board-list:v1:', ttlMs: 5 * 60_000,
});
export const COMMENT_LIST_CACHE_POLICY = Object.freeze({
  prefix: 'board-comments:v2:', legacyPrefix: 'board-comments:v1:', ttlMs: 60_000,
});
export const HOME_NOTICE_CACHE_POLICY = Object.freeze({
  prefix: 'home-notices:v1:', ttlMs: 10 * 60_000,
});

export function isContentCacheFresh(cached, now) {
  return Number.isFinite(cached?.expiresAt) && cached.expiresAt > now;
}

export function getHomeNoticeCacheKey(projectId) {
  return `${HOME_NOTICE_CACHE_POLICY.prefix}${String(projectId || '')}`;
}

export function isHomeNoticeCacheKey(key) {
  return typeof key === 'string' && key.startsWith(HOME_NOTICE_CACHE_POLICY.prefix);
}
