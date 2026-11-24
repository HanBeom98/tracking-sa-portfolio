import { displayText, GUIDE, LAB, link, message, row } from './messages.js';
import { createReplayCache } from './replay-cache.js';
import { MAX_REPLAY_HEADER_BYTES, parseReplayHeader } from './replay-header.js';

export const MAX_REPLAY_BYTES = 2 * 1024 * 1024;
export const REPLAY_SESSION_SECONDS = 15 * 60;
const validId = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,32}$/.test(value);
const fail = code => { throw new Error(code); };
const workerReplayCache = createReplayCache();

export function attachmentUrl(value) {
  let url;
  try { url = new URL(value); } catch { fail('ATTACHMENT_INVALID'); }
  // Accept only Discord's original attachment origin; never proxy arbitrary user URLs.
  if (url.protocol !== 'https:' || url.hostname !== 'cdn.discordapp.com' || url.port || url.username || url.password || url.hash
    || !/^\/(?:ephemeral-)?attachments\/\d{1,32}\/\d{1,32}\/[^/]+$/i.test(url.pathname) || url.href.length > 512) fail('ATTACHMENT_INVALID');
  let filename;
  try { filename = decodeURIComponent(url.pathname.split('/').at(-1)); } catch { fail('ATTACHMENT_INVALID'); }
  if (!/\.json$/i.test(filename) || /[\x00-\x1f\x7f/\\]/.test(filename)) fail('JSON_ONLY');
  return url.href;
}

export function commandAttachment(interaction) {
  const id = interaction.data?.options?.find(option => option.name === '파일')?.value;
  const file = interaction.data?.resolved?.attachments?.[id];
  if (!file || file.id !== id) fail('FILE_REQUIRED');
  if (typeof file.filename !== 'string' || !/\.json$/i.test(file.filename)) fail('JSON_ONLY');
  if (!Number.isSafeInteger(file.size) || file.size < 1 || file.size > MAX_REPLAY_BYTES) fail('FILE_TOO_LARGE');
  return attachmentUrl(file.url);
}

async function readReplay(url, fetchImpl) {
  // Workers supports manual/follow, but throws before sending redirect:'error'.
  // Reject returned 3xx responses ourselves instead of following them.
  const response = await fetchImpl(attachmentUrl(url), { redirect: 'manual', signal: AbortSignal.timeout(5000),
    headers: { Accept: 'application/json', Range: `bytes=0-${MAX_REPLAY_HEADER_BYTES - 1}` } });
  if (response.status >= 300 && response.status < 400) { await response.body?.cancel(); fail('ATTACHMENT_INVALID'); }
  if (!response.ok) { await response.body?.cancel(); fail('ATTACHMENT_EXPIRED'); }
  if (Number(response.headers.get('content-length')) > MAX_REPLAY_BYTES) { await response.body?.cancel(); fail('FILE_TOO_LARGE'); }
  if (response.status === 206) {
    const range = /^bytes 0-(\d+)\/(\d+)$/.exec(response.headers.get('content-range') || '');
    if (!range || Number(range[1]) >= Number(range[2])) { await response.body?.cancel(); fail('ATTACHMENT_INVALID'); }
    if (Number(range[2]) > MAX_REPLAY_BYTES) { await response.body?.cancel(); fail('FILE_TOO_LARGE'); }
  }
  if (!response.body) fail('EMPTY_FILE');
  const reader = response.body.getReader(), prefix = new Uint8Array(MAX_REPLAY_HEADER_BYTES);
  let size = 0, done = false;
  try {
    // Bound both retained bytes and read iterations if a server ignores Range.
    for (let chunks = 0; chunks < 32 && size < prefix.length; chunks++) {
      const part = await reader.read();
      if (part.done) { done = true; break; }
      const count = Math.min(part.value.byteLength, prefix.length - size);
      prefix.set(part.value.subarray(0, count), size); size += count;
    }
  } finally {
    try { if (!done) await reader.cancel(); } finally { reader.releaseLock(); }
  }
  if (!size) fail('EMPTY_FILE');
  const header = parseReplayHeader(new TextDecoder().decode(prefix.subarray(0, size)));
  return {header, bytes: size};
}

export function replayControl(owner, expires, action, player = '') {
  if (!/^\d{1,20}$/.test(owner) || !Number.isSafeInteger(expires) || (player && !validId(player))) fail('INVALID_CONTEXT');
  return `rp2:${owner}:${expires}:${action}${player ? ':' + player : ''}`;
}

export function replaySession(interaction, now = Date.now()) {
  const match = /^rp2:(\d{1,20}):(\d{10}):(select|summary|moments|rounds)(?::([a-zA-Z0-9_-]{1,32}))?$/.exec(interaction.data?.custom_id || '');
  if (!match) fail('SESSION_EXPIRED');
  const [, owner, expiration, action, playerId] = match;
  const actor = interaction.member?.user?.id || interaction.user?.id;
  if (owner !== actor) fail('SESSION_OWNER');
  const expires = Number(expiration), nowSeconds = Math.floor(now / 1000);
  if (expires <= nowSeconds || expires > nowSeconds + REPLAY_SESSION_SECONDS) fail('SESSION_EXPIRED');
  const source = (interaction.message?.components || []).flatMap(item => item.components || [])
    .find(component => component.type === 2 && component.style === 5 && component.label === '첨부한 JSON');
  const selected = action === 'select' ? interaction.data?.values?.[0] : playerId;
  if (!validId(selected) || action === 'select' && interaction.data.values.length !== 1) fail('PLAYER_NOT_FOUND');
  return { owner, expires, action, playerId: selected,
    url: attachmentUrl(source?.url) };
}

function controls(players, session, selected = '') {
  const selector = { type: 3, custom_id: replayControl(session.owner, session.expires, 'select'),
    placeholder: '분석할 선수를 선택하세요', min_values: 1, max_values: 1,
    options: players.map(player => ({ label: displayText(player.nickName, 90), value: player.nexonSN,
      description: `${stat(player.kill)}킬 · ${stat(player.death)}데스 · ${stat(player.assist)}어시스트`, default: player.nexonSN === selected })) };
  const components = [row(selector)];
  components.push(handoffLinks(session));
  return components;
}

const stat = value => value === null ? '정보 없음' : String(value);
const handoffText = '핵심 장면·라운드 기록·경기 그래프는 아래 상세 분석에서 확인하세요. 같은 JSON을 다시 선택하면 기기 안에서 분석합니다.';
const handoffLinks = session => row(link('상세 분석 열기', LAB), link('첨부한 JSON', session.url), link('JSON 받는 방법', GUIDE));

export async function replayMessage(session, { fetchImpl = fetch, cache = fetchImpl === fetch ? workerReplayCache : null } = {}) {
  let entry = cache?.get(session);
  if (!entry) { entry = await readReplay(session.url, fetchImpl); cache?.set(session, entry); }
  const {header} = entry;
  if (!header) return message({embeds: [{title: '웹 분석실에서 이 파일을 확인해 주세요', color: 0x40c5df,
    description: '파일 앞부분에서 경기·선수 요약을 찾지 못했습니다. 전체 기록은 봇에서 읽지 않습니다.\n\n' + handoffText,
    footer: {text: '전체 파일을 검사한 결과가 아닙니다 · AI 호출·이용권 차감 없음'}}], components: [handoffLinks(session)]});
  const {summary, players} = header;
  const components = controls(players, session);
  if (!session.playerId) return message({ embeds: [{ title: '리플레이 요약 준비 완료', color: 0x40c5df,
    description: `**${displayText(summary.mapName)}** · ${players.length}명\n아래에서 기록을 볼 선수를 선택하세요.\n\n${handoffText}`,
    footer: { text: '파일 앞부분 요약만 확인 · 선수 선택 15분 · 별도 DB 저장 없음' },
  }], components });
  if (!validId(session.playerId) || !players.some(player => player.nexonSN === session.playerId)) fail('PLAYER_NOT_FOUND');
  const player = players.find(player => player.nexonSN === session.playerId);
  const outcome = [0,1].includes(summary.winTeam) && [0,1].includes(player.teamNo)
    ? summary.winTeam === player.teamNo ? '승리' : '패배' : '결과 정보 없음';
  const embed = { title: `${displayText(player.nickName, 70)} · ${displayText(summary.mapName, 90)}`, color: 0x40c5df,
    description: `${displayText(summary.date, 80)} · ${stat(summary.teamAWinCnt)} : ${stat(summary.teamBWinCnt)} · ${outcome}`,
    fields: [
      { name: 'K / D / A', value: `${stat(player.kill)} / ${stat(player.death)} / ${stat(player.assist)}`, inline: true },
      { name: '피해량', value: stat(player.damage), inline: true },
      { name: '상세 분석', value: handoffText },
    ], footer: { text: '파일 앞부분에 기록된 요약 · 전체 기록 검증은 웹에서 · AI 호출·이용권 차감 없음' } };
  return message({ embeds: [embed], components: controls(players, session, session.playerId) });
}
