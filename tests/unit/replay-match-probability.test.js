import test from 'node:test';
import assert from 'node:assert/strict';
import { createMatchWinState, advanceMatchWinState, estimateMatchWinChance } from '../../src/domains/stats/sudden-attack/replay/domain/replay-match-probability.js';
import { buildReplayPlayback, getPlaybackFrame, createReplayPlaybackShare } from '../../src/domains/stats/sudden-attack/replay/domain/replay-playback.js';
import { renderReplayPlayback } from '../../src/domains/stats/sudden-attack/replay/ui/replay-playback.js';
import { makeRound, makeReplay } from '../fixtures/replay-context.js';

const play = winners => winners.reduce(advanceMatchWinState, createMatchWinState());
function ranked(winners) {
  let state = createMatchWinState();
  const rounds = winners.map((winner, i) => {
    const round = { ...makeRound([], { no: i + 1, winTeam: winner, offenseTeam: state.phase === 'first' ? 0 : 1 }), replayBombInfo: [] };
    state = advanceMatchWinState(state, winner);
    return round;
  });
  const raw = makeReplay(rounds);
  raw.replay_info.replayMatchSummaryInfo.matchType = 'R';
  return raw;
}

test('3:0 halftime keeps the match lead and 4:0 clinches because a tie is impossible', () => {
  const half = play([0, 0, 0]);
  assert.equal(half.phase, 'second'); assert.deepEqual(half.half, [0, 0]);
  assert.equal(estimateMatchWinChance(half), 93.75);
  const end = advanceMatchWinState(half, 0);
  assert.deepEqual(end.score, [4, 0]); assert.equal(end.winner, 0); assert.equal(end.phase, 'finished');
  assert.equal(estimateMatchWinChance(end), 100); assert.equal(advanceMatchWinState(end, 1), null);
});

test('3:2 then 4:2 continues, allowing a 4:5 comeback; 5:2 also permits a tie', () => {
  const half = play([0, 1, 0, 1, 0]);
  assert.equal(half.phase, 'second'); assert.deepEqual(half.score, [3, 2]);
  assert.equal(estimateMatchWinChance(half), 59.375);
  const next = advanceMatchWinState(half, 0);
  assert.deepEqual(next.score, [4, 2]); assert.equal(next.phase, 'second');
  assert.equal(advanceMatchWinState(next, 0).phase, 'second');
  const comeback = [1, 1, 1].reduce(advanceMatchWinState, next);
  assert.deepEqual(comeback.score, [4, 5]); assert.equal(comeback.winner, 1);
});

test('a tie at the end of the second half enters exactly one golden round, also at 5:5', () => {
  for (const winners of [[0, 0, 0, 1, 1, 1], [0, 1, 0, 0, 1, 0, 1, 1], [0, 1, 0, 1, 0, 1, 0, 1, 0, 1]]) {
    const tied = play(winners);
    assert.equal(tied.phase, 'golden'); assert.equal(tied.score[0], tied.score[1]);
    assert.equal(estimateMatchWinChance(tied), 50);
    for (const winner of [0, 1]) {
      const end = advanceMatchWinState(tied, winner);
      assert.equal(end.phase, 'finished'); assert.equal(end.winner, winner);
      assert.equal(estimateMatchWinChance(end), winner === 0 ? 100 : 0);
    }
  }
});

// An independent full-half enumeration: do not prune early. Every remaining
// second-half scoreline contributes its fair-coin mass; aggregate ties get 1/2.
function enumerateHalf(a, b) {
  if (a === 3 || b === 3) return [[a, b, 1]];
  return [...enumerateHalf(a + 1, b), ...enumerateHalf(a, b + 1)].map(([x, y, mass]) => [x, y, mass / 2]);
}
function exhaustiveSecondHalf(state) {
  return enumerateHalf(...state.half).reduce((sum, [a, b, mass]) => {
    const finalA = state.score[0] + a - state.half[0], finalB = state.score[1] + b - state.half[1];
    return sum + mass * (finalA > finalB ? 1 : finalA === finalB ? 0.5 : 0);
  }, 0) * 100;
}
test('every reachable state agrees with full scoreline enumeration, is symmetric and has valid terminals', () => {
  const seen = new Set(); let secondCount = 0;
  function visit(state) {
    const key = JSON.stringify(state); if (seen.has(key)) return; seen.add(key);
    const chance = estimateMatchWinChance(state);
    assert.ok(Number.isFinite(chance) && chance >= 0 && chance <= 100);
    const mirrored = { ...state, score: [...state.score].reverse(), half: [...state.half].reverse(), winner: state.winner === null ? null : 1 - state.winner };
    assert.equal(chance + estimateMatchWinChance(mirrored), 100);
    if (state.phase === 'second') { assert.equal(chance, exhaustiveSecondHalf(state)); secondCount++; }
    if (state.phase === 'finished') { assert.ok(state.score[state.winner] > state.score[1 - state.winner]); return; }
    assert.equal(chance, (estimateMatchWinChance(advanceMatchWinState(state, 0)) + estimateMatchWinChance(advanceMatchWinState(state, 1))) / 2);
    for (const winner of [0, 1]) visit(advanceMatchWinState(state, winner));
  }
  visit(createMatchWinState()); assert.ok(secondCount > 30);
});

test('current-round evidence blends next-score outcomes and never changes the assumed future strength', () => {
  const state = play([0, 0, 0]), before = structuredClone(state);
  const win = estimateMatchWinChance(advanceMatchWinState(state, 0));
  const lose = estimateMatchWinChance(advanceMatchWinState(state, 1));
  assert.equal(estimateMatchWinChance(state, 0.7), 0.7 * win + 0.3 * lose);
  assert.deepEqual(state, before);
  for (const bad of [NaN, Infinity, -1, 1.1, null]) assert.equal(estimateMatchWinChance(state, bad), null);
});

test('ranked playback carries 3:0 across halftime, marks 4:0 terminal and shares the same estimate', () => {
  const raw = ranked([0, 0, 0, 0]), before = structuredClone(raw), model = buildReplayPlayback(raw);
  assert.equal(model.metric, 'match-estimate'); assert.equal(model.verifiedRounds, 4);
  const half = getPlaybackFrame(model, 60000);
  assert.deepEqual(half.score, [3, 0]); assert.equal(half.phase, 'second'); assert.equal(half.indexA, 93.8);
  assert.equal(getPlaybackFrame(model, 60000, 3).indexA, half.indexA);
  const end = getPlaybackFrame(model, model.durationMs);
  assert.equal(end.phase, 'finished'); assert.equal(end.indexA, 100);
  assert.equal(createReplayPlaybackShare(model, model.durationMs).scene.indexA, 100);
  assert.match(renderReplayPlayback(model), /경기 승리 추정치 계산 기준 · 실측 승률이 아닙니다/);
  assert.deepEqual(raw, before);
});

test('future summary, round winners and match length never supply an earlier prediction', () => {
  const a = ranked([0, 0, 0, 0]), b = ranked([0, 0, 0, 1, 1, 1, 1]);
  b.replay_info.replayMatchSummaryInfo.winTeam = 0;
  b.replay_info.replayMatchSummaryInfo.teamAWinCnt = 999;
  const ma = buildReplayPlayback(a), mb = buildReplayPlayback(b);
  for (const at of [0, 19999, 40000, 60000, 79999])
    assert.equal(getPlaybackFrame(ma, at).indexA, getPlaybackFrame(mb, at).indexA);
});

test('unknown rules retain an explicitly labeled situation index; inconsistent ranked history is withheld locally', () => {
  const generic = ranked([0]); delete generic.replay_info.replayMatchSummaryInfo.matchType;
  assert.equal(buildReplayPlayback(generic).metric, 'situation');
  assert.match(renderReplayPlayback(buildReplayPlayback(generic)), /경기 규칙이 확인되지 않은 유형/);
  for (const edit of [
    rounds => rounds[3].offenseTeam = 0,
    rounds => rounds[3].no = 5,
    rounds => rounds.push({ ...makeRound([], { no: 5, winTeam: 1, offenseTeam: 1 }), replayBombInfo: [] }),
  ]) {
    const raw = ranked([0, 0, 0, 0]); edit(raw.replay_info.replayRoundInfo);
    const model = buildReplayPlayback(raw);
    assert.notEqual(getPlaybackFrame(model, 0).indexA, null);
    assert.equal(getPlaybackFrame(model, model.durationMs - 1).indexA, null);
  }
});

test('rejoin uncertainty still withholds the ranked estimate without hiding recorded events', () => {
  const raw = ranked([0]); raw.replay_info.replayRoundInfo[0].replayRoundSummaryInfo[0].reJoin = 1;
  const frame = getPlaybackFrame(buildReplayPlayback(raw), 1000);
  assert.equal(frame.indexA, null); assert.equal(frame.alive, null);
});
