// Rollback-only adapter. The signed ingress validates signature, freshness,
// application and v2 cutover before loading or invoking this module.
import { onRequest as saProxyOnRequest } from '../api/sa-proxy.js';
import { requestDiscordSession } from '../infra/discord-session-client.js';

function fromFirestore(f) {
  if (!f) return {};
  const o = {};
  for (const [k, v] of Object.entries(f)) {
    if (v.stringValue) o[k] = v.stringValue;
    else if (v.doubleValue !== undefined) o[k] = Number(v.doubleValue);
    else if (v.integerValue !== undefined) o[k] = Number(v.integerValue);
    else if (v.booleanValue !== undefined) o[k] = v.booleanValue;
    else if (v.arrayValue) o[k] = (v.arrayValue.values || []).map(i => (i.mapValue ? fromFirestore(i.mapValue.fields) : (i.stringValue || i.doubleValue || i.integerValue)));
  }
  return o;
}

async function queryCrewMember(projectId, nickname) {
  const qUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`;
  const qBody = {
    structuredQuery: {
      from: [{ collectionId: 'sa_crew_members' }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'characterName' },
          op: 'EQUAL',
          value: { stringValue: nickname }
        }
      },
      limit: 1
    }
  };
  const qResp = await fetch(qUrl, {
    method: 'POST',
    body: JSON.stringify(qBody),
    headers: { 'Content-Type': 'application/json' }
  });
  const res = await qResp.json();
  return res?.[0]?.document ? fromFirestore(res[0].document.fields) : null;
}

function safeNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function calcWinRate(data) {
  const wins = safeNumber(data.wins);
  const loses = safeNumber(data.loses);
  const total = wins + loses;
  return total > 0 ? (wins / total) * 100 : 0;
}

function calcKdRatio(data) {
  const kills = safeNumber(data.crewKills);
  const deaths = safeNumber(data.crewDeaths);
  if (kills <= 0 && deaths <= 0) return 0;
  if (deaths <= 0) return kills;
  return kills / deaths;
}

function formatNumber(value) {
  return new Intl.NumberFormat('ko-KR').format(Math.round(value));
}

function formatPercent(value) {
  return `${value.toFixed(1)}%`;
}

function formatKd(value) {
  return value.toFixed(2);
}

async function fetchSaApi(env, endpoint, params = {}) {
  const url = new URL('https://internal.trackingsa.local/api/sa-proxy');
  url.searchParams.set('path', `/suddenattack/v1${endpoint}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });

  const response = await saProxyOnRequest({
    request: {
      method: 'GET',
      url: url.toString()
    },
    env
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error?.message || `Nexon API Error: ${response.status}`;
    throw new Error(message);
  }
  return data;
}

async function getSaPublicProfile(env, nickname) {
  const ouidData = await fetchSaApi(env, '/id', { user_name: nickname });
  if (!ouidData?.ouid) throw new Error('PLAYER_NOT_FOUND');

  const ouid = ouidData.ouid;
  const [recentInfo, tierInfo] = await Promise.all([
    fetchSaApi(env, '/user/recent-info', { ouid }),
    fetchSaApi(env, '/user/tier', { ouid }).catch(() => null)
  ]);

  return {
    ouid,
    recentInfo: recentInfo || {},
    tierInfo: tierInfo || {}
  };
}

function formatPublicSearchSummary(nickname, profile) {
  const recent = profile.recentInfo || {};
  const tier = profile.tierInfo || {};
  const soloTier = tier.solo_rank_match_tier || '정보 없음';
  const partyTier = tier.party_rank_match_tier || '정보 없음';
  const soloScore = safeNumber(tier.solo_rank_match_score);
  const partyScore = safeNumber(tier.party_rank_match_score);
  const lines = [
    `📊 **[${nickname}] 공개 전적 리포트**`,
    '',
    `🔹 **랭크전 솔로 티어:** ${soloTier}${soloScore > 0 ? ` (${formatNumber(soloScore)})` : ''}`,
    `🔹 **랭크전 파티 티어:** ${partyTier}${partyScore > 0 ? ` (${formatNumber(partyScore)})` : ''}`,
    `🔹 **최근 승률:** ${formatPercent(safeNumber(recent.recent_win_rate))}`,
    `🔹 **최근 K/D:** ${Math.round(safeNumber(recent.recent_kill_death_rate))}%`,
    `🔹 **돌격 정확도:** ${Math.round(safeNumber(recent.recent_assault_rate))}%`,
    `🔹 **스나 정확도:** ${Math.round(safeNumber(recent.recent_sniper_rate))}%`,
    `🔹 **특수 정확도:** ${Math.round(safeNumber(recent.recent_special_rate))}%`,
    '',
    '*넥슨 Open API recent-info / 랭크전 티어 기준*',
    `🔗 https://trackingsa.com/stats/sudden-attack/?n=${encodeURIComponent(nickname)}`
  ];
  return lines.join('\n');
}

function buildRivalSummary(primaryName, primaryData, targetName, targetData) {
  const primaryMetrics = {
    mmr: safeNumber(primaryData.mmr, 1200),
    hsr: safeNumber(primaryData.hsr, safeNumber(primaryData.mmr, 1200)),
    winRate: calcWinRate(primaryData),
    kd: calcKdRatio(primaryData)
  };
  const targetMetrics = {
    mmr: safeNumber(targetData.mmr, 1200),
    hsr: safeNumber(targetData.hsr, safeNumber(targetData.mmr, 1200)),
    winRate: calcWinRate(targetData),
    kd: calcKdRatio(targetData)
  };

  const comparisons = [
    { label: '내전 MMR', key: 'mmr', formatter: formatNumber },
    { label: '내전 HSR', key: 'hsr', formatter: formatNumber },
    { label: '내전 승률', key: 'winRate', formatter: formatPercent },
    { label: '내전 K/D', key: 'kd', formatter: formatKd }
  ];

  const primaryWins = [];
  const targetWins = [];
  let primaryScore = 0;
  let targetScore = 0;

  for (const item of comparisons) {
    const primaryValue = primaryMetrics[item.key];
    const targetValue = targetMetrics[item.key];
    if (primaryValue > targetValue) {
      primaryWins.push(item.label);
      primaryScore += 1;
    } else if (targetValue > primaryValue) {
      targetWins.push(item.label);
      targetScore += 1;
    }
  }

  let verdict;
  if (primaryScore === targetScore) {
    verdict = `⚖️ **접전**: ${primaryName}와 ${targetName}의 핵심 지표가 비슷합니다.`;
  } else if (primaryScore > targetScore) {
    verdict = `🏆 **${primaryName} 우세**: ${primaryWins.join(', ')}에서 앞섭니다.`;
  } else {
    verdict = `🏆 **${targetName} 우세**: ${targetWins.join(', ')}에서 앞섭니다.`;
  }

  const detailLines = comparisons.map(({ label, key, formatter }) =>
    `• ${label}: **${primaryName} ${formatter(primaryMetrics[key])}** vs **${targetName} ${formatter(targetMetrics[key])}**`
  );

  const links = [
    `https://trackingsa.com/stats/sudden-attack/?n=${encodeURIComponent(primaryName)}`,
    `https://trackingsa.com/stats/sudden-attack/?n=${encodeURIComponent(targetName)}`
  ];

  return [
    `⚔️ **라이벌 비교 | ${primaryName} vs ${targetName}**`,
    '',
    verdict,
    '',
    ...detailLines,
    '',
    `🔗 프로필 보기: ${links.join(' | ')}`
  ].join('\n');
}

function balanceTeams(players) {
  if (players.length < 2) return null;
  const size = Math.floor(players.length / 2);
  const snipers = players.filter(m => (m.position || 'rifler').toLowerCase() === 'sniper');
  const riflers = players.filter(m => (m.position || 'rifler').toLowerCase() !== 'sniper');
  let best = { red: [], blue: [], standby: [], diff: Infinity };
  const getMmr = (player) => Number(player.mmr || 1200);
  const getHsr = (player) => Number(player.hsr || player.mmr || 1200);

  const combos = (arr, n) => {
    if (n === 0) return [[]];
    const res = [];
    const f = (p, c) => {
      for (let i = 0; i < c.length; i++) {
        const next = p.concat([c[i]]);
        if (next.length === n) res.push(next); else f(next, c.slice(i + 1));
      }
    };
    f([], arr);
    return res;
  };

  for (const rs of combos(snipers, Math.floor(snipers.length / 2))) {
    const need = size - rs.length;
    if (need < 0 || need > riflers.length) continue;
    for (const rr of combos(riflers, need)) {
      const red = [...rs, ...rr];
      const rem = players.filter(p => !red.some(rt => rt.nickname === p.nickname));
      for (const blue of combos(rem, size)) {
        const standby = rem.filter(p => !blue.some(bt => bt.nickname === p.nickname));
        const redHsr = red.reduce((sum, member) => sum + getHsr(member), 0);
        const blueHsr = blue.reduce((sum, member) => sum + getHsr(member), 0);
        const diff = Math.abs(redHsr - blueHsr);
        const redMmr = red.reduce((sum, member) => sum + getMmr(member), 0);
        const blueMmr = blue.reduce((sum, member) => sum + getMmr(member), 0);
        if (diff < best.diff) {
          best = {
            red,
            blue,
            standby,
            diff,
            redAvg: redMmr / red.length,
            blueAvg: blueMmr / blue.length,
            redHsrAvg: redHsr / red.length,
            blueHsrAvg: blueHsr / blue.length
          };
        }
      }
    }
  }
  return best;
}

function getActionButtons(count) {
  const btns = [{ type: 2, label: "참가 신청", style: 1, custom_id: "join_match" }, { type: 2, label: "참가 취소", style: 2, custom_id: "leave_match" }, { type: 2, label: "새로고침 🔄", style: 2, custom_id: "refresh_list" }, { type: 2, label: "모집 취소", style: 4, custom_id: "cancel_match" }];
  if (count >= 10) btns.push({ type: 2, label: "팀 나누기 (시작)", style: 3, custom_id: "start_balance" });
  return [{ type: 1, components: btns }];
}

async function patchInteraction(appId, token, data) {
  const url = `https://discord.com/api/v10/webhooks/${appId}/${token}/messages/@original`;
  return fetch(url, { method: 'PATCH', body: JSON.stringify(data), headers: { 'Content-Type': 'application/json' } });
}

export async function handleLegacyDiscordInteraction(context, interaction, bodyText, APP_ID) {
  const { request, env } = context;
  const PROJECT_ID = env.FIREBASE_PROJECT_ID || "demo-tracking-sa-portfolio";
  const token = interaction.token;

  if (interaction.type === 2) {
    if (interaction.data.name === '대내모집') {
      context.waitUntil((async () => {
        try {
          const result = await requestDiscordSession(request, bodyText);
          if (result.code === 'DUPLICATE') return;
          await patchInteraction(APP_ID, token, {
            content: `🎮 **TRACKING SA 내전 모집 시작!** (${result.session.participants.length}/12)\n최소 10명부터 팀 나누기가 가능합니다.`,
            components: getActionButtons(result.session.participants.length),
          });
        } catch (error) {
          const content = error.code === 'HOST_REQUIRED'
            ? '이미 진행 중인 모집이 있습니다. 기존 진행자만 새 모집을 시작할 수 있습니다.'
            : error.code === 'INVALID_CONTEXT'
              ? '내전 모집은 디스코드 서버 채널에서 이용해 주세요.'
              : '모집 정보를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.';
          await patchInteraction(APP_ID, token, { content, components: [] });
        }
      })());
      return new Response(JSON.stringify({ type: 5 }), { headers: { 'Content-Type': 'application/json' } });
    }

    if (interaction.data.name === '전적검색') {
      const nick = (interaction.data.options || []).find(o => o.name === '닉네임')?.value?.trim();
      if (!nick) {
        return new Response(JSON.stringify({ type: 4, data: { content: '❌ 검색할 닉네임을 입력해주세요.' } }), { headers: { 'Content-Type': 'application/json' } });
      }
      try {
        const profile = await getSaPublicProfile(env, nick);
        return new Response(JSON.stringify({
          type: 4,
          data: { content: formatPublicSearchSummary(nick, profile) }
        }), { headers: { 'Content-Type': 'application/json' } });
      } catch (error) {
        const message = error.message === 'PLAYER_NOT_FOUND' || error.message.includes('valid parameter')
          ? `❌ **${nick}**님의 서든어택 공개 전적을 찾지 못했습니다.`
          : `❌ 공개 전적 조회 실패: ${error.message}`;
        return new Response(JSON.stringify({ type: 4, data: { content: message } }), { headers: { 'Content-Type': 'application/json' } });
      }
    }

    if (interaction.data.name === '대내전적검색') {
      const nick = (interaction.data.options || []).find(o => o.name === '닉네임')?.value?.trim();
      const d = await queryCrewMember(PROJECT_ID, nick);
      if (!d) {
        return new Response(JSON.stringify({ type: 4, data: { content: `❌ **${nick}**님은 등록되어 있지 않습니다.` } }), { headers: { 'Content-Type': 'application/json' } });
      }
      const winRate = (Number(d.wins || 0) + Number(d.loses || 0)) > 0 ? ((Number(d.wins || 0) / (Number(d.wins || 0) + Number(d.loses || 0))) * 100).toFixed(1) + '%' : '0%';
      const kd = (Number(d.crewKills || 0) + Number(d.crewDeaths || 0)) > 0 ? ((Number(d.crewKills || 0) / (Number(d.crewKills || 0) + Number(d.crewDeaths || 0))) * 100).toFixed(1) + '%' : '0%';
      const c = `📊 **[${nick}] 대내 전적 리포트**\n\n🔹 **MMR:** ${d.mmr || 1200}\n🔹 **HSR 점수:** ${d.hsr || 1200}\n🔹 **내전 킬뎃:** ${kd}\n🔹 **내전 승률:** ${winRate}\n\n*TRACKING SA 공식 데이터베이스 기준*`;
      return new Response(JSON.stringify({ type: 4, data: { content: c } }), { headers: { 'Content-Type': 'application/json' } });
    }

    if (interaction.data.name === '라이벌') {
      const options = interaction.data.options || [];
      const primaryName = options.find(o => o.name === '기준유저')?.value?.trim();
      const targetName = options.find(o => o.name === '상대유저')?.value?.trim();

      if (!primaryName || !targetName) {
        return new Response(JSON.stringify({ type: 4, data: { content: '❌ 기준 유저와 상대 유저를 모두 입력해주세요.' } }), { headers: { 'Content-Type': 'application/json' } });
      }

      if (primaryName === targetName) {
        return new Response(JSON.stringify({ type: 4, data: { content: '❌ 같은 닉네임 두 개는 비교할 수 없습니다. 서로 다른 두 유저를 입력해주세요.' } }), { headers: { 'Content-Type': 'application/json' } });
      }

      const [primaryData, targetData] = await Promise.all([
        queryCrewMember(PROJECT_ID, primaryName),
        queryCrewMember(PROJECT_ID, targetName)
      ]);

      if (!primaryData && !targetData) {
        return new Response(JSON.stringify({ type: 4, data: { content: `❌ **${primaryName}**님과 **${targetName}**님 모두 등록되어 있지 않습니다.` } }), { headers: { 'Content-Type': 'application/json' } });
      }
      if (!primaryData) {
        return new Response(JSON.stringify({ type: 4, data: { content: `❌ **${primaryName}**님은 등록되어 있지 않습니다.` } }), { headers: { 'Content-Type': 'application/json' } });
      }
      if (!targetData) {
        return new Response(JSON.stringify({ type: 4, data: { content: `❌ **${targetName}**님은 등록되어 있지 않습니다.` } }), { headers: { 'Content-Type': 'application/json' } });
      }

      return new Response(JSON.stringify({
        type: 4,
        data: {
          content: buildRivalSummary(primaryName, primaryData, targetName, targetData)
        }
      }), { headers: { 'Content-Type': 'application/json' } });
    }
  }

  if (interaction.type === 3) {
    const cid = interaction.data.custom_id, uid = interaction.member?.user?.id || interaction.user?.id;
    if (cid === 'join_match') {
      return new Response(JSON.stringify({
        type: 9,
        data: {
          title: "내전 참가 신청",
          custom_id: "match_entry_modal",
          components: [{
            type: 1,
            components: [{
              type: 4,
              custom_id: "user_nickname",
              label: "서든어택 인게임 닉네임",
              style: 1,
              placeholder: "디코 닉네임 X / 정확한 서든 닉네임 입력!",
              min_length: 2,
              max_length: 16,
              required: true
            }]
          }]
        }
      }), { headers: { 'Content-Type': 'application/json' } });
    }

    context.waitUntil((async () => {
      const result = await requestDiscordSession(request, bodyText);
      const session = result.session;
      if (!session || result.code === 'DUPLICATE' || result.code === 'INACTIVE') return;

      if (cid === 'refresh_list') {
        if (result.code === 'THROTTLED') return patchInteraction(APP_ID, token, { content: "⚠️ 새로고침은 10초에 한 번만 가능합니다.", flags: 64 });
        const list = (session.participants || []).map(p => `${p.nickname}(${p.position === 'sniper' ? '🎯' : '🔫'})`).join(', ');
        await patchInteraction(APP_ID, token, { content: `🎮 **TRACKING SA 내전 모집 시작!** (${session.participants.length}/12)\n**신청자:** ${list || '없음'}`, components: getActionButtons(session.participants.length) });
      } else if (cid === 'leave_match') {
        await patchInteraction(APP_ID, token, { content: `🎮 **TRACKING SA 내전 모집 시작!** (${session.participants.length}/12)\n**신청자:** ${session.participants.map(p => p.nickname).join(', ')}`, components: getActionButtons(session.participants.length) });
      } else if (cid.startsWith('set_pos_')) {
        const participant = session.participants.find((p) => p.discordId === uid);
        if (participant) {
          await patchInteraction(APP_ID, token, { content: `✅ **${participant.nickname}**님 등록 완료! (${session.participants.length}/12)\n모집 메시지를 확인해주세요.`, components: [] });
        }
      } else if (cid === 'start_balance' || cid === 'cancel_match') {
        if (session.hostId !== uid) return;
        if (cid === 'cancel_match') {
          await patchInteraction(APP_ID, token, { content: "🚫 **내전 모집이 취소되었습니다.**", components: [] });
        } else if (session.status === 'CLOSED') {
          const players = await Promise.all(session.participants.map(async (p) => {
            const res = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery`, { method: 'POST', body: JSON.stringify({ structuredQuery: { from: [{ collectionId: 'sa_crew_members' }], where: { fieldFilter: { field: { fieldPath: 'characterName' }, op: 'EQUAL', value: { stringValue: p.nickname } } }, limit: 1 } }), headers: { 'Content-Type': 'application/json' } });
            const data = await res.json(), d = data?.[0]?.document ? fromFirestore(data[0].document.fields) : {};
            return { nickname: p.nickname, mmr: d.mmr || 1200, hsr: d.hsr || d.mmr || 1200, position: p.position, discordId: p.discordId };
          }));
          const r = balanceTeams(players), m = session.participants.map(p => `<@${p.discordId}>`).join(' ');
          const c = `📢 **팀 구성 완료!**\n${m}\n\n🔴 **RED** (Avg: ${Math.round(r.redAvg)}, HSR: ${Math.round(r.redHsrAvg || r.redAvg)})\n${r.red.map(p => `• ${p.nickname} (${p.position === 'sniper' ? '🎯' : '🔫'})`).join('\n')}\n\n🔵 **BLUE** (Avg: ${Math.round(r.blueAvg)}, HSR: ${Math.round(r.blueHsrAvg || r.blueAvg)})\n${r.blue.map(p => `• ${p.nickname} (${p.position === 'sniper' ? '🎯' : '🔫'})`).join('\n')}\n\n⚖️ **HSR 격차:** ${r.diff} pts` + (r.standby?.length ? `\n\n⌛ **STANDBY**\n${r.standby.map(p => `• ${p.nickname}`).join('\n')}` : "");
          await patchInteraction(APP_ID, token, { content: c + "\n\n즐거운 내전 되세요!", components: [] });
        }
      }
    })());
    return new Response(JSON.stringify({ type: 6 }), { headers: { 'Content-Type': 'application/json' } });
  }

  if (interaction.type === 5) {
    const nick = interaction.data.components[0].components[0].value.trim();
    return new Response(JSON.stringify({ type: 4, data: { content: `👋 **${nick}**님, 포지션을 선택해주세요!`, flags: 64, components: [{ type: 1, components: [{ type: 2, label: "라플 🔫", style: 1, custom_id: `set_pos_rifler_${nick}` }, { type: 2, label: "스나 🎯", style: 1, custom_id: `set_pos_sniper_${nick}` }] }] } }), { headers: { 'Content-Type': 'application/json' } });
  }

  return new Response(JSON.stringify({ type: 1 }), { headers: { 'Content-Type': 'application/json' } });
}
