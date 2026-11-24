import test from 'node:test';
import assert from 'node:assert/strict';
import { auditReplayCoachingQuality, checkTemplateFacts, rawRoundFacts } from '../../scripts/replay-coaching-quality.mjs';
import { analyzeReplay } from '../../src/domains/stats/sudden-attack/replay/domain/replay-analyzer.js';
import { createMockReplayCoachingResponse } from '../../src/domains/stats/sudden-attack/replay/application/replay-coaching-preview.js';
import { validateReplayCoachingResponse } from '../../src/domains/stats/sudden-attack/replay/domain/replay-coaching-response.js';
import { makeReplay, makeRound, roster } from '../fixtures/replay-context.js';

const flipped = Object.fromEntries(Object.entries(roster).map(([key, team]) => [key, 1 - team]));
const cases = [
  ['verified zero events', () => [makeRound()], { rounds: 1, kills: 0, deaths: 0, survivedRounds: 1 }, /0킬·0사망/],
  ['simultaneous opening', () => [makeRound([[10, 'enemy1', 'mate'], [10, 'focus', 'enemy1']])],
    { openingKills: 1, tradeCandidatesMade: 0 }, /같은 시각의 처치/],
  ['posthumous kill', () => [makeRound([[10, 'enemy1', 'focus'], [20, 'focus', 'enemy2']])],
    { kills: 1, killsAfterDeath: 1, averageSurvivalSeconds: 1 }, /사망 이후 처치 1건/],
  ['trade at five-second boundary', () => [makeRound([[10, 'enemy1', 'mate'], [60, 'focus', 'enemy1']])],
    { tradeCandidatesMade: 1 }, /5.0초 뒤/],
  ['outside five-second boundary', () => [makeRound([[10, 'enemy1', 'mate'], [61, 'focus', 'enemy1']])],
    { tradeCandidatesMade: 0 }, /1킬/],
  ['received trade after earlier combat', () => [makeRound([[5, 'enemy2', 'spare'], [10, 'enemy1', 'focus'], [16, 'mate', 'enemy1']])],
    { openingDeaths: 0, tradeCandidatesReceived: 1 }, /1.0초.*2대3.*0.6초 뒤/],
  ['most recent victim only', () => [makeRound([[10, 'enemy1', 'mate'], [20, 'enemy1', 'spare'], [25, 'focus', 'enemy1']])],
    { tradeCandidatesMade: 1 }, /0.5초 뒤/],
  ['simultaneous allied victims', () => [makeRound([[10, 'enemy1', 'mate'], [10, 'enemy1', 'spare'], [16, 'focus', 'enemy1']])],
    { tradeCandidatesMade: 1, outnumberedSoloRounds: 1 }, /0.6초 뒤/],
  ['solo after simultaneous losses', () => [makeRound([[10, 'enemy1', 'mate'], [10, 'enemy2', 'spare']])],
    { outnumberedSoloRounds: 1 }, /1.0초부터 1대3/],
  ['round-specific team switch', () => [makeRound([], { winTeam: 0 }), makeRound([], { no: 2, teams: flipped, winTeam: 1 })],
    { wonRounds: 2, survivedRounds: 2 }, /2개 라운드/],
  ['excluded rejoin does not become zero', () => {
    const invalid = makeRound([[10, 'enemy1', 'focus']], { no: 2 }); invalid.replayRoundSummaryInfo[0].reJoin = 1;
    return [makeRound(), invalid];
  }, { rounds: 1, deaths: 0, survivedRounds: 1 }, /1개 라운드.*0킬·0사망/],
  ['full denominator with six selected details', () => Array.from({ length: 12 }, (_, i) => makeRound([[10, 'focus', 'enemy1']], { no: i + 1 })),
    { rounds: 12, kills: 12, openingKills: 12 }, /12개 라운드.*12킬/],
];

for (const [name, build, expected, observation] of cases) test(`quality corpus: ${name}`, () => {
  const replay = makeReplay(build()), before = structuredClone(replay);
  const report = auditReplayCoachingQuality(replay), focus = report.players[0];
  for (const [key, value] of Object.entries(expected)) assert.equal(focus.metrics[key], value, key);
  assert.match(focus.observations.map(c => c.text).join(' '), observation);
  assert.deepEqual(replay, before);
  const json = JSON.stringify(report);
  for (const privateText of ['nexonSN', 'synthetic-context-match', 'enemy1', 'focus', 'test weapon']) assert.ok(!json.includes(privateText));
});

test('quality corpus: no verified rounds withholds every observation', () => {
  const round = makeRound(); round.replayCharacterInfo = [];
  const report = auditReplayCoachingQuality(makeReplay([round]));
  assert.equal(report.verifiedPlayerRounds, 0); assert.equal(report.excludedPlayerRounds, 6);
  assert.equal(report.checkedObservations, 0);
  for (const player of report.players) { assert.equal(player.metrics, null); assert.deepEqual(player.observations, []); }
});

test('quality oracle retains simultaneous-victim counts and does not promote dead attackers to a trade', () => {
  const simultaneous = makeRound([[10, 'enemy1', 'mate'], [10, 'enemy1', 'spare'], [16, 'focus', 'enemy1']]);
  assert.deepEqual(rawRoundFacts(simultaneous, 'focus').tradesMade, [{ timeSeconds: 1.6, gapSeconds: 0.6, alliedDeathsAtPriorTime: 2 }]);
  const posthumous = makeRound([[10, 'enemy1', 'focus'], [20, 'enemy1', 'mate'], [30, 'focus', 'enemy1']]);
  assert.deepEqual(rawRoundFacts(posthumous, 'focus').tradesMade, []);
  auditReplayCoachingQuality(makeReplay([posthumous]));
});

test('semantic audit catches wrong numbers and unsupported claims even with valid response references', () => {
  const replay = makeReplay([makeRound([[10, 'enemy1', 'focus']])]);
  const e = analyzeReplay(replay, 'focus').coachingEvidence, original = createMockReplayCoachingResponse(e);
  const facts = [rawRoundFacts(replay.replay_info.replayRoundInfo[0], 'focus')];
  checkTemplateFacts(original, facts, e.metrics);
  for (const wrong of ['1라운드 1.0초, 본인 포함 5대5에서 첫 사망했습니다.',
    '1라운드에서 무리하게 진입해서 팀이 패배했습니다.']) {
    const response = structuredClone(original); response.cards[0].observation = wrong;
    assert.doesNotThrow(() => validateReplayCoachingResponse(response, e));
    assert.throws(() => checkTemplateFacts(response, facts, e.metrics), /differs from raw events/);
  }
  const wrongTotal = structuredClone(original);
  wrongTotal.cards.at(-1).observation = '검증된 1개 라운드에서 99킬·1사망, 평균 생존 1.0초를 기록했습니다.';
  assert.doesNotThrow(() => validateReplayCoachingResponse(wrongTotal, e));
  assert.throws(() => checkTemplateFacts(wrongTotal, facts, e.metrics));
});

test('offline audit is independent of event order, including tied events', () => {
  const replay = makeReplay([makeRound([[10, 'enemy1', 'mate'], [10, 'enemy2', 'spare'], [16, 'focus', 'enemy1']])]);
  const original = auditReplayCoachingQuality(replay);
  replay.replay_info.replayRoundInfo[0].replayAttackInfo.reverse();
  assert.deepEqual(auditReplayCoachingQuality(replay), original);
});

test('zero-timestamp losses and an initially solo roster keep distinct initial/after-event facts', () => {
  const zero = makeRound([[0, 'enemy1', 'mate'], [0, 'enemy2', 'spare']]);
  assert.deepEqual(rawRoundFacts(zero, 'focus').alone, { timeSeconds: 0, opponentsAlive: 3 });
  auditReplayCoachingQuality(makeReplay([zero]));
  const teams = { focus: 0, enemy1: 1, enemy2: 1 };
  const solo = makeRound([[0, 'focus', 'enemy1']], { teams });
  assert.deepEqual(rawRoundFacts(solo, 'focus').alone, { timeSeconds: 0, opponentsAlive: 2 });
  auditReplayCoachingQuality(makeReplay([solo], teams));
});
