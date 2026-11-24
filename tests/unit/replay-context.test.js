import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeRoundContext, summarizeReplayContext, getContextInsights} from '../../src/domains/stats/sudden-attack/replay/domain/replay-context.js';
import {analyzeReplay, getKeyMoments, getDetailAnalysis} from '../../src/domains/stats/sudden-attack/replay/domain/replay-analyzer.js';
import {makeRound, makeReplay, contextFixture, roster} from '../fixtures/replay-context.js';

test('reconstructs actual roster sizes, death context, a matching retaliation and a 1v2 situation', () => {
  const round = contextFixture().replay_info.replayRoundInfo[0];
  const before = structuredClone(round);
  const c = analyzeRoundContext(round, 'focus');
  assert.equal(c.status, 'complete');
  assert.deepEqual(c.initial, {own: 3, enemy: 3});
  assert.deepEqual(c.death, {timeSeconds: 4.5, own: 1, enemy: 2, opening: false, simultaneous: false});
  assert.equal(c.tradesMade.length, 1);
  assert.equal(c.tradesMade[0].gapSeconds, 0.6);
  assert.deepEqual(c.alone, {timeSeconds: 3, opponentAlive: 2, roundWon: false});
  assert.deepEqual(round, before);
});

test('simultaneous deaths share one before/after state and are not a sequential trade', () => {
  const r = makeRound([[10, 'enemy1', 'mate'], [10, 'focus', 'enemy1']]);
  const c = analyzeRoundContext(r, 'focus');
  assert.equal(c.status, 'complete');
  assert.equal(c.opening.simultaneous, true);
  assert.equal(c.opening.selectedKill, true);
  assert.equal(c.tradesMade.length, 0);
  assert.equal(c.transitions.length, 1);
  assert.deepEqual(c.transitions[0].before, {own: 3, enemy: 3});
  assert.deepEqual(c.transitions[0].after, {own: 2, enemy: 2});
  const reversed = structuredClone(r); reversed.replayAttackInfo.reverse();
  assert.deepEqual(analyzeRoundContext(reversed, 'focus'), c);
});

test('does not invent a fleeting solo situation inside a simultaneous kill group', () => {
  const r = makeRound([[10, 'enemy1', 'mate'], [10, 'enemy2', 'spare'], [10, 'enemy3', 'focus']]);
  const c = analyzeRoundContext(r, 'focus');
  assert.equal(c.status, 'complete');
  assert.equal(c.death.own, 3);
  assert.equal(c.death.simultaneous, true);
  assert.equal(c.alone, null);
});

test('an unrelated opponent kill is not a trade', () => {
  const c = analyzeRoundContext(makeRound([[10, 'enemy1', 'mate'], [20, 'focus', 'enemy2']]), 'focus');
  assert.equal(c.status, 'complete'); assert.equal(c.tradesMade.length, 0);
});

for (const [gap, expected] of [[50, 1], [51, 0]]) {
  test(`trade window handles ${gap / 10}s exactly`, () => {
    const c = analyzeRoundContext(makeRound([[10, 'enemy1', 'mate'], [10 + gap, 'focus', 'enemy1']]), 'focus');
    assert.equal(c.status, 'complete'); assert.equal(c.tradesMade.length, expected);
  });
}

test('uses the most recent teammate victim, and reports both sides of the same trade', () => {
  const r = makeRound([[10, 'enemy1', 'mate'], [20, 'enemy1', 'spare'], [25, 'focus', 'enemy1']]);
  const c = analyzeRoundContext(r, 'focus');
  assert.equal(c.status, 'complete');
  assert.deepEqual(c.tradesMade[0].teammateIds, ['spare']);
  assert.equal(c.tradesMade[0].gapSeconds, 0.5);
  assert.equal(analyzeRoundContext(r, 'spare').tradesReceived.length, 1);
  assert.equal(analyzeRoundContext(r, 'mate').tradesReceived.length, 0);
});

test('posthumous kills do not become a living teammate trade', () => {
  const r = makeRound([[10, 'enemy1', 'focus'], [20, 'enemy1', 'mate'], [30, 'focus', 'enemy1']]);
  const c = analyzeRoundContext(r, 'focus');
  assert.equal(c.status, 'complete'); assert.equal(c.tradesMade.length, 0);
});

test('round-specific teams override the match roster after a side change', () => {
  const teams = Object.fromEntries(Object.entries(roster).map(([id, team]) => [id, 1 - team]));
  const r = makeRound([[10, 'enemy1', 'mate'], [16, 'focus', 'enemy1']], {teams, offenseTeam: 1, winTeam: 1});
  const a = analyzeReplay(makeReplay([r]), 'focus');
  assert.equal(a.rounds[0].context.status, 'complete');
  assert.equal(a.rounds[0].won, true); assert.equal(a.rounds[0].offense, true);
  assert.equal(a.contextSummary.tradesMade.length, 1);
});

test('zero-event rounds need matching zero summaries and provide no fake opening', () => {
  const c = analyzeRoundContext(makeRound(), 'focus');
  assert.equal(c.status, 'complete'); assert.equal(c.opening, null);
  assert.equal(c.death, null); assert.equal(c.alone, null);
});

test('a solo starting roster is reported without assuming five players per side', () => {
  const c = analyzeRoundContext(makeRound([], {teams: {focus: 0, enemy1: 1, enemy2: 1}}), 'focus');
  assert.equal(c.status, 'complete'); assert.equal(c.alone.timeSeconds, 0);
  assert.equal(c.alone.opponentAlive, 2);
});

const invalidCases = [
  ['duplicate death', r => r.replayAttackInfo.push({...r.replayAttackInfo[0]}), 'duplicate-death'],
  ['missing event', r => r.replayAttackInfo.pop(), 'summary-event-mismatch'],
  ['unknown player', r => r.replayAttackInfo[0].attackerNexonSN = 'unknown', 'unknown-event-player'],
  ['team mismatch', r => r.replayAttackInfo[0].victimTeamNo = 1, 'event-team-mismatch'],
  ['unknown event code', r => r.replayAttackInfo[0].eventType = 9, 'unknown-event-type'],
  ['missing event code', r => delete r.replayAttackInfo[0].eventType, 'unknown-event-type'],
  ['null time', r => r.replayAttackInfo[0].timeStamp = null, 'invalid-event-time'],
  ['out of range time', r => r.replayAttackInfo[0].timeStamp = 9999, 'invalid-event-time'],
  ['missing state player', r => r.replayCharacterInfo.pop(), 'invalid-initial-state'],
  ['late initial sample', r => r.replayCharacterInfo[0].replayCharacterStateInfo[0].timeStamp = 8, 'invalid-initial-state'],
  ['late entry', r => r.replayEnterInfo.push({nexonSN: 'focus', timeStamp: 12, teamNo: 0}), 'participant-change'],
  ['rejoin flag', r => r.replayRoundSummaryInfo[0].reJoin = 1, 'participant-change'],
  ['departure flag', r => r.replayRoundSummaryInfo[0].breakType = 1, 'participant-change'],
  ['unlogged state death', r => r.replayCharacterInfo.find(c => c.nexonSN === 'enemy2').replayCharacterStateInfo.at(-1).state = 2, 'state-event-mismatch'],
  ['resurrection', r => r.replayCharacterInfo.find(c => c.nexonSN === 'mate').replayCharacterStateInfo.push({timeStamp: 15, state: 1}), 'participant-change'],
  ['missing roster counts', r => delete r.replayRoundSummaryInfo[0].kill, 'missing-summary-counts'],
  ['invalid roster team', r => r.replayRoundSummaryInfo[0].teamNo = null, 'invalid-roster'],
];
for (const [name, edit, reason] of invalidCases) {
  test(`withholds situation claims on ${name}`, () => {
    const r = contextFixture().replay_info.replayRoundInfo[0]; edit(r);
    const c = analyzeRoundContext(r, 'focus');
    assert.equal(c.status, 'partial'); assert.ok(c.reasons.includes(reason));
    assert.equal(c.death, null); assert.equal(c.opening, null);
    assert.equal(c.alone, null); assert.equal(c.tradesMade.length, 0);
  });
}

test('summary distinguishes unknown rounds from confirmed zero and gives evidence-backed review priority', () => {
  const fixture = contextFixture();
  fixture.replay_info.replayRoundInfo.push({...makeRound([], {no: 3}), replayCharacterInfo: []});
  const a = analyzeReplay(fixture, 'focus');
  assert.equal(a.contextSummary.completeRounds, 2); assert.equal(a.contextSummary.partialRounds, 1);
  assert.deepEqual(a.contextSummary.openingDeaths.map(r => r.round), [2]);
  assert.equal(a.contextSummary.tradesMade.length, 1);
  assert.equal(a.contextSummary.aloneSituations[0].opponentAlive, 2);
  assert.ok(getContextInsights(a.contextSummary).every(i => /2\/3개 라운드/.test(i.body)));
  assert.match(getContextInsights(a.contextSummary)[1].body, /0\.6초.*후보.*의도적인 커버/);
  assert.equal(getKeyMoments(a)[1].round, 2);
  assert.match(getDetailAnalysis(a, 'DEATHS').items[0], /1대2/);
  assert.match(getDetailAnalysis(a, 'DEATHS').items[1], /라운드의 첫 사망입니다/);
});

test('all-partial summaries expose no confident context insights', () => {
  const c = analyzeRoundContext({}, 'focus');
  const summary = summarizeReplayContext([{round: 1, context: c}]);
  assert.equal(summary.completeRounds, 0); assert.deepEqual(getContextInsights(summary), []);
});
