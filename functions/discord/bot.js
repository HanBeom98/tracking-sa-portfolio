import { discordCommandNames } from './commands.js';
import { helpMessage, message } from './messages.js';
import { profileMessage } from './profile.js';
import { commandAttachment, REPLAY_SESSION_SECONDS, replayMessage, replaySession } from './replay.js';

const recent = new Map();
const MAX_THROTTLE_ENTRIES = 1024;
const privateResponse = data => Response.json({ type: 4, data: { ...message(data), flags: 64 } });
const errorText = error => ({
  NICKNAME_REQUIRED: '검색할 닉네임을 2~30자로 입력해 주세요.',
  PLAYER_NOT_FOUND: '선수를 찾지 못했습니다. 닉네임이나 리플레이 파일을 확인해 주세요.',
  PROFILE_UNAVAILABLE: '전적 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.',
  FILE_REQUIRED: '공식 리플레이 JSON 파일 하나를 첨부해 주세요.',
  JSON_ONLY: '공식 병영수첩에서 받은 .json 파일만 사용할 수 있습니다.',
  FILE_TOO_LARGE: '파일은 2MB 이하로 첨부해 주세요.',
  SESSION_OWNER: '이 결과의 선수 선택은 요청한 사람만 할 수 있습니다. /리플레이에 직접 파일을 첨부해 주세요.',
  SESSION_EXPIRED: '분석 화면의 유효 시간이 지났습니다. /리플레이에 파일을 다시 첨부해 주세요.',
  ATTACHMENT_EXPIRED: 'Discord 원본 파일을 읽지 못했습니다. /리플레이에 파일을 다시 첨부해 주세요.',
  ATTACHMENT_INVALID: '유효한 Discord JSON 첨부파일을 찾지 못했습니다. 파일을 다시 첨부해 주세요.',
  INVALID_JSON: 'JSON 형식이 올바르지 않습니다. 공식 리플레이 파일을 다시 받아 주세요.',
  UNSUPPORTED_REPLAY: '지원하는 공식 리플레이 형식이 아닙니다. 파일 내용을 확인해 주세요.',
  EMPTY_FILE: '첨부한 파일이 비어 있습니다.',
}[error?.message] || '요청을 처리하지 못했습니다. 잠시 후 다시 시도하거나 사이트 분석실을 이용해 주세요.');

export function isNewDiscordInteraction(interaction) {
  return interaction.type === 2 && discordCommandNames.has(interaction.data?.name)
    || interaction.type === 3 && interaction.data?.custom_id?.startsWith('rp2:');
}

// Best-effort per-isolate throttle, not a global quota. No DB/cache or new service.
function throttled(key, now, interval) {
  if ((recent.get(key) || 0) > now) return true;
  for (const [key, expires] of recent) if (expires <= now) recent.delete(key);
  if (recent.size >= MAX_THROTTLE_ENTRIES) recent.delete(recent.keys().next().value);
  recent.set(key, now + interval);
  return false;
}

export function handleDiscordBot(context, interaction, applicationId) {
  const { env = {}, waitUntil } = context;
  const actor = interaction.member?.user?.id || interaction.user?.id;
  if (!/^\d{1,20}$/.test(actor || '') || interaction.application_id !== applicationId) return privateResponse({ content: '유효한 서버 명령에서 다시 시도해 주세요.' });
  if (interaction.type === 2 && interaction.data.name === '도움말') return privateResponse(helpMessage());
  if (interaction.type === 2 && !interaction.guild_id) return privateResponse({ content: '이 명령은 디스코드 서버에서 이용해 주세요.' });
  const isReplay = interaction.type === 3 || interaction.data.name === '리플레이';
  const replayEnabled = env.DISCORD_REPLAY_ENABLED === 'true'
    || Boolean(env.DISCORD_REPLAY_TEST_GUILD) && env.DISCORD_REPLAY_TEST_GUILD === interaction.guild_id;
  if (isReplay && !replayEnabled) return privateResponse({ content: '리플레이 봇 요약은 준비 중입니다. 지금은 https://trackingsa.com/stats/sudden-attack/replay/ 에서 무료 분석을 이용해 주세요.' });
  let session;
  try {
    if (interaction.type === 3) session = replaySession(interaction);
    else if (isReplay) session = { owner: actor, expires: Math.floor(Date.now() / 1000) + REPLAY_SESSION_SECONDS,
      url: commandAttachment(interaction), action: 'summary' };
  } catch (error) { return privateResponse({ content: errorText(error) }); }
  const component = interaction.type === 3;
  if (throttled(`${actor}:${component ? 'view' : 'command'}`, Date.now(), component ? 2000 : 5000)) {
    return privateResponse({ content: component ? '보기 전환은 2초 간격으로 이용해 주세요.' : '연속 요청은 5초 간격으로 이용해 주세요.' });
  }
  if (typeof waitUntil !== 'function' || !/^[A-Za-z0-9._-]{1,2048}$/.test(interaction.token || '')) return privateResponse({ content: '명령을 처리할 수 없습니다. 잠시 후 다시 시도해 주세요.' });

  const task = Promise.resolve().then(async () => {
    let data;
    try {
      data = isReplay ? await replayMessage(session)
        : await profileMessage(env, interaction.data.options?.find(option => option.name === '닉네임')?.value);
    } catch (error) { data = message({ content: errorText(error) }); }
    // Never retry a failed Discord write automatically or log tokens/JSON/URLs.
    try {
      const response = await fetch(`https://discord.com/api/v10/webhooks/${applicationId}/${interaction.token}/messages/@original`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data), signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) console.warn('Discord result update failed', response.status);
    } catch { console.warn('Discord result update unavailable'); }
  });
  waitUntil.call(context, task);
  const privateReplay = isReplay && interaction.data.options?.some(option => option.name === '공개' && option.value === false);
  const isPublic = interaction.type === 2 && !privateReplay;
  return Response.json(interaction.type === 3 ? { type: 6 } : { type: 5, data: { flags: isPublic ? 0 : 64 } });
}
