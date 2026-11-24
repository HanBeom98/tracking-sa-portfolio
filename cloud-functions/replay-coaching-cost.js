const { createHash } = require('node:crypto');
const fail = (code, status = 503) => { throw Object.assign(new Error(code), { code, status }); };
const ACCOUNTING = 'usd_micro_v1';
// Standard, uncached text only; no tools, cache writes, regional uplift or fallback.
// Explicit-only caching WITHOUT breakpoints is part of this price contract.
const POLICY = Object.freeze({ rateVersion: 'openai-standard-2026-10-25-luna-v1', model: 'gpt-6-luna',
  maxInputTokens: 6000, maxOutputTokens: 2000, maxRequestMicros: 1600,
  maxUserMicros: 185185, maxGlobalMicros: 4629629, dailySuccess: 5, dailyAttempts: 10, quoteTtlMs: 30000 });
// Keep historical entries when a new rate is reviewed. Old reservations and
// receipts must remain readable/settle at their pinned rate, never reset to zero.
const RATES = Object.freeze({ 'openai-standard-2026-10-25-luna-v1': Object.freeze({ model: 'gpt-6-luna',
  inputMicrosPerMillion: 100000, outputMicrosPerMillion: 500000, maxInputTokens: 6000, maxOutputTokens: 2000 }) });
const uint = n => Number.isSafeInteger(n) && n >= 0;
const requestHash = request => createHash('sha256').update(JSON.stringify(request)).digest('hex');
function validateRequestPolicy(request) {
  const keys = (value, names) => value && Object.keys(value).length === names.length && names.every(name => Object.hasOwn(value, name));
  if (!keys(request, ['model', 'instructions', 'input', 'text', 'reasoning', 'max_output_tokens', 'service_tier', 'prompt_cache_options', 'store', 'stream', 'truncation'])
    || request.model !== POLICY.model || request.max_output_tokens !== POLICY.maxOutputTokens || request.service_tier !== 'default'
    || request.store !== false || request.stream !== false || request.truncation !== 'disabled'
    || !keys(request.reasoning, ['effort', 'mode']) || request.reasoning.effort !== 'none' || request.reasoning.mode !== 'standard'
    || !keys(request.prompt_cache_options, ['mode']) || request.prompt_cache_options.mode !== 'explicit'
    || typeof request.instructions !== 'string' || !request.instructions
    || !Array.isArray(request.input) || request.input.length !== 1 || !keys(request.input[0], ['role', 'content'])
    || request.input[0].role !== 'user' || typeof request.input[0].content !== 'string'
    || !keys(request.text, ['format']) || !keys(request.text.format, ['type', 'name', 'strict', 'schema'])
    || request.text.format.type !== 'json_schema' || request.text.format.name !== 'replay_coaching_selection_v3'
    || request.text.format.strict !== true || !request.text.format.schema) fail('INVALID_COST_REQUEST');
  return request;
}
const costMicros = (input, output, version = POLICY.rateVersion) => {
  const rate = Object.hasOwn(RATES, version) ? RATES[version] : null;
  if (!rate || !uint(input) || input > rate.maxInputTokens || !uint(output) || output > rate.maxOutputTokens) fail('INVALID_TOKEN_USAGE');
  // Ceil once after integer rate multiplication, including sub-microdollar costs.
  return Number((BigInt(input) * BigInt(rate.inputMicrosPerMillion)
    + BigInt(output) * BigInt(rate.outputMicrosPerMillion) + 999999n) / 1000000n);
};
function makeCostQuote(inputTokens, request, now) {
  validateRequestPolicy(request);
  if (!uint(inputTokens) || inputTokens === 0 || !uint(now)) fail('TOKEN_COUNT_UNAVAILABLE');
  if (inputTokens > POLICY.maxInputTokens) fail('INPUT_TOKEN_LIMIT', 422);
  return Object.freeze({ rateVersion: POLICY.rateVersion, model: POLICY.model,
    inputTokens, maxOutputTokens: POLICY.maxOutputTokens, maxCostMicros: costMicros(inputTokens, POLICY.maxOutputTokens),
    requestHash: requestHash(request), countedAt: now });
}
function validateCostQuote(q, now) {
  const rate = q && Object.hasOwn(RATES, q.rateVersion) ? RATES[q.rateVersion] : null;
  if (!rate || Object.keys(q).length !== 7 || q.model !== rate.model
    || !uint(q.inputTokens) || q.inputTokens < 1 || q.inputTokens > rate.maxInputTokens
    || q.maxOutputTokens !== rate.maxOutputTokens || q.maxCostMicros !== costMicros(q.inputTokens, q.maxOutputTokens, q.rateVersion)
    || !/^[a-f0-9]{64}$/.test(q.requestHash) || !uint(q.countedAt)) fail('INVALID_COST_QUOTE');
  if (now !== undefined && (!uint(now) || now < q.countedAt || now - q.countedAt >= POLICY.quoteTtlMs)) fail('COST_QUOTE_EXPIRED');
  return q;
}
const sameCostQuote = (a, b) => a && b && ['rateVersion', 'model', 'inputTokens', 'maxOutputTokens', 'maxCostMicros', 'requestHash', 'countedAt']
  .every(key => a[key] === b[key]);
function usageCost(q, measured) {
  validateCostQuote(q);
  const usage = measured?.usage;
  if (measured?.model !== q.model || measured?.serviceTier !== 'default' || !usage
    || !uint(usage.input_tokens) || usage.input_tokens !== q.inputTokens || !uint(usage.output_tokens)
    || usage.output_tokens > q.maxOutputTokens || usage.total_tokens !== usage.input_tokens + usage.output_tokens
    || !usage.input_tokens_details || usage.input_tokens_details.cached_tokens !== 0
    || usage.input_tokens_details.cache_write_tokens !== 0) fail('INVALID_TOKEN_USAGE');
  return costMicros(usage.input_tokens, usage.output_tokens, q.rateVersion);
}
function validateControl(data, period) {
  if (!data || data.schemaVersion !== 1 || data.enabled !== true || data.period !== period
    || data.rateVersion !== POLICY.rateVersion || !uint(data.allocatedMicros)
    || data.allocatedMicros === 0 || data.allocatedMicros > POLICY.maxGlobalMicros) fail('COACHING_STOPPED');
  return data;
}
const controlRef = db => db.collection('_replay_coaching_months').doc(`${ACCOUNTING}_control`);
module.exports = { ACCOUNTING, POLICY, RATES, uint, requestHash, validateRequestPolicy, costMicros, makeCostQuote, validateCostQuote, sameCostQuote, usageCost, validateControl, controlRef };
