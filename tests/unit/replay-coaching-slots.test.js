import test from 'node:test';
import assert from 'node:assert/strict';
import facts from '../../cloud-functions/replay-coaching-facts.js';
import preflight from '../../cloud-functions/replay-coaching-preflight.js';
import cost from '../../cloud-functions/replay-coaching-cost.js';
import openai from '../../cloud-functions/replay-coaching-openai.js';
import { analyzeReplay } from '../../src/domains/stats/sudden-attack/replay/domain/replay-analyzer.js';
import { makeReplay, makeRound } from '../fixtures/replay-context.js';
import { coachingSlots, openAIEnvelope } from '../helpers/coaching-openai-fixture.js';

const NOW = Date.parse('2026-10-26T00:00:00Z');
const code = expected => error => error.code === expected;
const evidence = () => analyzeReplay(makeReplay([
  makeRound([[10, 'enemy1', 'focus'], [16, 'mate', 'enemy1']]),
  makeRound([[10, 'enemy1', 'focus']], { no: 2 }),
  makeRound([[10, 'focus', 'enemy1']], { no: 3 }),
]), 'focus').coachingEvidence;
const received = { kind: 'review', factId: 'r1_received1', questionId: 'q_trade_received', practiceId: 'p_trade_received' };
const death = { kind: 'review', factId: 'r2_death', questionId: 'q_death_team', practiceId: 'p_death_team' };
const opening = { kind: 'strength', factId: 'r3_opening', questionId: 'q_opening', practiceId: 'p_opening' };
const canonical = cards => ({ schemaVersion: 2, cards });

test('fixed slots structurally allow at most one selection per card kind and permit explicit omissions', () => {
  const e = evidence(), { request } = preflight.buildCoachingRequest(e), schema = request.text.format.schema;
  assert.deepEqual(schema.required, ['schemaVersion', 'slots']);
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.properties.cards, undefined);
  const slots = schema.properties.slots;
  assert.equal(slots.type, 'object'); assert.equal(slots.additionalProperties, false);
  assert.deepEqual(slots.required, ['strength', 'review', 'practice']);
  assert.deepEqual(Object.keys(slots.properties), slots.required);
  for (const kind of slots.required) {
    const slot = slots.properties[kind];
    assert.deepEqual(slot.anyOf[1], { type: 'null' });
    assert.deepEqual(slot.anyOf[0].required, ['factId', 'questionId', 'practiceId']);
    assert.equal(slot.anyOf[0].properties.kind, undefined);
  }
  const quiet = analyzeReplay(makeReplay([makeRound()]), 'focus').coachingEvidence;
  assert.deepEqual(preflight.buildCoachingRequest(quiet).request.text.format.schema.properties.slots.properties.strength, { type: 'null' });
});

test('slot selections normalize to unchanged canonical stored IDs and UI cards without changing their kinds', () => {
  const e = evidence(), selection = canonical([opening, received]);
  const payload = coachingSlots(selection);
  assert.equal(payload.slots.practice, null);
  const normalized = facts.normalizeCoachingSlotSelection(payload);
  assert.deepEqual(normalized, selection);
  assert.deepEqual(facts.renderCoachingSelection(normalized, e), facts.renderCoachingSelection(selection, e));
  assert.equal(facts.renderCoachingSelection(normalized, e).schemaVersion, 1);
  assert.deepEqual(facts.normalizeCoachingSlotSelection(coachingSlots(canonical([received]))), canonical([received]));
});

test('observed duplicate-review failure stays rejected while one chosen review plus strength decodes offline', async () => {
  const e = evidence(), old = canonical([received, death, opening]);
  // Both review facts are legitimate individually; their duplicate kind caused
  // the live v2 rejection. Fixed slots express a choice, not a silent relabel.
  for (const card of old.cards) assert.equal(facts.renderCoachingSelection(canonical([card]), e).cards.length, 1);
  assert.throws(() => facts.normalizeCoachingSelection(old), code('INVALID_COACHING_SELECTION'));
  assert.throws(() => facts.normalizeCoachingSlotSelection(old), code('INVALID_COACHING_SELECTION'));
  const request = preflight.buildCoachingRequest(e).request, quote = cost.makeCostQuote(1000, request, NOW);
  const selected = canonical([opening, received]);
  const decoded = await openai.decodeOpenAIResponse(openAIEnvelope(quote, selected), quote, e);
  assert.deepEqual(decoded.result.selection, selected);
  assert.deepEqual(decoded.result.response.cards.map(c => c.kind), ['strength', 'review']);
  assert.equal(decoded.chargedUnits, 200);
});

test('slot parser rejects empty sets, duplicate facts, missing slots, free prose and nested kind overrides', () => {
  const payload = coachingSlots(canonical([received]));
  const withoutStrength = structuredClone(payload); delete withoutStrength.slots.strength;
  const duplicateFact = structuredClone(payload); duplicateFact.slots.practice = { ...duplicateFact.slots.review };
  for (const invalid of [
    { schemaVersion: 3, slots: { strength: null, review: null, practice: null } },
    withoutStrength, duplicateFact,
    { ...payload, observation: 'invented prose' },
    { ...payload, slots: { ...payload.slots, review2: payload.slots.review } },
    { ...payload, slots: { ...payload.slots, review: { ...payload.slots.review, kind: 'practice' } } },
    { ...payload, slots: { ...payload.slots, review: [payload.slots.review] } },
  ]) assert.throws(() => facts.normalizeCoachingSlotSelection(invalid), code('INVALID_COACHING_SELECTION'));
});

test('fixed slots preserve fact-kind and fact-question-practice validation and known expense on bad output', async () => {
  const e = evidence(), request = preflight.buildCoachingRequest(e).request, quote = cost.makeCostQuote(1000, request, NOW);
  const invalidContext = coachingSlots(canonical([received]));
  invalidContext.slots.review.practiceId = 'p_death_team';
  const normalized = facts.normalizeCoachingSlotSelection(invalidContext);
  assert.throws(() => facts.renderCoachingSelection(normalized, e), code('COACHING_SELECTION_NOT_ALLOWED'));
  const invalidKind = coachingSlots(canonical([received]));
  invalidKind.slots.strength = invalidKind.slots.review; invalidKind.slots.review = null;
  assert.throws(() => facts.renderCoachingSelection(facts.normalizeCoachingSlotSelection(invalidKind), e), code('COACHING_SELECTION_NOT_ALLOWED'));
  for (const value of [invalidContext, invalidKind, { schemaVersion: 3, slots: { strength: null, review: null, practice: null } }, canonical([received])]) {
    const raw = openAIEnvelope(quote);
    raw.output[0].content[0].text = JSON.stringify(value);
    const decoded = await openai.decodeOpenAIResponse(raw, quote, e);
    assert.equal(decoded.result, null); assert.equal(decoded.chargedUnits, 200);
  }
});

test('stored canonical v2 selections remain verifiable after provider response format changes', async () => {
  const e = evidence(), selection = canonical([opening, received]);
  const stored = { providerResponseId: 'resp_saved_v2', selection, response: facts.renderCoachingSelection(selection, e) };
  assert.deepEqual((await openai.validateResultForEvidence(stored, e)).selection, selection);
  const changed = structuredClone(stored); changed.response.cards[0].observation = 'changed';
  await assert.rejects(openai.validateResultForEvidence(changed, e), code('COACHING_RESULT_MISMATCH'));
});
