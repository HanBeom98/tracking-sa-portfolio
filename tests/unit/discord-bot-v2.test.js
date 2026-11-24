import test from 'node:test';
import assert from 'node:assert/strict';
import { DISCORD_TEST_APPLICATION_ID as APP, createDiscordSignatureFixture } from '../fixtures/discord-interaction.js';
import { onRequest } from '../../functions/api/discord-interaction.js';
import { discordCommands } from '../../functions/discord/commands.js';
import { displayText, helpMessage } from '../../functions/discord/messages.js';
import { commandAttachment, attachmentUrl, MAX_REPLAY_BYTES, replayControl, replayMessage, replaySession } from '../../functions/discord/replay.js';
import { MAX_REPLAY_HEADER_BYTES } from '../../functions/discord/replay-header.js';
import { contextFixture } from '../fixtures/replay-context.js';
import { resetSaProxyCacheForTests } from '../../functions/api/sa-proxy.js';

const { publicKey, signedRequest: signedRawRequest } = createDiscordSignatureFixture();
const env = { DISCORD_PUBLIC_KEY: publicKey, DISCORD_REPLAY_ENABLED: 'true', DISCORD_BOT_VERSION: '2', NEXON_API_KEY: 'unit-test-placeholder' };
const fileURL = 'https://cdn.discordapp.com/attachments/111/222/replay.json?ex=ffffffff&is=12345678&hm=synthetic';
let sequence = 1000;
function interaction(name, options = []) {
  return { type: 2, id: String(++sequence), application_id: APP, guild_id: '123', token: 'test-interaction-token',
    member: { user: { id: String(sequence) } }, data: { name, options } };
}
function fileCommand() {
  const input = interaction('리플레이', [{ name: '파일', value: '222' }]);
  input.data.resolved = { attachments: { '222': { id: '222', filename: 'replay.json', size: 1000, url: fileURL } } };
  return input;
}
function signedRequest(value, raw = JSON.stringify(value)) {
  return signedRawRequest(raw);
}
function session(overrides = {}) {
  return { owner: '101', expires: Math.floor(Date.now() / 1000) + 900, action: 'summary', url: fileURL, ...overrides };
}
const fixtureFetch = async () => Response.json(contextFixture());
function componentFor(state, value = 'focus') {
  return { type: 3, application_id: APP, member: { user: { id: state.owner } },
    data: { custom_id: replayControl(state.owner, state.expires, 'select'), values: [value] },
    message: { components: [{ type: 1, components: [{ type: 2, style: 5, label: '첨부한 JSON', url: state.url }] }] } };
}

test('v2 manifest contains three commands and native attachment/private-or-public choices', () => {
  assert.deepEqual(discordCommands.map(command => command.name), ['전적', '리플레이', '도움말']);
  assert.equal(discordCommands[1].options[0].type, 11);
  assert.equal(discordCommands[1].options[1].type, 5);
  assert.match(discordCommands[1].options[1].description, /원본 JSON.*공개/);
});

test('help is immediate and private, with no network, database, or AI request', async () => {
  const original = globalThis.fetch; let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error('No network expected'); };
  try {
    const response = await onRequest({ request: signedRequest(interaction('도움말')), env });
    const result = await response.json();
    assert.equal(result.type, 4); assert.equal(result.data.flags, 64); assert.equal(calls, 0);
    assert.match(result.data.embeds[0].description, /기본으로 채널에 공개/);
    assert.match(result.data.embeds[0].description, /공개:거짓/);
    assert.match(result.data.embeds[0].description, /별도 DB에 저장하지 않습니다/);
    assert.deepEqual(result.data.allowed_mentions, { parse: [] });
  } finally { globalThis.fetch = original; }
});

test('signed interactions for another application and malformed signed JSON are rejected', async () => {
  const input = interaction('도움말'); input.application_id = '999';
  assert.equal((await onRequest({ request: signedRequest(input), env })).status, 401);
  assert.equal((await onRequest({ request: signedRequest(null, '{broken'), env })).status, 400);
  assert.equal((await onRequest({ request: signedRequest(null), env })).status, 400);
});

test('cutover stops legacy commands and components before any storage write', async () => {
  for (const input of [interaction('대내모집'), { ...interaction('unused'), type: 3, data: { custom_id: 'start_balance' } }]) {
    const response = await onRequest({ request: signedRequest(input), env, waitUntil() { assert.fail('No legacy task allowed'); } });
    const result = await response.json();
    assert.equal(result.type, 4); assert.equal(result.data.flags, 64);
    assert.match(result.data.embeds[0].description, /기존 내전 명령은 종료/);
  }
});

test('replay stays off until explicitly enabled and does not fetch the file', async () => {
  const response = await onRequest({ request: signedRequest(fileCommand()), env: { ...env, DISCORD_REPLAY_ENABLED: undefined }, waitUntil() { assert.fail('No analysis when disabled'); } });
  assert.match((await response.json()).data.content, /준비 중/);
});

test('replay trial enables only the chosen guild without globally enabling analysis', async () => {
  const original = globalThis.fetch, tasks = [];
  globalThis.fetch = async url => String(url).startsWith('https://cdn.discordapp.com/') ? Response.json(contextFixture()) : Response.json({});
  const trialEnv = { ...env, DISCORD_REPLAY_ENABLED: undefined, DISCORD_REPLAY_TEST_GUILD: '123' };
  try {
    const chosen = await onRequest({ request: signedRequest(fileCommand()), env: trialEnv, waitUntil: task => tasks.push(task) });
    assert.deepEqual(await chosen.json(), { type: 5, data: { flags: 0 } });
    await Promise.all(tasks);
    const other = fileCommand(); other.guild_id = '456';
    const blocked = await onRequest({ request: signedRequest(other), env: trialEnv, waitUntil() { assert.fail('Other guild must not run'); } });
    assert.match((await blocked.json()).data.content, /준비 중/);
  } finally { globalThis.fetch = original; }
});

test('attachment metadata and URLs reject missing files, oversized files, arbitrary hosts and redirects', async () => {
  assert.throws(() => commandAttachment(interaction('리플레이')), /FILE_REQUIRED/);
  const large = fileCommand(); large.data.resolved.attachments['222'].size = MAX_REPLAY_BYTES + 1;
  assert.throws(() => commandAttachment(large), /FILE_TOO_LARGE/);
  const mismatch = fileCommand(); mismatch.data.resolved.attachments['222'].id = '333';
  assert.throws(() => commandAttachment(mismatch), /FILE_REQUIRED/);
  for (const url of [
    'https://example.com/replay.json', 'http://cdn.discordapp.com/attachments/1/2/a.json',
    'https://cdn.discordapp.com.evil.test/attachments/1/2/a.json',
    'https://demo-49788d3e@example.com/attachments/1/2/a.json',
    'https://cdn.discordapp.com/attachments/1/2/a.txt',
    'https://cdn.discordapp.com/attachments/1/2/a%2F.json',
  ]) assert.throws(() => attachmentUrl(url));
  assert.equal(attachmentUrl(fileURL), fileURL);
  await replayMessage(session(), { fetchImpl: async (url, options) => {
    assert.equal(url, fileURL); assert.equal(options.redirect, 'manual');
    return Response.json(contextFixture());
  } });
});

test('replay reads a bounded prefix and cancels remaining bytes instead of parsing large payloads', async () => {
  let cancelled = false;
  const stream = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(MAX_REPLAY_BYTES + 1)); }, cancel() { cancelled = true; } });
  await assert.rejects(replayMessage(session(), { fetchImpl: async () => new Response(stream) }), /INVALID_JSON/);
  assert.equal(cancelled, true);
  await assert.rejects(replayMessage(session(), { fetchImpl: async () => new Response('gone', { status: 403 }) }), /ATTACHMENT_EXPIRED/);
  await assert.rejects(replayMessage(session(), { fetchImpl: async () => new Response('not JSON') }), /INVALID_JSON/);
  await assert.rejects(replayMessage(session(), {fetchImpl: async () => new Response('{}', {headers:{'Content-Length': String(MAX_REPLAY_BYTES+1)}})}), /FILE_TOO_LARGE/);
});

test('slash-command ephemeral attachment URLs work without accepting non-Discord origins or other paths', async () => {
  const url = fileURL.replace('/attachments/', '/ephemeral-attachments/');
  const input = fileCommand();
  input.data.resolved.attachments['222'].url = url;
  input.data.resolved.attachments['222'].ephemeral = true;
  assert.equal(commandAttachment(input), url);
  const result = await replayMessage(session({url}), {fetchImpl: async (actual, options) => {
    assert.equal(actual, url); assert.equal(options.redirect, 'manual');
    return Response.json(contextFixture());
  }});
  assert.match(result.embeds[0].title, /요약 준비 완료/);
  assert.throws(() => attachmentUrl(url.replace('cdn.discordapp.com','evil.test')), /ATTACHMENT_INVALID/);
  assert.throws(() => attachmentUrl(url.replace('/ephemeral-attachments/','/other-attachments/')), /ATTACHMENT_INVALID/);
});

test('header validation rejects invalid or duplicate selectable IDs and oversized rosters', async () => {
  for (const change of [
    fixture => { fixture.replay_info.replayCharacterSummaryInfo = Array(26).fill(fixture.replay_info.replayCharacterSummaryInfo[0]); },
    fixture => { fixture.replay_info.replayCharacterSummaryInfo[0].nexonSN = '@everyone'; },
    fixture => { fixture.replay_info.replayCharacterSummaryInfo[0].nexonSN = 'mate'; },
  ]) {
    const fixture = contextFixture(); change(fixture);
    await assert.rejects(replayMessage(session(), { fetchImpl: async () => Response.json(fixture) }), /UNSUPPORTED_REPLAY/);
  }
});

test('Workers-compatible manual redirects are rejected without fetching the redirect target', async () => {
  let calls = 0, cancelled = false;
  const body = new ReadableStream({start(controller) {controller.enqueue(new Uint8Array([1]));},cancel() {cancelled=true;}});
  await assert.rejects(replayMessage(session(), {fetchImpl: async (url, options) => {
    calls++; assert.equal(url,fileURL); assert.equal(options.redirect,'manual');
    return new Response(body,{status:302,headers:{Location:'http://169.254.169.254/private'}});
  }}), /ATTACHMENT_INVALID/);
  assert.equal(calls,1); assert.equal(cancelled,true);
});

test('Range reads retain only the header and cancel a server that sends the full file', async () => {
  const header = JSON.stringify(contextFixture());
  const encoder = new TextEncoder();
  let cancelled = false, reads = 0;
  const stream = new ReadableStream({pull(controller) {
    reads++;
    controller.enqueue(encoder.encode(reads === 1 ? header + ' '.repeat(MAX_REPLAY_HEADER_BYTES) : 'never read'));
  },cancel() {cancelled=true;}}, {highWaterMark: 0});
  let cached;
  const result = await replayMessage(session(), {fetchImpl: async (url,options) => {
    assert.equal(options.headers.Range, `bytes=0-${MAX_REPLAY_HEADER_BYTES-1}`);
    return new Response(stream);
  }, cache: {get:()=>null,set:(state,value)=>{cached=value;}}});
  assert.equal(reads,1); assert.equal(cancelled,true);
  assert.equal(cached.bytes,MAX_REPLAY_HEADER_BYTES);
  assert.equal(cached.header.players.length,6);
  assert.equal('parsed' in cached,false);
  assert.match(result.embeds[0].title,/요약 준비/);
});

test('206 Content-Range must start at zero and honor the declared full-file size limit', async () => {
  for(const range of ['bytes 1-100/1000','bytes 0-100/50',null]) {
    await assert.rejects(replayMessage(session(), {fetchImpl: async()=>new Response('{}',
      {status:206,headers:range?{'Content-Range':range}:{}})}), /ATTACHMENT_INVALID/);
  }
  await assert.rejects(replayMessage(session(), {fetchImpl:async()=>new Response('{}',
    {status:206,headers:{'Content-Range':`bytes 0-100/${MAX_REPLAY_BYTES+1}`}})}), /FILE_TOO_LARGE/);
  const data=JSON.stringify(contextFixture());
  const result=await replayMessage(session(), {fetchImpl:async()=>new Response(data,
    {status:206,headers:{'Content-Range':`bytes 0-${new TextEncoder().encode(data).length-1}/10000`}})});
  assert.match(result.embeds[0].title,/요약 준비/);
});

test('unusual layouts fall back to the website without a second download or invented statistics', async () => {
  let calls=0;
  const text='{"replay_info":{"replayRoundInfo":['+' '.repeat(MAX_REPLAY_HEADER_BYTES);
  const result=await replayMessage(session(), {fetchImpl:async()=>{calls++;return new Response(text);}});
  assert.equal(calls,1); assert.match(result.embeds[0].title,/웹 분석실/);
  assert.equal(result.embeds[0].fields,undefined);
  assert.ok(result.components[0].components.every(component=>component.style===5));
  assert.match(result.embeds[0].footer.text,/전체 파일을 검사한 결과가 아닙니다/);
});

test('file selection provides a roster, source link and truthful website handoff', async () => {
  const result = await replayMessage(session(), { fetchImpl: fixtureFetch });
  assert.match(result.embeds[0].title, /요약 준비 완료/);
  assert.equal(result.components[0].components[0].options.length, 6);
  assert.equal(result.components.at(-1).components.find(component=>component.label==='첨부한 JSON').url, fileURL);
  assert.match(helpMessage().embeds[0].description, /같은 JSON을 다시 선택/);
});

test('component state is owner-bound, expires, requires one player, and validates its attachment origin', () => {
  const state = session(), input = componentFor(state);
  assert.equal(replaySession(input).playerId, 'focus');
  input.member.user.id = '999'; assert.throws(() => replaySession(input), /SESSION_OWNER/);
  input.member.user.id = state.owner;
  assert.throws(() => replaySession(input, state.expires * 1000), /SESSION_EXPIRED/);
  assert.throws(() => replaySession(input, (state.expires - 901) * 1000), /SESSION_EXPIRED/);
  input.data.values = []; assert.throws(() => replaySession(input), /PLAYER_NOT_FOUND/);
  input.data.values = ['focus', 'mate']; assert.throws(() => replaySession(input), /PLAYER_NOT_FOUND/);
  input.data.values = ['focus']; input.message.components[0].components[0].url = 'https://evil.test/a.json';
  assert.throws(() => replaySession(input), /ATTACHMENT_INVALID/);
});

test('summary and stale detail buttons show header stats with an explicit website handoff', async () => {
  for (const action of ['summary', 'moments', 'rounds']) {
    const result = await replayMessage(session({ playerId: 'focus', action }), { fetchImpl: fixtureFetch });
    assert.match(result.embeds[0].title, /focus/);
    const encoded = JSON.stringify(result);
    assert.doesNotMatch(encoded, /\[object Object\]|NaN|Infinity/);
    assert.match(result.embeds[0].footer.text, /AI 호출·이용권 차감 없음/);
    assert.equal(result.components[0].components[0].options.find(item => item.value === 'focus').default, true);
    assert.equal(result.components[1].components.length, 3);
    assert.ok(result.components[1].components.every(component=>component.style===5));
    assert.equal(result.embeds[0].fields.find(field=>field.name==='피해량').value,'정보 없음');
    assert.equal(result.embeds[0].fields.some(field=>field.name==='평균 생존'),false);
    assert.match(result.embeds[0].fields.find(field=>field.name==='상세 분석').value,/같은 JSON/);
    assert.deepEqual(result.allowed_mentions, { parse: [] });
    for (const field of result.embeds[0].fields) { assert.ok(field.name.length <= 256); assert.ok(field.value.length <= 1024); }
  }
  await assert.rejects(replayMessage(session({ playerId: 'not-in-file' }), { fetchImpl: fixtureFetch }), /PLAYER_NOT_FOUND/);
});

test('display values neutralize mentions and Markdown from file-controlled names', () => {
  const text = displayText('@everyone **bad** <@123> [label](https://evil.test)\n');
  assert.ok(!text.includes('@')); assert.match(text, /\\\*/); assert.ok(!text.includes('\n'));
});

test('replay command defers before file completion, defaults public, and never writes to Firestore', async () => {
  const original = globalThis.fetch, calls = [], tasks = [];
  let complete;
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    if (String(url).startsWith('https://cdn.discordapp.com/')) return new Promise(resolve => { complete = () => resolve(Response.json(contextFixture())); });
    if (String(url).startsWith('https://discord.com/api/v10/webhooks/')) return Response.json({});
    throw new Error('Unexpected outbound request');
  };
  try {
    const response = await onRequest({ request: signedRequest(fileCommand()), env, waitUntil: task => tasks.push(task) });
    assert.deepEqual(await response.json(), { type: 5, data: { flags: 0 } });
    assert.equal(tasks.length, 1);
    complete(); await Promise.all(tasks);
    assert.equal(calls.length, 2); assert.equal(calls[1].options.method, 'PATCH');
    assert.match(JSON.parse(calls[1].options.body).embeds[0].title, /요약 준비/);
    assert.ok(JSON.parse(calls[1].options.body).components.flatMap(row => row.components).some(item => item.label === '첨부한 JSON'));
    assert.ok(!calls.some(call => /firestore|openai|cloudfunctions/.test(call.url)));
  } finally { globalThis.fetch = original; }
});

test('explicit private replay remains private through the completed response', async () => {
  const original = globalThis.fetch, tasks = [], calls = [], input = fileCommand();
  input.data.options.push({ name: '공개', value: false });
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    return String(url).startsWith('https://cdn.discordapp.com/') ? Response.json(contextFixture()) : Response.json({});
  };
  try {
    const response = await onRequest({ request: signedRequest(input), env, waitUntil: task => tasks.push(task) });
    assert.deepEqual(await response.json(), { type: 5, data: { flags: 64 } });
    await Promise.all(tasks);
    assert.equal(calls.length, 2);
    assert.equal(calls[1].options.method, 'PATCH');
    assert.equal(JSON.parse(calls[1].options.body).flags, undefined);
  } finally { globalThis.fetch = original; }
});

test('other viewers cannot change a public replay or trigger file reads', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => assert.fail('Non-owner must not read or update anything');
  const state = session({ owner: String(++sequence) });
  const input = componentFor(state);
  input.member.user.id = String(++sequence);
  input.message.flags = 0;
  try {
    const response = await onRequest({ request: signedRequest(input), env, waitUntil() { assert.fail('Non-owner task'); } });
    const result = await response.json();
    assert.equal(result.type, 4);
    assert.equal(result.data.flags, 64);
    assert.match(result.data.content, /요청한 사람만/);
  } finally { globalThis.fetch = original; }
});

test('explicit public replay stays supported, repeated requests throttle, and component errors preserve the existing result', async () => {
  const original = globalThis.fetch, tasks = [], input = fileCommand();
  input.data.options.push({ name: '공개', value: true });
  globalThis.fetch = async url => String(url).includes('cdn.discordapp.com') ? Response.json(contextFixture()) : Response.json({});
  try {
    const first = await onRequest({ request: signedRequest(input), env, waitUntil: task => tasks.push(task) });
    assert.deepEqual(await first.json(), { type: 5, data: { flags: 0 } });
    await Promise.all(tasks);
    const repeated = await onRequest({ request: signedRequest(input), env, waitUntil() { assert.fail('Repeated task'); } });
    assert.match((await repeated.json()).data.content, /5초/);
    const expired = componentFor(session({ owner: input.member.user.id, expires: Math.floor(Date.now() / 1000) - 1 }));
    const response = await onRequest({ request: signedRequest(expired), env });
    const result = await response.json(); assert.equal(result.type, 4); assert.equal(result.data.flags, 64);
  } finally { globalThis.fetch = original; }
});

test('profile defers before Nexon completion, reuses the proxy, handles missing metrics and links to the player', async () => {
  const original = globalThis.fetch, tasks = [], calls = [];
  const input = interaction('전적', [{ name: '닉네임', value: 'BotTest' }]);
  let complete;
  resetSaProxyCacheForTests();
  globalThis.fetch = async (url, options) => {
    const target = new URL(String(url)); calls.push({ url: target.href, options });
    if (target.hostname === 'open.api.nexon.com') {
      if (target.pathname.endsWith('/id')) return new Promise(resolve => { complete = () => resolve(Response.json({ ouid: 'bot-test-player' })); });
      if (target.pathname.endsWith('/recent-info')) return Response.json({ recent_win_rate: 55.5, recent_kill_death_rate: 60 });
      if (target.pathname.endsWith('/tier')) return Response.json({ solo_rank_match_tier: '골드', solo_rank_match_score: 1000 });
    }
    if (target.hostname === 'discord.com') return Response.json({});
    throw new Error('Unexpected request');
  };
  try {
    const response = await onRequest({ request: signedRequest(input), env, waitUntil: task => tasks.push(task) });
    assert.deepEqual(await response.json(), { type: 5, data: { flags: 0 } });
    assert.equal(tasks.length, 1); assert.equal(calls.length, 1);
    complete(); await Promise.all(tasks);
    assert.equal(calls.length, 4);
    const result = JSON.parse(calls.at(-1).options.body);
    assert.equal(result.embeds[0].fields.find(field => field.name === '최근 승률').value, '55.5%');
    assert.equal(result.embeds[0].fields.find(field => field.name === '돌격 정확도').value, '정보 없음');
    assert.match(result.components[0].components[0].url, /\?n=BotTest$/);
    assert.deepEqual(result.allowed_mentions, { parse: [] });
  } finally { globalThis.fetch = original; resetSaProxyCacheForTests(); }
});

for (const flags of [0, 64]) test(`component selection preserves message visibility ${flags} without new storage`, async () => {
  const original = globalThis.fetch, tasks = [], calls = [];
  const state = session({ owner: String(++sequence) });
  const input = { ...componentFor(state), token: 'component-token' };
  input.message.flags = flags;
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    if (String(url).startsWith('https://cdn.discordapp.com/')) return Response.json(contextFixture());
    if (String(url).startsWith('https://discord.com/')) return Response.json({});
    throw new Error('Unexpected request');
  };
  try {
    const response = await onRequest({ request: signedRequest(input), env, waitUntil: task => tasks.push(task) });
    assert.deepEqual(await response.json(), { type: 6 }); await Promise.all(tasks);
    assert.equal(calls.length, 2);
    assert.match(JSON.parse(calls[1].options.body).embeds[0].title, /focus/);
    assert.equal(JSON.parse(calls[1].options.body).flags, undefined);
  } finally { globalThis.fetch = original; }
});
