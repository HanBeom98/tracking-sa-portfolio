export const NOTICE_DURATION_DAYS = 14;
export const NOTICE_DURATION_MS = NOTICE_DURATION_DAYS * 24 * 60 * 60 * 1000;
export const NOTICE_DISPLAY_LIMIT = 5;

export function getNoticeCreatedAtMs(createdAt) {
  if (typeof createdAt?.toMillis === 'function') {
    const value = createdAt.toMillis();
    return Number.isFinite(value) ? value : null;
  }
  if (Number.isFinite(createdAt?.seconds)) return createdAt.seconds * 1000;
  if (Number.isFinite(createdAt)) return createdAt;
  const parsed = typeof createdAt === 'string' || createdAt instanceof Date
    ? new Date(createdAt).getTime() : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

export function isNoticeDateActive(createdAt, nowMs = Date.now()) {
  const createdAtMs = getNoticeCreatedAtMs(createdAt);
  return createdAtMs !== null && nowMs < createdAtMs + NOTICE_DURATION_MS;
}
