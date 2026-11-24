const { normalizeReviewEvidence } = require('./replay-coaching-review-input.js');
const { readCreditResult, hash } = require('./replay-coaching-credits.js');
const { runCreditCoaching } = require('./replay-coaching-credit-runner.js');
const { buildReviewClientResult } = require('./replay-coaching-review-response.js');
const { POLICY, uint } = require('./replay-coaching-cost.js');
const ORIGIN = 'https://trackingsa.com';
const fail = (code, status) => { throw Object.assign(new Error(code), { code, status }); };
const statuses = Object.freeze({
  UNAUTHENTICATED: 401, JSON_REQUIRED: 415, BODY_TOO_LARGE: 413, INVALID_JSON: 400, INVALID_REQUEST: 400,
  INVALID_EVIDENCE: 400, INVALID_REQUEST_ID: 400, INSUFFICIENT_EVIDENCE: 422, INPUT_TOO_LARGE: 422, INPUT_TOKEN_LIMIT: 422,
  AI_CREDITS_REQUIRED: 403, CREDIT_ACCOUNT_BLOCKED: 403, CREDITS_EXHAUSTED: 429, COACHING_RESULT_NOT_FOUND: 404,
  ACCESS_PERIOD_CONFLICT: 409, IDEMPOTENCY_CONFLICT: 409, PREVIOUS_ATTEMPT_FAILED: 409, REQUEST_IN_PROGRESS: 409, REQUEST_UNRESOLVED: 409,
  USER_LIMIT: 429, ATTEMPT_LIMIT: 429, GLOBAL_LIMIT: 429, GLOBAL_BUDGET_LIMIT: 429, USER_BUDGET_LIMIT: 429,
  DAILY_USER_LIMIT: 429, DAILY_ATTEMPT_LIMIT: 429,
  CREDIT_STATE_INVALID: 503, COACHING_NOT_CONFIGURED: 503, COACHING_STOPPED: 503, QUOTA_STATE_INVALID: 503,
  TOKEN_COUNT_UNAVAILABLE: 503, COACHING_DISPATCH_BLOCKED: 503, PROVIDER_OUTCOME_UNCONFIRMED: 503,
  COACHING_SETTLEMENT_UNCONFIRMED: 503, COACHING_OUTPUT_UNUSABLE: 502, COACHING_RESULT_UNAVAILABLE: 503, COACHING_RESULT_MISMATCH: 503,
});

// Disabled by default, dependencies explicit. Existing mock endpoint is separate.
// No automatic key lookup or mode switch, payment grant writer or billing call.
function createReplayReviewHandler({ db, verifyToken, enabled = false, countTokens, generate,
  config, now = Date.now } = {}) {
  return async (req, res) => {
    res.set('Cache-Control', 'no-store'); res.set('Vary', 'Origin');
    if (req.headers.origin && req.headers.origin !== ORIGIN) return res.status(403).json({ error: 'ORIGIN_NOT_ALLOWED' });
    res.set('Access-Control-Allow-Origin', ORIGIN);
    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Allow-Methods', 'POST'); res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      return res.status(204).send('');
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
    if (enabled !== true) return res.status(503).json({ error: 'COACHING_DISABLED' });
    try {
      if (!db || typeof verifyToken !== 'function') fail('COACHING_NOT_CONFIGURED', 503);
      const token = typeof req.headers.authorization === 'string' && req.headers.authorization.match(/^Bearer ([^\s]{1,8192})$/i)?.[1];
      if (!token) fail('UNAUTHENTICATED', 401);
      let identity;
      try { identity = await verifyToken(token); } catch { fail('UNAUTHENTICATED', 401); }
      const uid = identity?.uid;
      if (typeof uid !== 'string' || !uid || uid.length > 128 || uid.includes('/')) fail('UNAUTHENTICATED', 401);
      if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) fail('JSON_REQUIRED', 415);
      if (!Buffer.isBuffer(req.rawBody) || req.rawBody.length > 24576) fail('BODY_TOO_LARGE', 413);
      let body;
      try { body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(req.rawBody)); } catch { fail('INVALID_JSON', 400); }
      if (!body || Array.isArray(body) || Object.keys(body).length !== 3
        || !['action', 'requestId', 'evidence'].every(k => Object.hasOwn(body, k))
        || !['generate', 'result'].includes(body.action) || typeof body.requestId !== 'string'
        || !/^\d{6}-[A-Za-z0-9_-]{16,64}$/.test(body.requestId)) fail('INVALID_REQUEST', 400);
      const evidence = normalizeReviewEvidence(body.evidence);
      if (!evidence.candidates.length) fail('INSUFFICIENT_EVIDENCE', 422);
      let outcome;
      if (body.action === 'result') {
        const owned = await readCreditResult(db, uid, body.requestId, hash(JSON.stringify(evidence)), now());
        if (!owned) fail('COACHING_RESULT_NOT_FOUND', 404);
        if (!owned.result) fail('COACHING_RESULT_UNAVAILABLE', 503);
        outcome = { outcome: 'already_completed', credits: owned.credits, result: owned.result };
      } else {
        if (!config || !uint(config.userMicros) || config.userMicros < 1 || config.userMicros > POLICY.maxUserMicros
          || !uint(config.globalMonthly) || config.globalMonthly < 1 || config.globalMonthly > 10000
          || typeof countTokens !== 'function' || typeof generate !== 'function') fail('COACHING_NOT_CONFIGURED', 503);
        outcome = await runCreditCoaching({ db, uid, requestId: body.requestId, evidence, config, countTokens, generate, now });
      }
      const result = await buildReviewClientResult(outcome.result, evidence);
      return res.status(200).json({ mode: 'review', requestId: body.requestId, outcome: outcome.outcome, credits: outcome.credits, result });
    } catch (error) {
      const status = Object.hasOwn(statuses, error?.code) ? statuses[error.code] : 503;
      return res.status(status).json({ error: Object.hasOwn(statuses, error?.code) ? error.code : 'COACHING_UNAVAILABLE' });
    }
  };
}
module.exports = { createReplayReviewHandler };
