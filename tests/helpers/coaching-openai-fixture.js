import depth from '../../cloud-functions/replay-coaching-depth.js';
import { analyzeReplay } from '../../src/domains/stats/sudden-attack/replay/domain/replay-analyzer.js';
import { contextFixture } from '../fixtures/replay-context.js';
export function coachingSelection() {
  return { schemaVersion: 2, cards: [{ kind: 'review', factId: 'summary', questionId: 'q_summary', practiceId: 'p_summary' }] };
}
export function coachingResponse(evidence = analyzeReplay(contextFixture(), 'focus').coachingEvidence, selection = coachingSelection()) {
  return depth.renderCoachingDepthSelection(selection, evidence);
}
export function coachingSlots(selection = coachingSelection()) {
  const slots = { strength: null, review: null, practice: null };
  for (const { kind, factId, questionId, practiceId } of selection.cards) slots[kind] = { factId, questionId, practiceId };
  return { schemaVersion: 3, slots };
}
export function openAIEnvelope(quote, selection = coachingSelection()) {
  return { id: 'resp_local_fixture', object: 'response', model: quote.model, service_tier: 'default', status: 'completed',
    error: null, incomplete_details: null,
    output: [{ type: 'message', role: 'assistant', status: 'completed', content: [
      { type: 'output_text', text: JSON.stringify(coachingSlots(selection)), annotations: [] }] }],
    usage: { input_tokens: quote.inputTokens, output_tokens: 200, total_tokens: quote.inputTokens + 200,
      input_tokens_details: { cached_tokens: 0, cache_write_tokens: 0 }, output_tokens_details: { reasoning_tokens: 0 } } };
}
