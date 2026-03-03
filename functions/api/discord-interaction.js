// /functions/api/discord-interaction.js - Cloudflare Optimized Handler
import nacl from 'tweetnacl';

/**
 * Firestore REST API Helper: Get Document
 */
async function getDoc(projectId, collection, docId) {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collection}/${docId}`;
  const resp = await fetch(url);
  if (!resp.ok) return null;
  const data = await resp.json();
  return fromFirestore(data.fields);
}

/**
 * Firestore REST API Helper: Set Document (Update/Create)
 */
async function setDoc(projectId, collection, docId, data) {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collection}/${docId}`;
  const body = { fields: toFirestore(data) };
  return await fetch(url, {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * Firestore Field Mapper
 */
function toFirestore(obj) {
  const fields = {};
  for (const [key, val] of Object.entries(obj)) {
    if (Array.isArray(val)) {
      fields[key] = { arrayValue: { values: val.map(v => {
        if (typeof v === 'object') return { mapValue: { fields: toFirestore(v) } };
        return { stringValue: String(v) };
      }) } };
    } else if (typeof val === 'number') {
      fields[key] = { doubleValue: val };
    } else if (typeof val === 'boolean') {
      fields[key] = { booleanValue: val };
    } else {
      fields[key] = { stringValue: String(val) };
    }
  }
  return fields;
}

function fromFirestore(fields) {
  if (!fields) return {};
  const obj = {};
  for (const [key, val] of Object.entries(fields)) {
    if (val.stringValue) obj[key] = val.stringValue;
    else if (val.doubleValue !== undefined) obj[key] = Number(val.doubleValue);
    else if (val.integerValue !== undefined) obj[key] = Number(val.integerValue);
    else if (val.booleanValue !== undefined) obj[key] = val.booleanValue;
    else if (val.arrayValue) {
      obj[key] = (val.arrayValue.values || []).map(v => {
        if (v.mapValue) return fromFirestore(v.mapValue.fields);
        return v.stringValue || v.doubleValue || v.integerValue;
      });
    }
  }
  return obj;
}

/**
 * Team Balancing Logic
 */
function balanceTeams(selectedMembers) {
  const count = selectedMembers.length;
  if (count < 2) return null;
  
  const teamSize = Math.floor(count / 2);
  const snipers = selectedMembers.filter(m => (m.position || 'rifler').toLowerCase() === 'sniper');
  const riflers = selectedMembers.filter(m => (m.position || 'rifler').toLowerCase() !== 'sniper');
  
  let bestSplit = { red: [], blue: [], standby: [], diff: Infinity };

  const combinations = (array, size) => {
    if (size === 0) return [[]];
    const results = [];
    const f = (prefix, chars) => {
      for (let i = 0; i < chars.length; i++) {
        const nextPrefix = prefix.concat([chars[i]]);
        if (nextPrefix.length === size) results.push(nextPrefix);
        else f(nextPrefix, chars.slice(i + 1));
      }
    };
    f([], array);
    return results;
  };

  const redSniperCount = Math.floor(snipers.length / 2);
  const sniperCombos = combinations(snipers, redSniperCount);

  for (const redSnipers of sniperCombos) {
    const riflersNeededForRed = teamSize - redSnipers.length;
    if (riflersNeededForRed < 0 || riflersNeededForRed > riflers.length) continue;
    
    const riflerCombos = combinations(riflers, riflersNeededForRed);
    for (const redRiflers of riflerCombos) {
      const redTeam = [...redSnipers, ...redRiflers];
      const remainingPlayers = selectedMembers.filter(p => !redTeam.some(rt => rt.nickname === p.nickname));
      
      const blueTeamCombos = combinations(remainingPlayers, teamSize);
      for (const blueTeam of blueTeamCombos) {
        const standby = remainingPlayers.filter(p => !blueTeam.some(bt => bt.nickname === p.nickname));
        
        const redScore = redTeam.reduce((sum, m) => sum + (m.mmr || 1200), 0);
        const blueScore = blueTeam.reduce((sum, m) => sum + (m.mmr || 1200), 0);
        const diff = Math.abs(redScore - blueScore);
        
        if (diff < bestSplit.diff) {
          bestSplit = {
            red: redTeam,
            blue: blueTeam,
            standby,
            diff,
            redAvg: redScore / redTeam.length,
            blueAvg: blueScore / blueTeam.length
          };
        }
      }
    }
  }
  return bestSplit;
}

function getActionButtons(count) {
  const components = [
    { type: 2, label: "참가 신청", style: 1, custom_id: "join_match" },
    { type: 2, label: "참가 취소", style: 2, custom_id: "leave_match" },
    { type: 2, label: "모집 취소", style: 4, custom_id: "cancel_match" }
  ];
  if (count >= 10) {
    components.push({ type: 2, label: "팀 나누기 (시작)", style: 3, custom_id: "start_balance" });
  }
  return [{ type: 1, components }];
}

export async function onRequest(context) {
  const { request, env } = context;
  const PROJECT_ID = env.FIREBASE_PROJECT_ID || "tracking-sa-295db";
  const PUBLIC_KEY = env.DISCORD_PUBLIC_KEY;

  if (!PUBLIC_KEY) return new Response('DISCORD_PUBLIC_KEY is missing', { status: 500 });
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const signature = request.headers.get('x-signature-ed25519');
  const timestamp = request.headers.get('x-signature-timestamp');
  const body = await request.clone().text();

  if (!signature || !timestamp) return new Response('Missing signature', { status: 401 });

  try {
    const isVerified = nacl.sign.detached.verify(
      new TextEncoder().encode(timestamp + body),
      new Uint8Array(signature.match(/.{1,2}/g).map(byte => parseInt(byte, 16))),
      new Uint8Array(PUBLIC_KEY.match(/.{1,2}/g).map(byte => parseInt(byte, 16)))
    );
    if (!isVerified) return new Response('invalid request signature', { status: 401 });
  } catch (err) { return new Response('Verification failed', { status: 401 }); }

  try {
    const interaction = JSON.parse(body);
    if (interaction.type === 1) return new Response(JSON.stringify({ type: 1 }), { headers: { 'Content-Type': 'application/json' } });

    // Move guildId declaration here so all types can access it
    const guildId = interaction.guild_id || "global";

    // 2. Slash Command (Type 2)
    if (interaction.type === 2) {
      const commandName = interaction.data.name;

      if (commandName === '대내모집') {
        const hostId = interaction.member?.user?.id || interaction.user?.id;
        await setDoc(PROJECT_ID, 'match_sessions', guildId, {
          status: 'RECRUITING',
          participants: [],
          hostId,
          createdAt: new Date().toISOString()
        });

        return new Response(JSON.stringify({
          type: 4,
          data: {
            content: "🎮 **TRACKING SA 내전 인원 모집 시작!** (0/12)\n최소 10명부터 팀 나누기가 가능하며, 최대 12명까지 신청 가능합니다.",
            components: getActionButtons(0)
          }
        }), { headers: { 'Content-Type': 'application/json' } });
      }

      if (commandName === '전적검색') {
        const nicknameOption = interaction.data.options.find(opt => opt.name === '닉네임');
        const nickname = nicknameOption?.value?.trim();
        if (!nickname) return new Response(JSON.stringify({ type: 4, data: { content: "⚠️ 닉네임을 입력해주세요.", flags: 64 } }), { headers: { 'Content-Type': 'application/json' } });

        const queryUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery`;
        const queryBody = { structuredQuery: { from: [{ collectionId: 'sa_crew_members' }], where: { fieldFilter: { field: { fieldPath: 'characterName' }, op: 'EQUAL', value: { stringValue: nickname } } }, limit: 1 } };
        const queryResp = await fetch(queryUrl, { method: 'POST', body: JSON.stringify(queryBody), headers: { 'Content-Type': 'application/json' } });
        const queryResult = await queryResp.json();

        if (!queryResult || !queryResult[0] || !queryResult[0].document) {
          return new Response(JSON.stringify({ type: 4, data: { content: `❌ **${nickname}** 님은 등록되어 있지 않습니다.`, flags: 64 } }), { headers: { 'Content-Type': 'application/json' } });
        }

        const data = fromFirestore(queryResult[0].document.fields);
        return new Response(JSON.stringify({
          type: 4,
          data: { content: `🔍 **[${nickname}]** 전적 정보\n\n🔹 MMR: ${data.mmr || 1200}\n🔹 헤드샷: ${data.hsr || 0}%\n🔹 포지션: ${(data.position || 'rifler').toUpperCase()}\n🔹 승률: ${data.winRate || '0%'}` }
        }), { headers: { 'Content-Type': 'application/json' } });
      }
    }

    // 3. Button Clicks (Type 3)
    if (interaction.type === 3) {
      const customId = interaction.data.custom_id;
      const discordId = interaction.member?.user?.id || interaction.user?.id;
      const session = await getDoc(PROJECT_ID, 'match_sessions', guildId);

      if (!session || session.status !== 'RECRUITING') {
        return new Response(JSON.stringify({ type: 4, data: { content: "❌ 활성화된 모집이 없습니다.", flags: 64 } }), { headers: { 'Content-Type': 'application/json' } });
      }

      if (customId === 'join_match') {
        return new Response(JSON.stringify({
          type: 9,
          data: {
            title: "대내 참가 신청",
            custom_id: "match_entry_modal",
            components: [{ type: 1, components: [{ type: 4, custom_id: "user_nickname", label: "서든어택 닉네임", style: 1, min_length: 2, max_length: 16, placeholder: "정확한 닉네임을 입력하세요.", required: true }] }]
          }
        }), { headers: { 'Content-Type': 'application/json' } });
      }

      if (customId === 'leave_match') {
        const participants = session.participants || [];
        const userIndex = participants.findIndex(p => p.discordId === discordId);
        if (userIndex === -1) return new Response(JSON.stringify({ type: 4, data: { content: "⚠️ 신청 내역이 없습니다.", flags: 64 } }), { headers: { 'Content-Type': 'application/json' } });
        participants.splice(userIndex, 1);
        await setDoc(PROJECT_ID, 'match_sessions', guildId, { ...session, participants });
        return new Response(JSON.stringify({ type: 7, data: { content: `🎮 **TRACKING SA 내전 인원 모집 시작!** (${participants.length}/12)\n**현재 신청자:** ${participants.map(p => p.nickname).join(', ')}`, components: getActionButtons(participants.length) } }), { headers: { 'Content-Type': 'application/json' } });
      }

      if (customId.startsWith('set_pos_')) {
        const [_, __, position, nickname] = customId.split('_'); // set_pos_rifler_NICKNAME
        const participants = session.participants || [];
        if (participants.some(p => p.discordId === discordId)) return new Response(JSON.stringify({ type: 4, data: { content: "⚠️ 이미 신청되었습니다.", flags: 64 } }), { headers: { 'Content-Type': 'application/json' } });
        if (participants.length >= 12) return new Response(JSON.stringify({ type: 4, data: { content: "❌ 모집 완료.", flags: 64 } }), { headers: { 'Content-Type': 'application/json' } });

        participants.push({ nickname, discordId, position });
        await setDoc(PROJECT_ID, 'match_sessions', guildId, { ...session, participants });

        return new Response(JSON.stringify({
          type: 4, // 7 (UPDATE_MESSAGE) works only on the original message, but here we update the recruit msg
          data: { content: `✅ **${nickname}**님, **${position === 'sniper' ? '스나이퍼' : '라이플러'}**로 신청 완료!`, flags: 64 }
        }), { headers: { 'Content-Type': 'application/json' } });
      }

      if (customId === 'start_balance' || customId === 'cancel_match') {
        if (session.hostId && session.hostId !== discordId) return new Response(JSON.stringify({ type: 4, data: { content: "❌ 호스트 권한이 없습니다.", flags: 64 } }), { headers: { 'Content-Type': 'application/json' } });
        if (customId === 'cancel_match') {
          await setDoc(PROJECT_ID, 'match_sessions', guildId, { ...session, status: 'CANCELLED' });
          return new Response(JSON.stringify({ type: 7, data: { content: "🚫 **내전 모집이 취소되었습니다.**", components: [] } }), { headers: { 'Content-Type': 'application/json' } });
        }
        const participants = session.participants || [];
        if (participants.length < 10) return new Response(JSON.stringify({ type: 4, data: { content: "❌ 최소 10명이 필요합니다.", flags: 64 } }), { headers: { 'Content-Type': 'application/json' } });

        await setDoc(PROJECT_ID, 'match_sessions', guildId, { ...session, status: 'CLOSED' });
        const playerData = await Promise.all(participants.map(async (p) => {
          try {
            const queryUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery`;
            const queryBody = { structuredQuery: { from: [{ collectionId: 'sa_crew_members' }], where: { fieldFilter: { field: { fieldPath: 'characterName' }, op: 'EQUAL', value: { stringValue: p.nickname } } }, limit: 1 } };
            const queryResp = await fetch(queryUrl, { method: 'POST', body: JSON.stringify(queryBody), headers: { 'Content-Type': 'application/json' } });
            const queryResult = await queryResp.json();
            if (queryResult && queryResult[0] && queryResult[0].document) {
              const data = fromFirestore(queryResult[0].document.fields);
              return { nickname: p.nickname, mmr: data.mmr || 1200, position: p.position }; // Use selected position
            }
          } catch (e) {}
          return { nickname: p.nickname, mmr: 1200, position: p.position };
        }));

        const result = balanceTeams(playerData);
        const mentions = participants.map(p => `<@${p.discordId}>`).join(' ');
        let content = `📢 **팀 구성이 완료되었습니다! 확인해 주세요.**\n${mentions}\n\n🔥 **팀 밸런싱 결과 (${participants.length}인)**\n\n🔴 **RED** (Avg: ${Math.round(result.redAvg)})\n${result.red.map(p => `• ${p.nickname} (${p.position === 'sniper' ? '🎯' : '🔫'})`).join('\n')}\n\n🔵 **BLUE** (Avg: ${Math.round(result.blueAvg)})\n${result.blue.map(p => `• ${p.nickname} (${p.position === 'sniper' ? '🎯' : '🔫'})`).join('\n')}`;
        if (result.standby?.length > 0) content += `\n\n⌛ **STANDBY**\n${result.standby.map(p => `• ${p.nickname}`).join('\n')}`;
        return new Response(JSON.stringify({ type: 7, data: { content: content + "\n\n즐거운 내전 되세요!", components: [] } }), { headers: { 'Content-Type': 'application/json' } });
      }
    }

    // 4. Modal Submit (Type 5)
    if (interaction.type === 5 && interaction.data.custom_id === 'match_entry_modal') {
      const nickname = interaction.data.components[0].components[0].value.trim();
      const discordId = interaction.member?.user?.id || interaction.user?.id;
      const session = await getDoc(PROJECT_ID, 'match_sessions', guildId);

      if (!session || session.status !== 'RECRUITING') return new Response(JSON.stringify({ type: 4, data: { content: "❌ 종료된 모집입니다.", flags: 64 } }), { headers: { 'Content-Type': 'application/json' } });
      if (session.participants?.some(p => p.discordId === discordId)) return new Response(JSON.stringify({ type: 4, data: { content: "⚠️ 이미 신청됨.", flags: 64 } }), { headers: { 'Content-Type': 'application/json' } });

      // Ask for position after nickname submission
      return new Response(JSON.stringify({
        type: 4,
        data: {
          content: `👋 **${nickname}**님, 주 포지션을 선택해주세요!`,
          flags: 64, // Ephemeral
          components: [{
            type: 1,
            components: [
              { type: 2, label: "라이플러 🔫", style: 1, custom_id: `set_pos_rifler_${nickname}` },
              { type: 2, label: "스나이퍼 🎯", style: 1, custom_id: `set_pos_sniper_${nickname}` }
            ]
          }]
        }
      }), { headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ type: 1 }), { headers: { 'Content-Type': 'application/json' } });
  } catch (error) { return new Response(JSON.stringify({ error: error.message }), { status: 500 }); }
}
