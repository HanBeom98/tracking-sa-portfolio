// /functions/api/discord-interaction.js - Cloudflare Optimized Handler
import nacl from 'tweetnacl';

/**
 * Helper to convert hex string to Uint8Array
 */
function hexToUint8Array(hex) {
  return new Uint8Array(hex.match(/.{1,2}/g).map(byte => parseInt(hex, 16)));
}

/**
 * Firestore REST API Helper: Get Document
 */
async function getDoc(projectId, collection, docId) {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collection}/${docId}`;
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const data = await resp.json();
    return fromFirestore(data.fields);
  } catch (e) { return null; }
}

/**
 * Firestore REST API Helper: Set Document
 */
async function setDoc(projectId, collection, docId, data) {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collection}/${docId}`;
  const body = { fields: toFirestore(data) };
  return fetch(url, {
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
  for (const redSnipers of combinations(snipers, redSniperCount)) {
    const riflersNeeded = teamSize - redSnipers.length;
    if (riflersNeeded < 0 || riflersNeeded > riflers.length) continue;
    for (const redRiflers of combinations(riflers, riflersNeeded)) {
      const redTeam = [...redSnipers, ...redRiflers];
      const remaining = selectedMembers.filter(p => !redTeam.some(rt => rt.nickname === p.nickname));
      for (const blueTeam of combinations(remaining, teamSize)) {
        const standby = remaining.filter(p => !blueTeam.some(bt => bt.nickname === p.nickname));
        const redScore = redTeam.reduce((sum, m) => sum + (m.mmr || 1200), 0);
        const blueScore = blueTeam.reduce((sum, m) => sum + (m.mmr || 1200), 0);
        const diff = Math.abs(redScore - blueScore);
        if (diff < bestSplit.diff) {
          bestSplit = { red: redTeam, blue: blueTeam, standby, diff, redAvg: redScore / redTeam.length, blueAvg: blueScore / blueTeam.length };
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
  if (count >= 10) components.push({ type: 2, label: "팀 나누기 (시작)", style: 3, custom_id: "start_balance" });
  return [{ type: 1, components }];
}

export async function onRequest(context) {
  const { request, env } = context;
  const PROJECT_ID = env.FIREBASE_PROJECT_ID || "tracking-sa-295db";
  const PUBLIC_KEY = env.DISCORD_PUBLIC_KEY;

  if (!PUBLIC_KEY) return new Response('Config missing', { status: 500 });
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const signature = request.headers.get('x-signature-ed25519');
  const timestamp = request.headers.get('x-signature-timestamp');
  const bodyText = await request.text();

  if (!signature || !timestamp) return new Response('Missing signature', { status: 401 });

  try {
    if (!nacl.sign.detached.verify(new TextEncoder().encode(timestamp + bodyText), hexToUint8Array(signature), hexToUint8Array(PUBLIC_KEY))) {
      return new Response('Invalid signature', { status: 401 });
    }
  } catch (err) { return new Response('Verify failed', { status: 401 }); }

  try {
    const interaction = JSON.parse(bodyText);
    if (interaction.type === 1) return new Response(JSON.stringify({ type: 1 }), { headers: { 'Content-Type': 'application/json' } });

    const guildId = interaction.guild_id || "global";

    if (interaction.type === 2) {
      if (interaction.data.name === '대내모집') {
        const hostId = interaction.member?.user?.id || interaction.user?.id;
        context.waitUntil(setDoc(PROJECT_ID, 'match_sessions', guildId, { status: 'RECRUITING', participants: [], hostId, createdAt: new Date().toISOString() }));
        return new Response(JSON.stringify({ type: 4, data: { content: "🎮 **TRACKING SA 내전 모집 시작!** (0/12)\n최소 10명부터 팀 나누기가 가능합니다.", components: getActionButtons(0) } }), { headers: { 'Content-Type': 'application/json' } });
      }

      if (interaction.data.name === '전적검색') {
        const nick = (interaction.data.options || []).find(o => o.name === '닉네임')?.value?.trim();
        const queryUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery`;
        const queryBody = { structuredQuery: { from: [{ collectionId: 'sa_crew_members' }], where: { fieldFilter: { field: { fieldPath: 'characterName' }, op: 'EQUAL', value: { stringValue: nick } } }, limit: 1 } };
        const queryResp = await fetch(queryUrl, { method: 'POST', body: JSON.stringify(queryBody), headers: { 'Content-Type': 'application/json' } });
        const result = await queryResp.json();
        if (!result?.[0]?.document) return new Response(JSON.stringify({ type: 4, data: { content: `❌ **${nick}**님 정보를 찾을 수 없습니다.`, flags: 64 } }), { headers: { 'Content-Type': 'application/json' } });
        const d = fromFirestore(result[0].document.fields);
        return new Response(JSON.stringify({ type: 4, data: { content: `🔍 **[${nick}]** 전적\n🔹 MMR: ${d.mmr || 1200}\n🔹 헤드샷: ${d.hsr || 0}%\n🔹 포지션: ${(d.position || 'rifler').toUpperCase()}\n🔹 승률: ${d.winRate || '0%'}` } }), { headers: { 'Content-Type': 'application/json' } });
      }
    }

    if (interaction.type === 3) {
      const customId = interaction.data.custom_id;
      const discordId = interaction.member?.user?.id || interaction.user?.id;
      
      if (customId === 'join_match') {
        return new Response(JSON.stringify({ type: 9, data: { title: "대내 참가 신청", custom_id: "match_entry_modal", components: [{ type: 1, components: [{ type: 4, custom_id: "user_nickname", label: "닉네임", style: 1, min_length: 2, max_length: 16, required: true }] }] } }), { headers: { 'Content-Type': 'application/json' } });
      }

      const session = await getDoc(PROJECT_ID, 'match_sessions', guildId);
      if (!session || session.status !== 'RECRUITING') return new Response(JSON.stringify({ type: 4, data: { content: "❌ 활성 모집 없음", flags: 64 } }), { headers: { 'Content-Type': 'application/json' } });

      if (customId === 'leave_match') {
        const idx = (session.participants || []).findIndex(p => p.discordId === discordId);
        if (idx === -1) return new Response(JSON.stringify({ type: 4, data: { content: "⚠️ 신청 내역 없음", flags: 64 } }), { headers: { 'Content-Type': 'application/json' } });
        session.participants.splice(idx, 1);
        context.waitUntil(setDoc(PROJECT_ID, 'match_sessions', guildId, session));
        return new Response(JSON.stringify({ type: 7, data: { content: `🎮 **TRACKING SA 내전 모집 시작!** (${session.participants.length}/12)\n**신청자:** ${session.participants.map(p => p.nickname).join(', ')}`, components: getActionButtons(session.participants.length) } }), { headers: { 'Content-Type': 'application/json' } });
      }

      if (customId.startsWith('set_pos_')) {
        const parts = customId.split('_');
        const pos = parts[2];
        const nick = parts.slice(3).join('_');
        if (session.participants.some(p => p.discordId === discordId)) return new Response(JSON.stringify({ type: 4, data: { content: "⚠️ 이미 신청됨", flags: 64 } }), { headers: { 'Content-Type': 'application/json' } });
        session.participants.push({ nickname: nick, discordId, position: pos });
        context.waitUntil(setDoc(PROJECT_ID, 'match_sessions', guildId, session));
        return new Response(JSON.stringify({ type: 4, data: { content: `✅ **${nick}**님 신청 완료!`, flags: 64 } }), { headers: { 'Content-Type': 'application/json' } });
      }

      if (customId === 'start_balance' || customId === 'cancel_match') {
        if (session.hostId && session.hostId !== discordId) return new Response(JSON.stringify({ type: 4, data: { content: "❌ 권한 없음", flags: 64 } }), { headers: { 'Content-Type': 'application/json' } });
        if (customId === 'cancel_match') {
          context.waitUntil(setDoc(PROJECT_ID, 'match_sessions', guildId, { ...session, status: 'CANCELLED' }));
          return new Response(JSON.stringify({ type: 7, data: { content: "🚫 **모집 취소됨**", components: [] } }), { headers: { 'Content-Type': 'application/json' } });
        }
        if (session.participants.length < 10) return new Response(JSON.stringify({ type: 4, data: { content: "❌ 최소 10인 필요", flags: 64 } }), { headers: { 'Content-Type': 'application/json' } });
        
        // Final Balancing
        context.waitUntil(setDoc(PROJECT_ID, 'match_sessions', guildId, { ...session, status: 'CLOSED' }));
        const players = await Promise.all(session.participants.map(async (p) => {
          const qUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery`;
          const qBody = { structuredQuery: { from: [{ collectionId: 'sa_crew_members' }], where: { fieldFilter: { field: { fieldPath: 'characterName' }, op: 'EQUAL', value: { stringValue: p.nickname } } }, limit: 1 } };
          const qResp = await fetch(qUrl, { method: 'POST', body: JSON.stringify(qBody), headers: { 'Content-Type': 'application/json' } });
          const res = await qResp.json();
          const d = res?.[0]?.document ? fromFirestore(res[0].document.fields) : {};
          return { nickname: p.nickname, mmr: d.mmr || 1200, position: p.position, discordId: p.discordId };
        }));
        const r = balanceTeams(players);
        const m = session.participants.map(p => `<@${p.discordId}>`).join(' ');
        const c = `📢 **팀 구성 완료!**\n${m}\n\n🔴 **RED** (Avg: ${Math.round(r.redAvg)})\n${r.red.map(p => `• ${p.nickname} (${p.position === 'sniper' ? '🎯' : '🔫'})`).join('\n')}\n\n🔵 **BLUE** (Avg: ${Math.round(r.blueAvg)})\n${r.blue.map(p => `• ${p.nickname} (${p.position === 'sniper' ? '🎯' : '🔫'})`).join('\n')}` + (r.standby?.length ? `\n\n⌛ **STANDBY**\n${r.standby.map(p => `• ${p.nickname}`).join('\n')}` : "");
        return new Response(JSON.stringify({ type: 7, data: { content: c + "\n\n즐거운 내전 되세요!", components: [] } }), { headers: { 'Content-Type': 'application/json' } });
      }
    }

    if (interaction.type === 5) {
      const nick = interaction.data.components[0].components[0].value.trim();
      const discordId = interaction.member?.user?.id || interaction.user?.id;
      const session = await getDoc(PROJECT_ID, 'match_sessions', guildId);
      if (!session || session.status !== 'RECRUITING') return new Response(JSON.stringify({ type: 4, data: { content: "❌ 모집 종료", flags: 64 } }), { headers: { 'Content-Type': 'application/json' } });
      if (session.participants?.some(p => p.discordId === discordId)) return new Response(JSON.stringify({ type: 4, data: { content: "⚠️ 이미 신청됨", flags: 64 } }), { headers: { 'Content-Type': 'application/json' } });
      return new Response(JSON.stringify({ type: 4, data: { content: `👋 **${nick}**님, 포지션을 선택해주세요!`, flags: 64, components: [{ type: 1, components: [{ type: 2, label: "라플 🔫", style: 1, custom_id: `set_pos_rifler_${nick}` }, { type: 2, label: "스나 🎯", style: 1, custom_id: `set_pos_sniper_${nick}` }] }] } }), { headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ type: 1 }), { headers: { 'Content-Type': 'application/json' } });
  } catch (error) { return new Response(JSON.stringify({ error: error.message }), { status: 500 }); }
}
