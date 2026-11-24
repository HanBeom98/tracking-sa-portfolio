import test from 'node:test';
import assert from 'node:assert/strict';

import { buildNicknameCandidates, NexonApiClient } from '../../src/domains/stats/sudden-attack/infra/nexon-api-client.js';

test('buildNicknameCandidates adds common Latin casing variants without duplicates', () => {
  assert.deepEqual(buildNicknameCandidates('tracking'), ['tracking', 'Tracking', 'TRACKING']);
  assert.deepEqual(buildNicknameCandidates('Tracking'), ['Tracking', 'tracking', 'TRACKING']);
});

test('buildNicknameCandidates covers mixed casing for short Latin nicknames', () => {
  const candidates = buildNicknameCandidates('bra');

  assert.ok(candidates.includes('bRa'));
  assert.ok(candidates.includes('brA'));
  assert.ok(candidates.includes('BrA'));
  assert.equal(candidates.length, 8);
});

test('buildNicknameCandidates keeps long Latin nickname retries bounded', () => {
  assert.deepEqual(buildNicknameCandidates('abcdef'), ['abcdef', 'Abcdef', 'ABCDEF']);
});

test('buildNicknameCandidates does not alter Korean nicknames', () => {
  assert.deepEqual(buildNicknameCandidates('스나조꼬수'), ['스나조꼬수']);
});

test('getOuid retries a Latin nickname with title casing after a not-found response', async () => {
  const client = new NexonApiClient();
  const requestedNames = [];

  client.fetch = async (_endpoint, params) => {
    requestedNames.push(params.user_name);
    if (params.user_name === 'Tracking') return { ouid: 'test-ouid' };
    throw new Error('PLAYER_NOT_FOUND');
  };

  assert.equal(await client.getOuid('tracking'), 'test-ouid');
  assert.deepEqual(requestedNames, ['tracking', 'Tracking']);
});

test('getOuid does not hide proxy or network errors', async () => {
  const client = new NexonApiClient();
  client.fetch = async () => { throw new Error('Proxy/Nexon Error: 503'); };

  await assert.rejects(() => client.getOuid('tracking'), /503/);
});

function installClientWindow(t) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  globalThis.window = { location: { origin: 'https://trackingsa.com' } };
  t.after(() => previous ? Object.defineProperty(globalThis, 'window', previous) : delete globalThis.window);
}

test('Nexon deadline aborts a stalled request without trying nickname variants or logging names', async (t) => {
  installClientWindow(t);
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const logs = []; t.mock.method(console, 'info', (line) => logs.push(line));
  let calls = 0, signal;
  const client = new NexonApiClient('', { timeoutMs: 50, fetchImpl: (_url, init) => { calls++; signal = init.signal; return new Promise(() => {}); } });
  const pending = assert.rejects(client.getOuid('Tracking'), { code: 'REQUEST_TIMEOUT' });
  await new Promise(setImmediate); t.mock.timers.tick(50); await pending;
  assert.equal(calls, 1);
  assert.equal(signal.aborted, true);
  assert.doesNotMatch(logs.join(''), /Tracking|user_name|https:/);
});

test('Nexon client retains real not-found casing fallback through the proxy transport', async (t) => {
  installClientWindow(t);
  const candidates = [];
  const client = new NexonApiClient('', { fetchImpl: async (url) => {
    const name = new URL(url).searchParams.get('user_name'); candidates.push(name);
    return name === 'Tracking' ? Response.json({ ouid: 'stable-ouid' }) : Response.json({ error: { message: 'Please input valid parameter' } }, { status: 400 });
  } });
  assert.equal(await client.getOuid('tracking'), 'stable-ouid');
  assert.deepEqual(candidates, ['tracking', 'Tracking']);
});

test('Nexon client classifies throttling and proxy timeout while preserving the correlation ID', async (t) => {
  installClientWindow(t);
  for (const [status, code] of [[429, 'RATE_LIMITED'], [504, 'REQUEST_TIMEOUT'], [503, 'HTTP_ERROR']]) {
    const client = new NexonApiClient('', { fetchImpl: async () => Response.json({ error: { message: 'private provider details' } }, { status, headers: { 'X-Request-ID': 'safe-id' } }) });
    await assert.rejects(client.getPlayerBasic('test-ouid'), (error) => {
      assert.equal(error.code, code); assert.equal(error.status, status); assert.equal(error.requestId, 'safe-id');
      assert.doesNotMatch(error.message, /private/); return true;
    });
  }
});

test('match lists omit unsupported dates and merge concurrent requests plus recent reuse',async()=>{
  let calls=0,resolve;
  const client=new NexonApiClient('',{now:()=>0});
  client.fetch=(_endpoint,params)=>{
    calls++;assert.deepEqual(params,{ouid:'player',match_type:'랭크전 솔로',match_mode:'폭파미션'});
    return new Promise(done=>{resolve=done;});
  };
  const first=client.getMatchList('player','랭크전 솔로','폭파미션','2026-11-06');
  const second=client.getMatchList('player','랭크전 솔로','폭파미션');
  resolve({match:[{match_id:'one'}]});
  assert.deepEqual(await first,await second);
  assert.deepEqual(await client.getMatchList('player','랭크전 솔로','폭파미션'),{match:[{match_id:'one'}]});
  assert.equal(calls,1);
});

test('match-list cache keys isolate player, type and mode and expire without extending the deadline',async()=>{
  let now=0,calls=0;
  const client=new NexonApiClient('',{now:()=>now});
  client.fetch=async()=>({match:[{match_id:String(++calls)}]});
  await client.getMatchList('a','solo','bomb');
  await client.getMatchList('b','solo','bomb');
  await client.getMatchList('a','party','bomb');
  await client.getMatchList('a','solo','deathmatch');
  now=29999;await client.getMatchList('a','solo','bomb');assert.equal(calls,4);
  now=30000;await client.getMatchList('a','solo','bomb');assert.equal(calls,5);
});

test('failed and malformed lists are not cached, while a successful empty list is reusable',async()=>{
  let calls=0;
  const client=new NexonApiClient('',{now:()=>0});
  client.fetch=async()=>{calls++;if(calls===1)throw Error('RATE_LIMITED');return {match:[]};};
  await assert.rejects(client.getMatchList('a','solo','bomb'),/RATE_LIMITED/);
  await client.getMatchList('a','solo','bomb');await client.getMatchList('a','solo','bomb');
  assert.equal(calls,2);
  client.fetch=async()=>{calls++;return {};};
  await assert.rejects(client.getMatchList('b','solo','bomb'), {code:'INVALID_MATCH_LIST'});
  await assert.rejects(client.getMatchList('b','solo','bomb'), {code:'INVALID_MATCH_LIST'});
  assert.equal(calls,4);
});

test('invalidating a player detaches an older in-flight list without removing a newer request',async()=>{
  const resolves=[];
  const client=new NexonApiClient('',{now:()=>0});
  client.fetch=()=>new Promise(resolve=>resolves.push(resolve));
  const old=client.getMatchList('a','solo','bomb');
  client.invalidateMatchLists('a');
  const fresh=client.getMatchList('a','solo','bomb');
  resolves[0]({match:[{match_id:'old'}]});await old;
  const joined=client.getMatchList('a','solo','bomb');assert.equal(resolves.length,2);
  resolves[1]({match:[{match_id:'new'}]});await fresh;await joined;
  assert.equal((await client.getMatchList('a','solo','bomb')).match[0].match_id,'new');
});

test('match-list cache evicts unused players and targeted invalidation retains another player',async()=>{
  let calls=0;
  const client=new NexonApiClient('',{now:()=>0});
  client.fetch=async()=>{calls++;return {match:[]};};
  for(let i=0;i<32;i++)await client.getMatchList(String(i),'solo','bomb');
  await client.getMatchList('0','solo','bomb');
  await client.getMatchList('32','solo','bomb');
  await client.getMatchList('0','solo','bomb');assert.equal(calls,33);
  await client.getMatchList('1','solo','bomb');assert.equal(calls,34);
  client.invalidateMatchLists('1');await client.getMatchList('0','solo','bomb');assert.equal(calls,34);
  await client.getMatchList('1','solo','bomb');assert.equal(calls,35);
  client.invalidateMatchLists();await client.getMatchList('0','solo','bomb');assert.equal(calls,36);
});
