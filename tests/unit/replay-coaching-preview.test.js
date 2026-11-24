import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeReplay } from '../../src/domains/stats/sudden-attack/replay/domain/replay-analyzer.js';
import { validateReplayCoachingResponse } from '../../src/domains/stats/sudden-attack/replay/domain/replay-coaching-response.js';
import { createMockReplayCoachingResponse } from '../../src/domains/stats/sudden-attack/replay/application/replay-coaching-preview.js';
import { renderReplayCoachingPanel } from '../../src/domains/stats/sudden-attack/replay/ui/replay-coaching-panel.js';
import { contextFixture, makeReplay, makeRound } from '../fixtures/replay-context.js';

const evidenceFor = rounds => analyzeReplay(makeReplay(rounds), 'focus').coachingEvidence;
const fixture = () => analyzeReplay(contextFixture(), 'focus').coachingEvidence;

test('mock response cites real evidence, separates facts/practice/limits and leaves the input unchanged', () => {
  const evidence = fixture(), before = structuredClone(evidence);
  const response = createMockReplayCoachingResponse(evidence);
  assert.deepEqual(validateReplayCoachingResponse(response, evidence), response);
  assert.deepEqual(evidence, before);
  assert.deepEqual(response.cards.map(c => c.kind), ['strength', 'review', 'practice']);
  assert.match(response.cards[0].observation, /1라운드.*0.6초/);
  assert.match(response.cards[1].observation, /2라운드.*2.0초.*3대3/);
  assert.deepEqual(response.cards.map(c => c.evidenceRefs), [['round-1'], ['round-2'], ['verified-rounds']]);
  assert.match(response.cards[2].observation, /2개 라운드.*1킬·2사망/);
  assert.deepEqual(createMockReplayCoachingResponse(evidence), response);
});

test('received trade explains death and measured delay without asserting deliberate cover', () => {
  const e = evidenceFor([makeRound([[10, 'enemy1', 'focus'], [16, 'mate', 'enemy1']])]);
  // This was an opening death; use another prior kill to exercise the received-trade branch.
  const other = evidenceFor([makeRound([[5, 'enemy2', 'spare'], [10, 'enemy1', 'focus'], [16, 'mate', 'enemy1']])]);
  assert.match(createMockReplayCoachingResponse(e).cards.find(c => c.kind === 'review').title, /첫 사망/);
  const review = createMockReplayCoachingResponse(other).cards.find(c => c.kind === 'review');
  assert.match(review.observation, /1.0초.*2대3.*0.6초/);
  assert.match(review.limitation, /후보.*의도는 확인할 수 없습니다/);
});

for (const [name, events, check] of [
  ['simultaneous opening', [[10, 'enemy1', 'mate'], [10, 'focus', 'enemy1']], /같은 시각/],
  ['posthumous kill', [[10, 'enemy1', 'focus'], [20, 'focus', 'enemy2']], /사망 이후 처치 1건/],
  ['solo situation', [[10, 'enemy1', 'mate'], [20, 'enemy2', 'spare']], /1대3 상황/],
]) {
  test(`mock keeps uncertainty for ${name}`, () => {
    const e = evidenceFor([makeRound(events)]), response = createMockReplayCoachingResponse(e);
    validateReplayCoachingResponse(response, e);
    assert.match(response.cards.map(c => c.observation).join(' '), check);
  });
}

test('unknown rounds are excluded from prose and aggregate denominator', () => {
  const replay = contextFixture(); replay.replay_info.replayRoundInfo[1].replayRoundSummaryInfo[0].reJoin = 1;
  const e = analyzeReplay(replay, 'focus').coachingEvidence, response = createMockReplayCoachingResponse(e);
  validateReplayCoachingResponse(response, e);
  assert.ok(!JSON.stringify(response).includes('round-2'));
  assert.match(response.cards.find(c => c.kind === 'practice').observation, /1개 라운드.*1킬·1사망/);
  assert.match(renderReplayCoachingPanel(e), /검증된 1\/2개 라운드/);
});

test('no verified context has no invented coaching, while a verified zero-event round gets a limited practice', () => {
  const replay = contextFixture();
  for (const r of replay.replay_info.replayRoundInfo) r.replayCharacterInfo = [];
  const e = analyzeReplay(replay, 'focus').coachingEvidence;
  assert.deepEqual(validateReplayCoachingResponse(createMockReplayCoachingResponse(e), e).cards, []);
  assert.match(renderReplayCoachingPanel(e), /검증된 라운드가 없어 해설을 보류/);
  assert.ok(!renderReplayCoachingPanel(e).includes('class="coaching-card"'));
  const zero = evidenceFor([makeRound()]), response = createMockReplayCoachingResponse(zero);
  assert.equal(response.cards.length, 1); assert.match(response.cards[0].observation, /0킬·0사망/);
});

const badResponses = [
  ['wrong version', r => { r.schemaVersion = 2; }],
  ['invented source', r => { r.source = 'AI'; }],
  ['extra card field', r => { r.cards[0].html = '<img src=x>'; }],
  ['missing text', r => { delete r.cards[0].practice; }],
  ['empty text', r => { r.cards[0].observation = ' '; }],
  ['oversized text', r => { r.cards[0].observation = 'a'.repeat(401); }],
  ['wrong text type', r => { r.cards[0].limitation = null; }],
  ['unknown kind', r => { r.cards[0].kind = 'diagnosis'; }],
  ['duplicate kind', r => { r.cards[1].kind = r.cards[0].kind; }],
  ['no references', r => { r.cards[0].evidenceRefs = []; }],
  ['unknown round', r => { r.cards[0].evidenceRefs = ['round-99']; }],
  ['duplicate reference', r => { r.cards[0].evidenceRefs = ['round-1', 'round-1']; }],
  ['too many cards', r => { r.cards.push(structuredClone(r.cards[0])); }],
  ['empty success', r => { r.cards = []; }],
];
for (const [name, mutate] of badResponses) test(`response contract rejects ${name} atomically`, () => {
  const e = fixture(), response = createMockReplayCoachingResponse(e); mutate(response);
  assert.throws(() => validateReplayCoachingResponse(response, e), /INVALID_COACHING_RESPONSE/);
  const html = renderReplayCoachingPanel(e, response);
  assert.match(html, /표시를 보류/); assert.ok(!html.includes('class="coaching-card"'));
});

test('response rejects a previously valid reference once that round is excluded', () => {
  const replay = contextFixture(), response = createMockReplayCoachingResponse(analyzeReplay(replay, 'focus').coachingEvidence);
  replay.replay_info.replayRoundInfo[1].replayRoundSummaryInfo[0].reJoin = 1;
  assert.throws(() => validateReplayCoachingResponse(response, analyzeReplay(replay, 'focus').coachingEvidence), /INVALID_COACHING_RESPONSE/);
});

test('renderer escapes every prose field and only produces round buttons for validated references', () => {
  const e = fixture(), response = createMockReplayCoachingResponse(e), attack = '<img src=x onerror="alert(1)">';
  for (const c of response.cards) for (const field of ['title', 'observation', 'practice', 'limitation']) c[field] = attack;
  const html = renderReplayCoachingPanel(e, response);
  assert.ok(!html.includes('<img')); assert.match(html, /&lt;img/);
  assert.match(html, /AI 미연결 · 예시/); assert.match(html, /data-round-jump="1"/);
  assert.match(html, /검증된 2개 라운드 전체 집계/);
});

test('malformed evidence cannot take down the existing analysis when rendering the optional preview', () => {
  assert.match(renderReplayCoachingPanel(undefined), /표시를 보류/);
  const e = fixture(); e.coverage.verifiedRounds = 100;
  assert.match(renderReplayCoachingPanel(e), /표시를 보류/);
});
