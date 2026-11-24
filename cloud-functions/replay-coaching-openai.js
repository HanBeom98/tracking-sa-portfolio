const { validateRequestPolicy, validateCostQuote, requestHash, usageCost, uint } = require('./replay-coaching-cost.js');
const { normalizeCoachingResult } = require('./replay-coaching-result.js');
const { normalizeCoachingSlotSelection } = require('./replay-coaching-facts.js');
const { renderCoachingDepthSelection, curateCurrentDepthSelection } = require('./replay-coaching-depth.js');
const { renderReviewSelection, curateReviewSelection } = require('./replay-coaching-review-catalog.js');
const renderSelection = (selection, evidence) => evidence?.schemaVersion === 2
  ? renderReviewSelection(selection, evidence) : renderCoachingDepthSelection(selection, evidence);
const curateSelection = (selection, evidence) => evidence?.schemaVersion === 2
  ? curateReviewSelection(selection, evidence) : curateCurrentDepthSelection(selection, evidence);
const fail = code => { throw Object.assign(new Error(code), { code, status: 503 }); };
const MAX_BODY_BYTES = 65536;
// No SDK retries, redirects, automatic credential lookup, fallback model or polling.
// The trusted runner must durably mark dispatch BEFORE invoking this function.
function createOpenAIGenerator({ enabled = false, apiKey, fetchImpl = globalThis.fetch, timeoutMs = 30000 } = {}) {
  if (!enabled || typeof apiKey !== 'string' || !apiKey.trim() || /\s/.test(apiKey)
    || typeof fetchImpl !== 'function' || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 45000) fail('PROVIDER_DISABLED');
  const sent = new WeakSet();
  return async (request, quote) => {
    validateRequestPolicy(request); validateCostQuote(quote);
    const body = JSON.stringify(request);
    if (requestHash(request) !== quote.requestHash || Buffer.byteLength(body) > 32768) fail('INVALID_COST_REQUEST');
    if (sent.has(request)) fail('PROVIDER_ALREADY_DISPATCHED');
    sent.add(request);
    const controller = new AbortController(); let timer;
    try {
      return await Promise.race([
        (async () => {
          const response = await fetchImpl('https://api.openai.com/v1/responses', {
            method: 'POST', redirect: 'error', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body, signal: controller.signal });
          if (!response.ok || !response.body?.getReader) fail('PROVIDER_OUTCOME_UNCONFIRMED');
          const reader = response.body.getReader(), chunks = []; let size = 0;
          try {
            for (;;) {
              const { done, value } = await reader.read();
              if (done) break;
              size += value.byteLength;
              if (size > MAX_BODY_BYTES) { controller.abort(); fail('PROVIDER_OUTCOME_UNCONFIRMED'); }
              chunks.push(Buffer.from(value));
            }
          } finally { reader.releaseLock(); }
          return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
        })(),
        new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error('timeout')); }, timeoutMs); }),
      ]);
    } catch { fail('PROVIDER_OUTCOME_UNCONFIRMED'); }
    finally { clearTimeout(timer); }
  };
}

let validator;
async function validateResultForEvidence(result, evidence) {
  const normalized = normalizeCoachingResult(result);
  // Historical free-prose results remain readable for accounting, but cannot
  // masquerade as v2 verified facts or trigger a fresh paid generation.
  if (!normalized.selection) fail('COACHING_RESULT_UNAVAILABLE');
  const response = renderSelection(normalized.selection, evidence);
  if (JSON.stringify(response) !== JSON.stringify(normalized.response)) fail('COACHING_RESULT_MISMATCH');
  if (evidence?.schemaVersion === 2) return { ...normalized, response };
  validator ||= import('./replay-coaching-shared/response.mjs');
  return { ...normalized, response: (await validator).validateReplayCoachingResponse(normalized.response, evidence) };
}

// Only terminal, identified, priced and fully measured envelopes can settle.
// Bad/refused/truncated prose may still have known provider expense.
async function decodeOpenAIResponse(raw, quote, evidence) {
  validateCostQuote(quote);
  if (!raw || raw.object !== 'response' || typeof raw.id !== 'string' || !/^resp_[A-Za-z0-9_-]{1,120}$/.test(raw.id)
    || !['completed', 'incomplete', 'failed'].includes(raw.status)) fail('PROVIDER_OUTCOME_UNCONFIRMED');
  const usage = raw.usage;
  let chargedUnits;
  const measured = { model: raw.model, serviceTier: raw.service_tier, usage };
  try {
    chargedUnits = usageCost(quote, measured);
    if (!uint(usage.output_tokens_details?.reasoning_tokens) || usage.output_tokens_details.reasoning_tokens > usage.output_tokens) throw new Error();
  } catch { fail('PROVIDER_OUTCOME_UNCONFIRMED'); }
  // Drop all unneeded envelope data before crossing into accounting.
  const safeMeasured = { model: measured.model, serviceTier: measured.serviceTier, usage: {
    input_tokens: usage.input_tokens, output_tokens: usage.output_tokens, total_tokens: usage.total_tokens,
    input_tokens_details: { cached_tokens: 0, cache_write_tokens: 0 },
    output_tokens_details: { reasoning_tokens: usage.output_tokens_details.reasoning_tokens } } };
  let result = null;
  try {
    if (raw.status !== 'completed' || raw.error != null || raw.incomplete_details != null || !Array.isArray(raw.output)) throw new Error();
    const messages = raw.output.filter(o => o?.type === 'message');
    if (messages.length !== 1 || raw.output.some(o => !o || !['message', 'reasoning'].includes(o.type))) throw new Error();
    const message = messages[0], content = message.content;
    if (message.role !== 'assistant' || message.status !== 'completed' || !Array.isArray(content) || content.length !== 1
      || content[0]?.type !== 'output_text' || typeof content[0].text !== 'string'
      || Buffer.byteLength(content[0].text) > 4096 || !Array.isArray(content[0].annotations) || content[0].annotations.length) throw new Error();
    const selection = curateSelection(normalizeCoachingSlotSelection(JSON.parse(content[0].text)), evidence);
    result = await validateResultForEvidence({ providerResponseId: raw.id, selection,
      response: renderSelection(selection, evidence) }, evidence);
  } catch { /* Keep measured expense, but never count unusable output as success. */ }
  return { result, measured: safeMeasured, chargedUnits };
}
module.exports = { createOpenAIGenerator, decodeOpenAIResponse, validateResultForEvidence };
