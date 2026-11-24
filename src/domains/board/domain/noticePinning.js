import { getNoticeCreatedAtMs, isNoticeDateActive } from './notice-policy.js';
export { NOTICE_DURATION_DAYS as NOTICE_PIN_DURATION_DAYS } from './notice-policy.js';

export function getPostCreatedAtMs(post) {
  return getNoticeCreatedAtMs(post?.createdAt);
}

export function isActivePinnedNotice(post, nowMs = Date.now()) {
  if (post?.category !== "notice") return false;

  return isNoticeDateActive(post.createdAt, nowMs);
}

export function sortPostsWithActiveNoticesFirst(posts = [], nowMs = Date.now()) {
  return [...posts].sort((a, b) => {
    const aPinned = isActivePinnedNotice(a, nowMs);
    const bPinned = isActivePinnedNotice(b, nowMs);
    if (aPinned !== bPinned) return aPinned ? -1 : 1;
    return (getPostCreatedAtMs(b) || 0) - (getPostCreatedAtMs(a) || 0);
  });
}
