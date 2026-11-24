import test from 'node:test';
import assert from 'node:assert/strict';
import {createReplayCache} from '../../functions/discord/replay-cache.js';
import {replayMessage} from '../../functions/discord/replay.js';
import {contextFixture} from '../fixtures/replay-context.js';
const session=(overrides={})=>({owner:'101',expires:2000,url:'https://cdn.discordapp.com/attachments/111/222/replay.json',action:'summary',...overrides});

test('a replay cache is owner/session bound, expires without sliding, and respects the session deadline',()=>{
  let now=1000000; const cache=createReplayCache({now:()=>now,ttlMs:120000});
  const state=session(); cache.set(state,{bytes:100});
  assert.equal(cache.get(state).bytes,100);
  assert.equal(cache.get(session({owner:'102'})),null);
  assert.equal(cache.get(session({expires:2001})),null);
  now+=119999; assert.ok(cache.get(state)); now++; assert.equal(cache.get(state),null);
  const soon=session({expires:Math.floor(now/1000)+1}); cache.set(soon,{bytes:100});
  now=soon.expires*1000; assert.equal(cache.get(soon),null);
});

test('replay memory evicts old entries at both the entry and raw-byte budgets',()=>{
  assert.throws(()=>createReplayCache({maxEntries:0}),RangeError);
  const cache=createReplayCache({now:()=>1000000,maxEntries:2,maxBytes:10});
  const a=session(),b=session({owner:'102'}),c=session({owner:'103'});
  cache.set(a,{bytes:6}); cache.set(b,{bytes:6});
  assert.equal(cache.get(a),null); assert.equal(cache.get(b).bytes,6);
  cache.set(c,{bytes:11}); assert.equal(cache.get(c),null);
  const count=createReplayCache({now:()=>1000000,maxEntries:1,maxBytes:100});
  count.set(a,{bytes:1}); count.set(b,{bytes:1}); assert.equal(count.get(a),null); assert.ok(count.get(b));
});

test('selection reuses only projected metadata without another download or retained rounds',async()=>{
  let now=Date.now(),downloads=0;
  const cache=createReplayCache({now:()=>now});
  const state=session({expires:Math.floor(now/1000)+900});
  const fetchImpl=async()=>{downloads++;return Response.json(contextFixture());};
  const roster=await replayMessage(state,{fetchImpl,cache});
  assert.match(roster.embeds[0].title,/요약 준비 완료/);
  const selected={...state,playerId:'focus'};
  const summary=await replayMessage(selected,{fetchImpl,cache});
  const moments=await replayMessage({...selected,action:'moments'},{fetchImpl,cache});
  const rounds=await replayMessage({...selected,action:'rounds'},{fetchImpl,cache});
  assert.equal(downloads,1); assert.match(summary.embeds[0].title,/focus/);
  assert.deepEqual(moments, summary); assert.deepEqual(rounds, summary);
  assert.ok(cache.get(state).header.players.length);
  assert.equal('parsed' in cache.get(state),false);
  assert.equal('analyses' in cache.get(state),false);
  const fresh=await replayMessage(selected,{fetchImpl,cache:null});
  assert.deepEqual(summary,fresh); assert.equal(downloads,2);
  now+=120000; await replayMessage(selected,{fetchImpl,cache}); assert.equal(downloads,3);
});
