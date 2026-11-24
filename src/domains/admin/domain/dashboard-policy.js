export { isSiteAdministrator } from '../../auth/domain/access-policy.js';
import { getNoticeCreatedAtMs, isNoticeDateActive, NOTICE_DISPLAY_LIMIT, NOTICE_DURATION_MS } from '../../board/domain/notice-policy.js';

export const ADMIN_LIST_LIMIT = 20;
export function noticeDisplayState(notice, now = Date.now()) {
  const createdAt = getNoticeCreatedAtMs(notice.createdAt);
  return { active: isNoticeDateActive(notice.createdAt, now), expiresAt: createdAt === null ? null : createdAt + NOTICE_DURATION_MS };
}
export function homeNoticeCount(notices, now = Date.now()) {
  return notices.slice(0, NOTICE_DISPLAY_LIMIT).filter(n => noticeDisplayState(n, now).active).length;
}
export function parseBuildInfo(text) {
  const commit = /^commit=([a-f0-9]{40}|unknown)$/m.exec(text)?.[1];
  const date = /^built_at_utc=(.+)$/m.exec(text)?.[1];
  if (!commit || !date || !Number.isFinite(Date.parse(date))) throw new Error('BUILD_INFO_UNAVAILABLE');
  return { commit, builtAt: new Date(date).toISOString() };
}
