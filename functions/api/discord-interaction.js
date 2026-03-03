// /functions/api/discord-interaction.js - High Performance Cloudflare Handler
import nacl from 'tweetnacl';

function hexToUint8Array(hex) {
  return new Uint8Array(hex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
}

async function getDoc(projectId, collection, docId) {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collection}/${docId}`;
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const data = await resp.json();
    return fromFirestore(data.fields);
  } catch (e) { return null; }
}

async function setDoc(projectId, collection, docId, data) {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collection}/${docId}`;
  return fetch(url, {
    method: 'PATCH',
    body: JSON.stringify({ fields: toFirestore(data) }),
    headers: { 'Content-Type': 'application/json' }
  });
}

function toFirestore(obj) {
  const fields = {};
  for (const [key, val] of Object.entries(obj)) {
    if (Array.isArray(val)) {
      fields[key] = { arrayValue: { values: val.map(v => (typeof v === 'object' ? { mapValue: { fields: toFirestore(v) } } : { stringValue: String(v) })) } };
    } else if (typeof val === 'number') fields[key] = { doubleValue: val };
    else if (typeof val === 'boolean') fields[key] = { booleanValue: val };
    else fields[key] = { stringValue: String(val) };
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
    else if (val.arrayValue) obj[key] = (val.arrayValue.values || []).map(v => (v.mapValue ? fromFirestore(v.mapValue.fields) : (v.stringValue || v.doubleValue || v.integerValue)));
  }
  return obj;
}

function balanceTeams(players) {
  if (players.length < 2) return null;
  const teamSize = Math.floor(players.length / 2);
  const snipers = players.filter(m => (m.position || 'rifler').toLowerCase() === 'sniper');
  const riflers = players.filter(m => (m.position || 'rifler').toLowerCase() !== 'sniper');
  let best = { red: [], blue: [], standby: [], diff: Infinity };

  const combos = (arr, n) => {
    if (n === 0) return [[]];
    const res = [];
    const f = (p, c) => {
      for (let i = 0; i < c.length; i++) {
        const next = p.concat([c[i]]);
        if (next.length === n) res.push(next);
        else f(next, c.slice(i + 1));
      }
    };
    f([], arr);
    return res;
  };

  for (const rs of combos(snipers, Math.floor(snipers.length / 2))) {
    const need = teamSize - rs.length;
    if (need < 0 || need > riflers.length) continue;
    for (const rr of combos(riflers, need)) {
      const red = [...rs, ...rr];
      const rem = players.filter(p => !red.some(rt => rt.nickname === p.nickname));
      for (const blue of combos(rem, teamSize)) {
        const standby = rem.filter(p => !blue.some(bt => bt.nickname === p.nickname));
        const diff = Math.abs(red.reduce((s, m) => s + (m.mmr || 1200), 0) - blue.reduce((s, m) => s + (m.mmr || 1200), 0));
        if (diff < best.diff) best = { red, blue, standby, diff, redAvg: red.reduce((s, m) => s + (m.mmr || 1200), 0) / red.length, blueAvg: blue.reduce((s, m) => s + (m.mmr || 1200), 0) / blue.length };
      }
    }
  }
  return best;
}

function getActionButtons(count) {
  const btns = [{ type: 2, label: "참가 신청", style: 1, custom_id: "join_match" }, { type: 2, label: "참가 취소", style: 2, custom_id: "leave_match" }, { type: 2, label: "모집 취소", style: 4, custom_id: "cancel_match" }];
  if (count >= 10) btns.push({ type: 2, label: "팀 나누기 (시작)", style: 3, custom_id: "start_balance" });
  return [{ type: 1, components: btns }];
}

async function patchInteraction(appId, token, data) {
  const url = `https://discord.com/api/v10/webhooks/${appId}/${token}/messages/@original`;
  return fetch(url, { method: 'PATCH', body: JSON.stringify(data), headers: { 'Content-Type': 'application/json' } });
}

export async function onRequest(context) {
  const { request, env } = context;
  const PROJECT_ID = env.FIREBASE_PROJECT_ID || "tracking-sa-295db";
  const PUBLIC_KEY = env.DISCORD_PUBLIC_KEY;
  const APP_ID = "1478495458900054300";

  if (!PUBLIC_KEY) return new Response('Config missing', { status: 500 });
  const signature = request.headers.get('x-signature-ed25519');
  const timestamp = request.headers.get('x-signature-timestamp');
  const bodyText = await request.text();

  if (!signature || !timestamp || !nacl.sign.detached.verify(new TextEncoder().encode(timestamp + bodyText), hexToUint8Array(signature), hexToUint8Array(PUBLIC_KEY))) {
    return new Response('Invalid request', { status: 401 });
  }

  const interaction = JSON.parse(bodyText);
  if (interaction.type === 1) return new Response(JSON.stringify({ type: 1 }), { headers: { 'Content-Type': 'application/json' } });

  const guildId = interaction.guild_id || "global";
  const token = interaction.token;

  if (interaction.type === 2) {
    if (interaction.data.name === '대내모집') {
      const hostId = interaction.member?.user?.id || interaction.user?.id;
      context.waitUntil(setDoc(PROJECT_ID, 'match_sessions', guildId, { status: 'RECRUITING', participants: [], hostId, createdAt: new Date().toISOString() }));
      return new Response(JSON.stringify({ type: 4, data: { content: "🎮 **TRACKING SA 내전 모집 시작!** (0/12)\n최소 10명부터 팀 나누기가 가능합니다.", components: getActionButtons(0) } }), { headers: { 'Content-Type': 'application/json' } });
    }

    if (interaction.data.name === '전적검색') {
      context.waitUntil((async () => {
        const nick = (interaction.data.options || []).find(o => o.name === '닉네임')?.value?.trim();
        const queryUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery`;
        const queryBody = { structuredQuery: { from: [{ collectionId: 'sa_crew_members' }], where: { fieldFilter: { field: { fieldPath: 'characterName' }, op: 'EQUAL', value: { stringValue: nick } } }, limit: 1 } };
        const qResp = await fetch(queryUrl, { method: 'POST', body: JSON.stringify(queryBody), headers: { 'Content-Type': 'application/json' } });
        const res = await qResp.json();
        if (!res?.[0]?.document) return patchInteraction(APP_ID, token, { content: `❌ **${nick}**님은 등록되어 있지 않습니다.` });
        const d = fromFirestore(res[0].document.fields);
        const mmr = d.mmr || 1200;
        const hsrScore = d.hsr || 1200;
        const wins = Number(d.wins || 0);
        const loses = Number(d.loses || 0);
        const kills = Number(d.crewKills || 0);
        const deaths = Number(d.crewDeaths || 0);

        const winRate = (wins + loses) > 0 ? ((wins / (wins + loses)) * 100).toFixed(1) + '%' : '0%';
        const kd = deaths > 0 ? (kills / deaths).toFixed(2) : kills.toFixed(2);

        const c = `📊 **[${nick}] 크루원 전적 리포트**\n\n🔹 **MMR:** ${mmr}\n🔹 **HSR 점수:** ${hsrScore}\n🔹 **내전 킬뎃:** ${kd}\n🔹 **내전 승률:** ${winRate}\n\n*TRACKING SA 공식 데이터베이스 기준*`;
        await patchInteraction(APP_ID, token, { content: c });

      })());
      return new Response(JSON.stringify({ type: 5 }), { headers: { 'Content-Type': 'application/json' } });
    }
  }

  if (interaction.type === 3) {
    const cid = interaction.data.custom_id;
    const uid = interaction.member?.user?.id || interaction.user?.id;

    if (cid === 'join_match') return new Response(JSON.stringify({ type: 9, data: { title: "참가 신청", custom_id: "match_entry_modal", components: [{ type: 1, components: [{ type: 4, custom_id: "user_nickname", label: "닉네임", style: 1, min_length: 2, max_length: 16, required: true }] }] } }), { headers: { 'Content-Type': 'application/json' } });

    context.waitUntil((async () => {
      const session = await getDoc(PROJECT_ID, 'match_sessions', guildId);
      if (!session || session.status !== 'RECRUITING') return;

      if (cid === 'leave_match') {
        const idx = (session.participants || []).findIndex(p => p.discordId === uid);
        if (idx !== -1) {
          session.participants.splice(idx, 1);
          await setDoc(PROJECT_ID, 'match_sessions', guildId, session);
          await patchInteraction(APP_ID, token, { content: `🎮 **TRACKING SA 내전 모집 시작!** (${session.participants.length}/12)\n**신청자:** ${session.participants.map(p => p.nickname).join(', ')}`, components: getActionButtons(session.participants.length) });
        }
      }

      if (cid.startsWith('set_pos_')) {
        const parts = cid.split('_');
        const pos = parts[2], nick = parts.slice(3).join('_');
        if (!session.participants.some(p => p.discordId === uid)) {
          session.participants.push({ nickname: nick, discordId: uid, position: pos });
          await setDoc(PROJECT_ID, 'match_sessions', guildId, session);
          await patchInteraction(APP_ID, token, { content: `🎮 **TRACKING SA 내전 모집 시작!** (${session.participants.length}/12)\n**신청자:** ${session.participants.map(p => p.nickname).join(', ')}`, components: getActionButtons(session.participants.length) });
        }
      }

      if (cid === 'start_balance' || cid === 'cancel_match') {
        if (session.hostId !== uid) return;
        if (cid === 'cancel_match') {
          await setDoc(PROJECT_ID, 'match_sessions', guildId, { ...session, status: 'CANCELLED' });
          return patchInteraction(APP_ID, token, { content: "🚫 **내전 모집이 취소되었습니다.**", components: [] });
        }
        if (session.participants.length < 10) return;
        await setDoc(PROJECT_ID, 'match_sessions', guildId, { ...session, status: 'CLOSED' });
        const players = await Promise.all(session.participants.map(async (p) => {
          const qUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery`;
          const qBody = { structuredQuery: { from: [{ collectionId: 'sa_crew_members' }], where: { fieldFilter: { field: { fieldPath: 'characterName' }, op: 'EQUAL', value: { stringValue: p.nickname } } }, limit: 1 } };
          const qResp = await fetch(qUrl, { method: 'POST', body: JSON.stringify(qBody), headers: { 'Content-Type': 'application/json' } });
          const res = await qResp.json(), d = res?.[0]?.document ? fromFirestore(res[0].document.fields) : {};
          return { nickname: p.nickname, mmr: d.mmr || 1200, position: p.position, discordId: p.discordId };
        }));
        const r = balanceTeams(players), m = session.participants.map(p => `<@${p.discordId}>`).join(' ');
        const c = `📢 **팀 구성 완료!**\n${m}\n\n🔴 **RED** (Avg: ${Math.round(r.redAvg)})\n${r.red.map(p => `• ${p.nickname} (${p.position === 'sniper' ? '🎯' : '🔫'})`).join('\n')}\n\n🔵 **BLUE** (Avg: ${Math.round(r.blueAvg)})\n${r.blue.map(p => `• ${p.nickname} (${p.position === 'sniper' ? '🎯' : '🔫'})`).join('\n')}` + (r.standby?.length ? `\n\n⌛ **STANDBY**\n${r.standby.map(p => `• ${p.nickname}`).join('\n')}` : "");
        await patchInteraction(APP_ID, token, { content: c + "\n\n즐거운 내전 되세요!", components: [] });
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
