const { buildCoachingRequest } = require('./replay-coaching-preflight.js');
const { makeCostQuote, requestHash, sameCostQuote, validateCostQuote } = require('./replay-coaching-cost.js');
const { decodeOpenAIResponse, validateResultForEvidence } = require('./replay-coaching-openai.js');
const { fail, hash, inspectCreditRequest, reserveCredit, markCreditDispatched, finishCredit } = require('./replay-coaching-credits.js');

async function runCreditCoaching({ db, uid, requestId, evidence: rawEvidence, config, countTokens, generate, now = Date.now }) {
  const { evidence, request } = buildCoachingRequest(rawEvidence), digest = hash(JSON.stringify(evidence));
  const existing = await inspectCreditRequest(db, uid, requestId, digest, now(), config);
  if (existing) return { outcome: 'already_completed', credits: existing.credits, result: await validateResultForEvidence(existing.result, evidence) };
  if (typeof countTokens !== 'function' || typeof generate !== 'function') fail('COACHING_NOT_CONFIGURED');
  let tokens;
  try { tokens = await countTokens(request); } catch { fail('TOKEN_COUNT_UNAVAILABLE'); }
  const quote = makeCostQuote(tokens, request, now());
  const reserved = await reserveCredit(db, uid, requestId, digest, quote, config, now());
  if (reserved.duplicate) return { outcome: 'already_completed', credits: reserved.credits, result: await validateResultForEvidence(reserved.result, evidence) };
  validateCostQuote(quote);
  if (requestHash(request) !== quote.requestHash || !sameCostQuote(quote, reserved.active.quote)) fail('INVALID_COST_QUOTE');
  if (!await markCreditDispatched(db, reserved, now())) fail('COACHING_DISPATCH_BLOCKED');
  let raw;
  try { raw = await generate(request, quote); } catch { fail('PROVIDER_OUTCOME_UNCONFIRMED'); }
  const decoded = await decodeOpenAIResponse(raw, quote, evidence);
  let settled;
  try { settled = await finishCredit(db, reserved, { customerSuccess: Boolean(decoded.result), chargedUnits: decoded.chargedUnits,
    measured: decoded.measured, result: decoded.result || undefined }, now()); }
  catch { fail('COACHING_SETTLEMENT_UNCONFIRMED'); }
  if (!decoded.result) fail('COACHING_OUTPUT_UNUSABLE', 502);
  return { outcome: 'completed', credits: settled.credits, result: decoded.result };
}
module.exports = { runCreditCoaching };
