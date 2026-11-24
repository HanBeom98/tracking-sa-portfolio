import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRound,makeReplay } from '../fixtures/replay-context.js';
import { prepareReplayComparison,compareReplayGames } from '../../src/domains/stats/sudden-attack/replay/domain/replay-comparison.js';
import { compareReplayProgress } from '../../src/domains/stats/sudden-attack/replay/domain/replay-progress.js';
import { createReplayComparisonSession } from '../../src/domains/stats/sudden-attack/replay/application/replay-comparison-session.js';
import { renderReplayProgressControls,renderReplayProgressReport } from '../../src/domains/stats/sudden-attack/replay/ui/replay-progress.js';

const game=(name,rounds)=>{const parsed=makeReplay(rounds);parsed.replay_info.replayMatchSummaryInfo.matchID=name;return {name:name+'.json',parsed};};
const examples=()=>[game('before',[makeRound([[10,'enemy1','focus']])]),game('after',[makeRound([[10,'focus','enemy1']]),makeRound([],{no:2}),makeRound([],{no:3})])];
const report=entries=>compareReplayGames(prepareReplayComparison(entries),'focus');
const file=entry=>{const content=JSON.stringify(entry.parsed);return {name:entry.name,size:new TextEncoder().encode(content).length,text:async()=>content};};

test('manual groups use verified-round weights and percentage points, with no mutation or automatic date sorting',()=>{
  const entries=[...examples(),game('third',[makeRound([])])],r=report(entries),before=structuredClone(r),groups=['before','before','after'];
  const result=compareReplayProgress(r,groups);
  assert.equal(result.state,'ready');assert.equal(result.before.metrics.rounds,4);assert.equal(result.before.metrics.averageSurvivalSeconds,15.25);
  assert.equal(result.after.metrics.averageSurvivalSeconds,20);
  assert.equal(result.changes.find(c=>c.key==='openingDeathRate').delta,-25);
  assert.equal(result.changes.find(c=>c.key==='survivedPercent').delta,25);
  assert.equal(result.changes.find(c=>c.key==='killsPerRound').delta,-.25);
  assert.equal(result.direction,'toward');assert.deepEqual(r,before);assert.deepEqual(groups,['before','before','after']);
});

test('unassigned and invalid groups never produce a comparison and omitted games stay out of both groups',()=>{
  const r=report([...examples(),game('third',[makeRound([])])]);
  assert.equal(compareReplayProgress(r,['unassigned','unassigned','unassigned']).reason,'groups');
  assert.equal(compareReplayProgress(r,['before','after','exclude']).before.metrics.rounds,1);
  assert.equal(compareReplayProgress(r,['before','after','exclude']).after.metrics.rounds,3);
  for(const groups of [[],['before','after'],['before','after','both'],['before','after','exclude','before']])
    assert.equal(compareReplayProgress(r,groups).state,'invalid');
  assert.equal(compareReplayProgress(r,['before','after','exclude'],'inventedGoal').state,'invalid');
});

test('a missing player or zero verified coverage in an assigned group stays unknown, never a zero rate',()=>{
  const entries=examples();for(const raw of entries[1].parsed.replay_info.replayRoundInfo)raw.replayRoundSummaryInfo[0].reJoin=1;
  let result=compareReplayProgress(report(entries),['before','after']);assert.equal(result.state,'pending');assert.equal(result.reason,'coverage');assert.equal(result.after.metrics,null);
  const other=game('other',[makeRound([])]);other.parsed=JSON.parse(JSON.stringify(other.parsed).replaceAll('"focus"','"different-id"'));
  result=compareReplayProgress(report([...examples(),other]),['before','exclude','after']);
  assert.equal(result.reason,'coverage');assert.equal(result.after.selectedGames,1);assert.equal(result.after.comparedGames,0);
});

test('goal direction is explicit and reversing the user groups reverses the observed change',()=>{
  const r=report(examples());
  assert.equal(compareReplayProgress(r,['before','after']).direction,'toward');
  assert.equal(compareReplayProgress(r,['after','before']).direction,'away');
  assert.equal(compareReplayProgress(r,['before','after'],'averageSurvivalSeconds').direction,'observed');
  const same=examples()[0],copy=structuredClone(same);copy.parsed.replay_info.replayMatchSummaryInfo.matchID='other-exact-id';
  assert.equal(compareReplayProgress(report([same,copy]),['before','after']).direction,'same');
});

test('session groups follow game indices across player changes; invalid commands do nothing and reset retains files',async()=>{
  const session=createReplayComparisonSession();await session.load(examples().map(file));
  assert.deepEqual(session.view().groups,['unassigned','unassigned']);assert.equal(session.view().progress.state,'pending');
  session.assignGroup(0,'before');session.assignGroup(1,'after');session.selectGoal('survivedPercent');
  assert.equal(session.view().progress.direction,'toward');session.select('mate');
  assert.deepEqual(session.view().groups,['before','after']);assert.equal(session.view().progress.direction,'same');
  session.assignGroup(-1,'before');session.assignGroup(0,'both');session.selectGoal('unknown');
  assert.equal(session.view().goal,'survivedPercent');assert.deepEqual(session.view().groups,['before','after']);
  const external=session.view().groups;external[0]='after';assert.equal(session.view().groups[0],'before');
  session.resetProgress();assert.equal(session.view().files.length,2);assert.equal(session.view().progress.state,'pending');assert.equal(session.view().goal,'openingDeathRate');
});

test('new file selections, full clear and disposal cannot reuse old goal/group assignments',async()=>{
  const session=createReplayComparisonSession(),files=examples().map(file);await session.load(files);
  session.assignGroup(0,'before');session.assignGroup(1,'after');session.selectGoal('killsPerRound');
  await session.load(files);assert.deepEqual(session.view().groups,['unassigned','unassigned']);assert.equal(session.view().goal,'openingDeathRate');
  session.assignGroup(0,'before');session.clear();assert.deepEqual(session.view().groups,[]);assert.equal(session.view().progress,null);
  await session.load(files);session.dispose();session.assignGroup(0,'before');assert.deepEqual(session.view().groups,[]);
});

test('progress controls escape file labels and observed-change text never claims proven coaching effect',()=>{
  const r=report(examples()),bad='<img src=x onerror=alert(1)>';r.games[0].name=bad;r.games[0].map=bad;r.games[0].date=bad;
  const controls=renderReplayProgressControls(r);assert.doesNotMatch(controls,/<img/);assert.match(controls,/&lt;img/);
  const html=renderReplayProgressReport(compareReplayProgress(r,['before','after']));
  assert.match(html,/-100\.0%p/);assert.match(html,/확정하지 않습니다/);assert.doesNotMatch(html,/NaN|Infinity/);
  assert.doesNotMatch(renderReplayProgressReport(compareReplayProgress(r,['unassigned','unassigned'])),/<table/);
});
