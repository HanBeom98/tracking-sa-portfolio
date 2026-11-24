import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRound,makeReplay } from '../fixtures/replay-context.js';
import { prepareReplayComparison,compareReplayGames } from '../../src/domains/stats/sudden-attack/replay/domain/replay-comparison.js';
import { createReplayComparisonSession } from '../../src/domains/stats/sudden-attack/replay/application/replay-comparison-session.js';
import { renderReplayComparisonReport } from '../../src/domains/stats/sudden-attack/replay/ui/replay-comparison.js';

const game=(name,rounds,alias='Tracking')=>{const parsed=makeReplay(rounds);parsed.replay_info.replayMatchSummaryInfo.matchID=name;
  parsed.replay_info.replayCharacterSummaryInfo[0].nickName=alias;return {name:name+'.json',parsed};};
const examples=()=>[game('one',[makeRound([[10,'enemy1','focus']])]),game('two',[makeRound([[10,'focus','enemy1']]),makeRound([],{no:2}),makeRound([],{no:3})],'disguise')];
const file=entry=>{const content=JSON.stringify(entry.parsed);return {name:entry.name,size:new TextEncoder().encode(content).length,text:async()=>content};};
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};

test('comparison binds player IDs across disguises and weights survival and rates by all verified rounds',()=>{
  const entries=examples(),before=structuredClone(entries),prepared=prepareReplayComparison(entries),r=compareReplayGames(prepared,'focus');
  assert.deepEqual(entries,before);assert.deepEqual(r.player.names,['Tracking','disguise']);assert.equal(r.comparedGames,2);
  assert.equal(r.aggregate.rounds,4);assert.equal(r.aggregate.kills,1);assert.equal(r.aggregate.deaths,1);
  assert.equal(r.aggregate.killsPerRound,.25);assert.equal(r.aggregate.survivedPercent,75);assert.equal(r.aggregate.averageSurvivalSeconds,15.25);
  assert.equal(r.aggregate.openingDeaths,1);assert.equal(r.games[0].metrics.averageSurvivalSeconds,1);
});

test('same nickname with different IDs never merges; missing players and partial rounds are not zero games',()=>{
  const entries=examples(),other=game('other',[makeRound([])]);
  other.parsed=JSON.parse(JSON.stringify(other.parsed).replaceAll('"focus"','"different-id"'));
  other.parsed.replay_info.replayCharacterSummaryInfo[0].nickName='Tracking';
  let p=prepareReplayComparison([entries[0],other]);assert.ok(!p.players.some(v=>v.id==='focus'||v.id==='different-id'));
  p=prepareReplayComparison([...entries,other]);const r=compareReplayGames(p,'focus');
  assert.equal(r.games[2].status,'absent');assert.equal(r.games[2].metrics,null);assert.equal(r.aggregate.rounds,4);
  entries[1].parsed.replay_info.replayRoundInfo[0].replayRoundSummaryInfo[0].reJoin=1;
  const partial=compareReplayGames(prepareReplayComparison(entries),'focus');
  assert.equal(partial.games[1].metrics.rounds,2);assert.equal(partial.games[1].totalRounds,3);assert.equal(partial.aggregate.kills,0);
  for(const raw of entries[1].parsed.replay_info.replayRoundInfo)raw.replayRoundSummaryInfo[0].reJoin=1;
  const unknown=compareReplayGames(prepareReplayComparison(entries),'focus');
  assert.equal(unknown.games[1].status,'unverified');assert.equal(unknown.games[1].metrics,null);assert.equal(unknown.comparedGames,1);
});

test('duplicate exports ignore filenames/nicknames/property order and unsafe numeric match IDs do not collapse distinct games',()=>{
  const entries=examples(),duplicate=structuredClone(entries[0]);duplicate.name='copy.json';
  duplicate.parsed.replay_info.replayCharacterSummaryInfo[0].nickName='new alias';
  duplicate.parsed.replay_info=Object.fromEntries(Object.entries(duplicate.parsed.replay_info).reverse());
  let p=prepareReplayComparison([entries[0],duplicate,entries[1]]);assert.equal(p.games.length,2);assert.equal(p.issues[0].code,'duplicate');
  const conflicting=structuredClone(entries[1]);conflicting.parsed.replay_info.replayMatchSummaryInfo.matchID='one';
  p=prepareReplayComparison([entries[0],conflicting]);assert.equal(p.games.length,1);assert.equal(p.issues[0].code,'conflict');
  const distinct=structuredClone(entries[0]);distinct.parsed.replay_info.replayMatchSummaryInfo.matchID='different-exact-id';
  assert.equal(prepareReplayComparison([entries[0],distinct]).games.length,2);
  for(const entry of entries)entry.parsed.replay_info.replayMatchSummaryInfo.matchID=260728215207120001;
  assert.equal(prepareReplayComparison(entries).games.length,2);
});

test('comparison rejects invalid structure and bounds without walking arbitrary nested objects',()=>{
  assert.throws(()=>prepareReplayComparison(Array(6).fill(examples()[0])),/FILE_LIMIT/);
  for(const edit of [p=>p.replay_info.replayRoundInfo.push(null),p=>p.replay_info.replayRoundInfo[0].playTime=0,
    p=>p.replay_info.replayRoundInfo[0].no=0,p=>p.replay_info.replayRoundInfo[0].replayAttackInfo=Array(5001).fill({}),
    p=>p.replay_info.replayRoundInfo[0].replayCharacterInfo[0].replayCharacterStateInfo=Array(25001).fill({}),
    p=>p.replay_info.replayRoundInfo[0].replayRoundSummaryInfo[0].nexonSN={toString:[]},
    p=>p.replay_info.replayCharacterSummaryInfo.push(p.replay_info.replayCharacterSummaryInfo[0])]){
    const e=examples()[0];edit(e.parsed);const p=prepareReplayComparison([e]);assert.equal(p.games.length,0);assert.equal(p.issues[0].code,'unsupported');
  }
});

test('zero verified coverage stays null and rendering escapes player, map and file strings',()=>{
  const entries=examples(),bad='<img src=x onerror=alert(1)>';
  entries[0].name=bad;entries[0].parsed.replay_info.replayMatchSummaryInfo.mapName=bad;
  entries[0].parsed.replay_info.replayCharacterSummaryInfo[0].nickName=bad;
  let r=compareReplayGames(prepareReplayComparison(entries),'focus');const html=renderReplayComparisonReport(r);
  assert.doesNotMatch(html,/<img/);assert.match(html,/&lt;img/);assert.match(html,/15.3초/);
  for(const e of entries)for(const raw of e.parsed.replay_info.replayRoundInfo)raw.replayRoundSummaryInfo[0].reJoin=1;
  r=compareReplayGames(prepareReplayComparison(entries),'focus');assert.equal(r.aggregate,null);assert.equal(r.comparedGames,0);
  assert.doesNotMatch(renderReplayComparisonReport(r),/NaN|Infinity/);
});

test('session checks count and metadata before reading, actual bytes after reading, and reports invalid files individually',async()=>{
  let reads=0;const session=createReplayComparisonSession();
  await session.load(Array(6).fill({name:'x.json',size:10,text:async()=>{reads++;return '{}';}}));
  assert.equal(session.view().state,'limit');assert.equal(reads,0);
  await session.load([{name:'x.json',size:2097153,text:async()=>{reads++;return '{}';}},...examples().map(file)]);
  assert.equal(reads,0);assert.equal(session.view().state,'ready');assert.equal(session.view().issues[0].code,'invalid');
  await session.load([{name:'x.json',size:1,text:async()=>' '.repeat(2097153)}]);assert.equal(session.view().state,'insufficient');
  assert.equal(session.view().report,null);
});

test('new selections, clear and disposal discard stale file reads without restoring old comparison data',async()=>{
  const session=createReplayComparisonSession(),slow=deferred(),entries=examples();
  const pending=session.load([{...file(entries[0]),text:()=>slow.promise},file(entries[1])]);
  await session.load(entries.map(file));session.select('mate');assert.equal(session.view().report.aggregate.deaths,0);
  slow.resolve('{');await pending;assert.equal(session.view().selectedId,'mate');assert.equal(session.view().state,'ready');
  const later=deferred(),loading=session.load([{...file(entries[0]),text:()=>later.promise},file(entries[1])]);
  session.clear();later.resolve(JSON.stringify(entries[0].parsed));await loading;
  assert.equal(session.view().state,'empty');assert.equal(session.view().report,null);assert.deepEqual(session.view().files,[]);
  const events=[],end=createReplayComparisonSession({onChange:v=>events.push(v.state)}),last=deferred();
  const stopped=end.load([{...file(entries[0]),text:()=>last.promise}]);end.dispose();last.resolve(JSON.stringify(entries[0].parsed));await stopped;
  assert.deepEqual(events,['loading']);
});
