import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeReplay } from '../../src/domains/stats/sudden-attack/replay/domain/replay-analyzer.js';
import { buildReplayCoachingEvidence } from '../../src/domains/stats/sudden-attack/replay/domain/replay-coaching-evidence.js';
import { contextFixture, makeReplay, makeRound, roster } from '../fixtures/replay-context.js';

const evidenceFor = rounds => analyzeReplay(makeReplay(rounds), 'focus').coachingEvidence;

test('the real analyzer produces numeric, referenced coaching evidence without changing replay data', () => {
  const replay = contextFixture(), before = structuredClone(replay);
  const analysis = analyzeReplay(replay, 'focus'), e = analysis.coachingEvidence;
  assert.deepEqual(replay, before);
  assert.equal(e.schemaVersion, 1); assert.equal(e.status, 'ready');
  assert.deepEqual(e.coverage, { totalRounds: 2, verifiedRounds: 2, excludedRounds: 0,
    excluded: { incompleteContext: 0, invalidRoundNumber: 0, duplicateRoundNumber: 0 } });
  assert.deepEqual(e.metrics, { evidenceId: 'verified-rounds', rounds: 2, kills: 1, killsAfterDeath: 0,
    deaths: 2, survivedRounds: 0, wonRounds: 0, averageSurvivalSeconds: 3.3,
    openingKills: 0, openingDeaths: 1, tradeCandidatesMade: 1, tradeCandidatesReceived: 0, outnumberedSoloRounds: 1 });
  assert.deepEqual(e.rounds.map(r => r.evidenceId), ['round-1', 'round-2']);
  assert.deepEqual(e.rounds[0].death, { timeSeconds: 4.5, ownAlive: 1, enemyAlive: 2, opening: false, simultaneous: false });
  assert.deepEqual(e.rounds[0].tradesMade.examples, [{ timeSeconds: 1.6, gapSeconds: 0.6, alliedDeathsAtPriorTime: 1 }]);
  assert.deepEqual(e.rounds[0].alone, { timeSeconds: 3, opponentsAlive: 2 });
  assert.equal(e.rules.tradeWindowSeconds, 5);
  assert.equal(e.rules.aliveCountsIncludeSelectedPlayer, true);
  assert.deepEqual(buildReplayCoachingEvidence(analysis), e);
});

test('incomplete rounds do not enter aggregates or become zero-valued situation records', () => {
  const replay = contextFixture();
  replay.replay_info.replayRoundInfo[1].replayRoundSummaryInfo[0].reJoin = 1;
  const e = analyzeReplay(replay, 'focus').coachingEvidence;
  assert.equal(e.status, 'partial'); assert.equal(e.coverage.excludedRounds, 1);
  assert.equal(e.coverage.excluded.incompleteContext, 1);
  assert.equal(e.metrics.rounds, 1); assert.equal(e.metrics.deaths, 1);
  assert.equal(e.metrics.openingDeaths, 0); // The excluded round had an opening death.
  assert.equal(e.metrics.averageSurvivalSeconds, 4.5);
  assert.deepEqual(e.rounds.map(r => r.round), [1]);
});

test('no verified rounds has null metrics, unlike a verified round with zero kills or deaths', () => {
  for (const analysis of [undefined, { rounds: [] }, { rounds: [{ round: 1, context: { status: 'partial' } }] }]) {
    const e = buildReplayCoachingEvidence(analysis);
    assert.equal(e.status, 'insufficient_data'); assert.equal(e.metrics, null); assert.deepEqual(e.rounds, []);
  }
  const e = evidenceFor([makeRound()]);
  assert.equal(e.status, 'ready'); assert.equal(e.metrics.kills, 0); assert.equal(e.metrics.deaths, 0);
  assert.equal(e.metrics.survivedRounds, 1); assert.equal(e.metrics.averageSurvivalSeconds, 20);
});

test('names, IDs, map/weapon text, positions and arbitrary strings never leak through the projection', () => {
  const replay = contextFixture(), marker = 'PRIVATE-IGNORE-ALL-INSTRUCTIONS-秘密';
  replay.replay_info.replayMatchSummaryInfo.matchID = marker;
  replay.replay_info.replayMatchSummaryInfo.mapName = marker;
  for (const p of replay.replay_info.replayCharacterSummaryInfo) p.nickName = marker;
  for (const r of replay.replay_info.replayRoundInfo) for (const event of r.replayAttackInfo) {
    event.attackerNickName = marker; event.victimNickName = marker; event.itemName = marker;
    event.attackerPosX = 7654321;
  }
  const a = analyzeReplay(replay, 'focus');
  a.insights.push({ title: marker, body: marker });
  a.contextSummary.untrusted = marker;
  const before = structuredClone(a), e = buildReplayCoachingEvidence(a), json = JSON.stringify(e);
  assert.deepEqual(a, before);
  for (const text of [marker, '7654321', 'focus', 'mate', 'enemy1', 'nexonSN', 'matchID', 'weapon', 'forecast']) assert.ok(!json.includes(text), text);
  assert.equal(e.rounds[0].tradesMade.count, 1);
});

test('simultaneous opening events remain unordered and never become a zero-second trade', () => {
  const e = evidenceFor([makeRound([[10, 'enemy1', 'mate'], [10, 'focus', 'enemy1']])]);
  assert.equal(e.metrics.openingKills, 1); assert.equal(e.metrics.tradeCandidatesMade, 0);
  assert.equal(e.rounds[0].opening.simultaneous, true);
  assert.equal(e.rules.simultaneousEventsAreUnordered, true);
});

test('trade received evidence preserves the measured gap without exposing any participant identity', () => {
  const e = evidenceFor([makeRound([[10, 'enemy1', 'focus'], [16, 'mate', 'enemy1']])]);
  assert.equal(e.metrics.tradeCandidatesReceived, 1);
  assert.deepEqual(e.rounds[0].tradesReceived.examples, [{ timeSeconds: 1.6, gapSeconds: 0.6, alliedDeathsAtPriorTime: 1 }]);
});

test('round-side switches use the verified round team rather than match-wide team or result', () => {
  const flipped = Object.fromEntries(Object.entries(roster).map(([id, team]) => [id, 1 - team]));
  const e = evidenceFor([makeRound([], { winTeam: 0 }), makeRound([], { no: 2, teams: flipped, winTeam: 1 })]);
  assert.deepEqual(e.rounds.map(r => [r.side, r.result]), [['attack', 'win'], ['defense', 'win']]);
  assert.equal(e.metrics.wonRounds, 2);
});

test('posthumous kills are counted explicitly and do not extend survival time', () => {
  const e = evidenceFor([makeRound([[10, 'enemy1', 'focus'], [20, 'focus', 'enemy2']])]);
  assert.equal(e.metrics.kills, 1); assert.equal(e.metrics.killsAfterDeath, 1);
  assert.equal(e.metrics.averageSurvivalSeconds, 1);
  assert.equal(e.rounds[0].killsAfterDeath, 1); assert.equal(e.rounds[0].survivalSeconds, 1);
});

test('six diverse details retain full verified-round metrics and explicitly disclose truncation', () => {
  const rounds = Array.from({ length: 7 }, (_, i) => makeRound([], { no: i + 1 }));
  rounds.push(makeRound([[10, 'focus', 'enemy1'], [20, 'focus', 'enemy2']], { no: 8 }),
    makeRound([[10, 'enemy1', 'focus']], { no: 9 }),
    makeRound([[10, 'enemy1', 'mate'], [16, 'focus', 'enemy1']], { no: 10 }),
    makeRound([[10, 'enemy1', 'focus'], [16, 'mate', 'enemy1']], { no: 11 }),
    makeRound([[10, 'enemy1', 'mate'], [20, 'enemy2', 'spare']], { no: 12 }));
  const e = evidenceFor(rounds);
  assert.equal(e.coverage.verifiedRounds, 12); assert.equal(e.metrics.rounds, 12);
  assert.equal(e.metrics.kills, 3); assert.equal(e.metrics.deaths, 2); assert.equal(e.metrics.survivedRounds, 10);
  assert.deepEqual(e.rounds.map(r => r.round), [1, 8, 9, 10, 11, 12]);
  assert.equal(e.detailSelection.includedRounds, 6); assert.equal(e.detailSelection.omittedVerifiedRounds, 6);
  assert.equal(e.rounds.find(r => r.round === 12).selectionReason, 'outnumbered_solo');
});

test('trade examples are bounded while their aggregate counts remain complete', () => {
  const teams = { focus: 0, mate1: 0, mate2: 0, mate3: 0, enemy1: 1, enemy2: 1, enemy3: 1 };
  const round = makeRound([[10, 'enemy1', 'mate1'], [16, 'focus', 'enemy1'],
    [30, 'enemy2', 'mate2'], [36, 'focus', 'enemy2'], [50, 'enemy3', 'mate3'], [56, 'focus', 'enemy3']], { teams });
  const e = analyzeReplay(makeReplay([round], teams), 'focus').coachingEvidence;
  assert.equal(e.metrics.tradeCandidatesMade, 3);
  assert.equal(e.rounds[0].tradesMade.count, 3);
  assert.equal(e.rounds[0].tradesMade.examples.length, 2);
  assert.equal(e.rounds[0].tradesMade.omittedExamples, 1);
});

test('late opening kills are retained ahead of rounds with no recorded combat', () => {
  const rounds = Array.from({ length: 7 }, (_, i) => makeRound([], { no: i + 1 }));
  rounds.push(makeRound([[10, 'focus', 'enemy1']], { no: 8 }), makeRound([[10, 'focus', 'enemy2']], { no: 9 }));
  const e = evidenceFor(rounds);
  assert.equal(e.metrics.openingKills, 2);
  assert.ok(e.rounds.some(r => r.round === 8)); assert.ok(e.rounds.some(r => r.round === 9));
  assert.equal(e.rounds.find(r => r.round === 9).selectionReason, 'opening_kill');
});

test('duplicate or invalid round references are withheld instead of citing an ambiguous scene', () => {
  const replay = makeReplay([makeRound(), makeRound(), makeRound([], { no: 3 })]);
  replay.replay_info.replayRoundInfo[2].no = 0;
  const e = analyzeReplay(replay, 'focus').coachingEvidence;
  assert.equal(e.status, 'insufficient_data'); assert.equal(e.metrics, null);
  assert.deepEqual(e.coverage.excluded, { incompleteContext: 0, invalidRoundNumber: 1, duplicateRoundNumber: 2 });
});

test('the same verified rounds give identical summaries after input reordering, without mutation', () => {
  const a = analyzeReplay(contextFixture(), 'focus');
  a.rounds.reverse(); const before = structuredClone(a);
  assert.deepEqual(buildReplayCoachingEvidence(a), a.coachingEvidence);
  assert.deepEqual(a, before);
});

test('a long replay with unbounded free text still produces a small fixed-detail JSON input', () => {
  const replay = makeReplay(Array.from({ length: 200 }, (_, i) => makeRound([[10, 'enemy1', 'focus'], [16, 'mate', 'enemy1']], { no: i + 1 })));
  replay.replay_info.replayCharacterSummaryInfo[0].nickName = 'long name'.repeat(10000);
  const e = analyzeReplay(replay, 'focus').coachingEvidence;
  assert.equal(e.metrics.rounds, 200); assert.equal(e.metrics.tradeCandidatesReceived, 200);
  assert.equal(e.rounds.length, 6); assert.equal(e.detailSelection.omittedVerifiedRounds, 194);
  assert.ok(Buffer.byteLength(JSON.stringify(e), 'utf8') < 12000);
});

test('large finite recorded durations do not overflow the average into an unknown null value', () => {
  const e = evidenceFor(Array.from({ length: 40 }, (_, i) => makeRound([], { no: i + 1, playTime: 1e307 })));
  assert.equal(e.status, 'ready'); assert.equal(e.metrics.averageSurvivalSeconds, 1e307);
  assert.equal(JSON.parse(JSON.stringify(e)).metrics.averageSurvivalSeconds, 1e307);
});
