import { onRequest as saProxyOnRequest } from '../api/sa-proxy.js';
import { displayText, link, message, row, SITE } from './messages.js';

async function query(env, endpoint, params) {
  const url = new URL(`${SITE}/api/sa-proxy`);
  url.searchParams.set('path', `/suddenattack/v1${endpoint}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = await saProxyOnRequest({ request: { method: 'GET', url: url.href }, env });
  const data = await response.json();
  if (!response.ok) throw new Error(response.status === 400 || response.status === 404 ? 'PLAYER_NOT_FOUND' : 'PROFILE_UNAVAILABLE');
  return data;
}

const percent = value => value !== null && value !== '' && Number.isFinite(Number(value)) ? `${Number(value).toFixed(1)}%` : '정보 없음';
const tierLabel = (tier, score) => `${displayText(tier || '정보 없음', 80)}${Number.isFinite(Number(score)) && Number(score) > 0 ? ` · ${Math.round(Number(score)).toLocaleString('ko-KR')}점` : ''}`;

export async function profileMessage(env, nickname) {
  if (typeof nickname !== 'string' || nickname.trim().length < 2 || nickname.trim().length > 30 || /[\x00-\x1f\x7f]/.test(nickname)) throw new Error('NICKNAME_REQUIRED');
  nickname = nickname.trim();
  const { ouid } = await query(env, '/id', { user_name: nickname });
  if (!ouid) throw new Error('PLAYER_NOT_FOUND');
  const [recent, tier] = await Promise.all([
    query(env, '/user/recent-info', { ouid }),
    query(env, '/user/tier', { ouid }).catch(() => ({})),
  ]);
  return message({ embeds: [{ title: `${displayText(nickname, 80)} · 서든어택 전적`, color: 0x40c5df,
    fields: [
      { name: '솔로 랭크', value: tierLabel(tier.solo_rank_match_tier, tier.solo_rank_match_score), inline: true },
      { name: '파티 랭크', value: tierLabel(tier.party_rank_match_tier, tier.party_rank_match_score), inline: true },
      { name: '최근 승률', value: percent(recent.recent_win_rate), inline: true },
      { name: '최근 킬뎃', value: percent(recent.recent_kill_death_rate), inline: true },
      { name: '돌격 정확도', value: percent(recent.recent_assault_rate), inline: true },
      { name: '스나 정확도', value: percent(recent.recent_sniper_rate), inline: true },
    ], footer: { text: '넥슨 Open API · recent-info / 랭크전 티어 기준' },
  }], components: [row(link('상세 전적 보기', `${SITE}/stats/sudden-attack/?n=${encodeURIComponent(nickname)}`))] });
}
