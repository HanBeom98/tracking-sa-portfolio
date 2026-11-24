export const MAX_SOOP_PAGES = 10;
const SOOP_PAGE_SIZE = 60;

function firstValue(source, keys, fallback = '') {
  for (const key of keys) {
    const value = source && source[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return fallback;
}

function safeHttpsUrl(value) {
  if (!value) return '';
  try {
    const rawValue = String(value).trim();
    const url = new URL(rawValue.startsWith('//') ? `https:${rawValue}` : rawValue);
    return url.protocol === 'https:' ? url.toString() : '';
  } catch {
    return '';
  }
}

function buildWatchUrl(item) {
  const explicit = safeHttpsUrl(firstValue(item, [
    'watchUrl', 'watch_url', 'broadcastUrl', 'broadcast_url', 'broad_url', 'url', 'link'
  ]));
  if (explicit) return explicit;
  const streamerId = String(firstValue(item, ['streamerId', 'streamer_id', 'bjId', 'bj_id', 'user_id'])).trim();
  const broadcastId = String(firstValue(item, [
    'id', 'broadcastId', 'broadcast_id', 'broadNo', 'broad_no', 'bno'
  ])).trim();
  if (!streamerId) return '';
  if (broadcastId) {
    return `https://play.sooplive.com/${encodeURIComponent(streamerId)}/${encodeURIComponent(broadcastId)}`;
  }
  return `https://www.sooplive.com/station/${encodeURIComponent(streamerId)}`;
}

export function normalizeSoopBroadcast(item = {}) {
  const id = String(firstValue(item, ['id', 'broadcastId', 'broadcast_id', 'broadNo', 'broad_no', 'bno'])).trim();
  const streamerId = String(firstValue(item, ['streamerId', 'streamer_id', 'bjId', 'bj_id', 'user_id'])).trim();
  return {
    id: id || `${streamerId}:${String(firstValue(item, ['title', 'broad_title'])).trim()}`,
    title: String(firstValue(item, ['title', 'broadcastTitle', 'broadcast_title', 'broad_title'], '제목 없는 방송')).trim(),
    streamerId,
    streamerName: String(firstValue(item, [
      'streamerName', 'streamer_name', 'bjNickname', 'bj_nickname', 'user_nick', 'nickname', 'nick'
    ], streamerId || 'SOOP 스트리머')).trim(),
    viewerCount: Math.max(0, Number(firstValue(item, [
      'viewerCount', 'viewer_count', 'currentViewers', 'current_viewers', 'total_view_cnt', 'view_cnt'
    ], 0)) || 0),
    thumbnailUrl: safeHttpsUrl(firstValue(item, [
      'thumbnailUrl', 'thumbnail_url', 'thumbnail', 'broad_thumb', 'thumb'
    ])),
    streamerAvatarUrl: safeHttpsUrl(firstValue(item, [
      'streamerAvatarUrl', 'streamer_avatar_url', 'bjThumbnail', 'bj_thumbnail', 'profile_image'
    ])),
    watchUrl: buildWatchUrl(item),
  };
}

function getSoopItems(payload) {
  const candidates = [
    payload?.broad,
    payload?.broadcasts,
    payload?.streams,
    payload?.items,
    payload?.data?.broadcasts,
    payload?.data?.streams,
    payload?.data?.items,
    payload?.data,
    payload?.result?.broadcasts,
    payload?.result?.items,
  ];
  return candidates.find(Array.isArray) || [];
}

export function extractSoopBroadcasts(payload) {
  return getSoopItems(payload)
    .map(normalizeSoopBroadcast)
    .filter((item) => item.id && item.watchUrl)
    .sort(compareSoopBroadcastPriority);
}

export function compareSoopBroadcastPriority(a, b) {
  const aHasInterval = /interval/i.test(String(a?.title || ''));
  const bHasInterval = /interval/i.test(String(b?.title || ''));
  if (aHasInterval !== bHasInterval) return aHasInterval ? -1 : 1;
  return (Number(b?.viewerCount) || 0) - (Number(a?.viewerCount) || 0);
}

export function getSoopPageCount(payload = {}) {
  const totalCount = Math.max(0, Number(payload.total_cnt) || 0);
  const pageSize = Math.max(1, Number(payload.page_block) || SOOP_PAGE_SIZE);
  return Math.min(MAX_SOOP_PAGES, Math.max(1, Math.ceil(totalCount / pageSize)));
}

export function selectSoopBroadcasts(payloads) {
  const byId = new Map();
  for (const [pageIndex, payload] of payloads.entries()) {
    const pageWinners = new Map();
    for (const [sourceIndex, source] of getSoopItems(payload).entries()) {
      const streamerId = String(firstValue(source, ['streamerId', 'streamer_id', 'bjId', 'bj_id', 'user_id'])).trim();
      const id = String(firstValue(source, ['id', 'broadcastId', 'broadcast_id', 'broadNo', 'broad_no', 'bno'])).trim()
        || `${streamerId}:${String(firstValue(source, ['title', 'broad_title'])).trim()}`;
      if (byId.has(id)) continue;
      // A streamer ID always provides the same safe HTTPS fallback as buildWatchUrl.
      // Construct/normalize full URLs only for the final selection.
      if (!streamerId && !safeHttpsUrl(firstValue(source, [
        'watchUrl', 'watch_url', 'broadcastUrl', 'broadcast_url', 'broad_url', 'url', 'link'
      ]))) continue;
      const title = String(firstValue(source, ['title', 'broadcastTitle', 'broadcast_title', 'broad_title'], '제목 없는 방송')).trim();
      const entry = {
        source, pageIndex, sourceIndex,
        interval: /interval/i.test(title),
        viewers: Math.max(0, Number(firstValue(source, [
          'viewerCount', 'viewer_count', 'currentViewers', 'current_viewers', 'total_view_cnt', 'view_cnt'
        ], 0)) || 0),
      };
      const previous = pageWinners.get(id);
      if (!previous || compareCandidates(entry, previous) < 0) pageWinners.set(id, entry);
    }
    // Earlier pages win duplicate IDs, just as in the previous sorted-page merge.
    for (const [id, entry] of pageWinners) byId.set(id, entry);
  }
  return [...byId.values()]
    .sort(compareCandidates)
    .slice(0, 12)
    .map(({ source }) => normalizeSoopBroadcast(source));
}

function compareCandidates(a, b) {
  if (a.interval !== b.interval) return a.interval ? -1 : 1;
  return (b.viewers - a.viewers) || (a.pageIndex - b.pageIndex) || (a.sourceIndex - b.sourceIndex);
}

// Transport only card fields; provider metadata and credentials never enter page responses.
export function projectSoopPage(payload) {
  return getSoopItems(payload).map(source => {
    const streamerId = String(firstValue(source, ['streamerId', 'streamer_id', 'bjId', 'bj_id', 'user_id'])).trim();
    return {
      id: String(firstValue(source, ['id', 'broadcastId', 'broadcast_id', 'broadNo', 'broad_no', 'bno'])).trim()
        || `${streamerId}:${String(firstValue(source, ['title', 'broad_title'])).trim()}`,
      streamerId,
      title: String(firstValue(source, ['title', 'broadcastTitle', 'broadcast_title', 'broad_title'], '제목 없는 방송')).trim(),
      streamerName: String(firstValue(source, ['streamerName', 'streamer_name', 'bjNickname', 'bj_nickname', 'user_nick', 'nickname', 'nick'], streamerId || 'SOOP 스트리머')).trim(),
      viewerCount: Math.max(0, Number(firstValue(source, ['viewerCount', 'viewer_count', 'currentViewers', 'current_viewers', 'total_view_cnt', 'view_cnt'], 0)) || 0),
      thumbnailUrl: String(firstValue(source, ['thumbnailUrl', 'thumbnail_url', 'thumbnail', 'broad_thumb', 'thumb'])),
      streamerAvatarUrl: String(firstValue(source, ['streamerAvatarUrl', 'streamer_avatar_url', 'bjThumbnail', 'bj_thumbnail', 'profile_image'])),
      watchUrl: String(firstValue(source, ['watchUrl', 'watch_url', 'broadcastUrl', 'broadcast_url', 'broad_url', 'url', 'link'])),
    };
  });
}
