const { prepareCoachingBudget, authorizeCoachingDispatch } = require('./replay-coaching-preflight.js');
const { finishCoachingQuota } = require('./replay-coaching-quota.js');
const { decodeOpenAIResponse, validateResultForEvidence } = require('./replay-coaching-openai.js');
const fail = code => { throw Object.assign(new Error(code), { code, status: 503 }); };

// Internal preparation only. No HTTP export, deployment wiring, credential or
// entitlement lookup. Both dependencies and funded control must be explicit.
async function runCostedCoaching({ generate, includeResult = false, ...options } = {}) {
  if (typeof generate !== 'function') fail('PROVIDER_DISABLED');
  if (typeof includeResult !== 'boolean') fail('COACHING_NOT_CONFIGURED');
  const prepared = await prepareCoachingBudget(options);
  if (prepared.reservation.duplicate) {
    if (!prepared.reservation.result) fail('COACHING_RESULT_UNAVAILABLE');
    const result = await validateResultForEvidence(prepared.reservation.result, prepared.evidence);
    return { outcome: 'already_completed', used: prepared.reservation.used, response: result.response,
      ...(includeResult ? { result } : {}) };
  }
  const request = await authorizeCoachingDispatch(options.db, prepared, options.now ? options.now() : Date.now());
  // Do not release reservation after network/body/usage/acknowledgement errors:
  // work may have run. No retry; explicit fenced recovery remains required.
  let raw;
  try { raw = await generate(request, prepared.quote); }
  catch { fail('PROVIDER_OUTCOME_UNCONFIRMED'); }
  const decoded = await decodeOpenAIResponse(raw, prepared.quote, prepared.evidence);
  let used;
  try {
    used = await finishCoachingQuota(options.db, prepared.reservation, { customerSuccess: Boolean(decoded.result),
      chargedUnits: decoded.chargedUnits, measured: decoded.measured, result: decoded.result || undefined });
  } catch { fail('COACHING_SETTLEMENT_UNCONFIRMED'); }
  if (!decoded.result) fail('COACHING_OUTPUT_UNUSABLE');
  return { outcome: 'completed', used, response: decoded.result.response,
    ...(includeResult ? { result: decoded.result } : {}) };
}
module.exports = { runCostedCoaching };
