const { normalizeCoachingEvidence } = require('./replay-coaching-input.js');
const { MAX_SUCCESS, MAX_ATTEMPTS, validateCoachingAccess } = require('./replay-coaching-access.js');
const { reserveCoachingQuota, markCoachingDispatched, finishCoachingQuota, hash } = require('./replay-coaching-quota.js');
const fail = (code, status) => { throw Object.assign(new Error(code), { code, status }); };
const ORIGIN = 'https://trackingsa.com';
let modules;
async function loadSharedModules() {
  modules ||= Promise.all([import('./replay-coaching-shared/preview.mjs'), import('./replay-coaching-shared/response.mjs')]);
  const [preview, response] = await modules;
  return { generate: preview.createMockReplayCoachingResponse, validate: response.validateReplayCoachingResponse };
}
function readConfig(env) {
  const integer = (key, max) => {
    const text = env[key];
    if (!/^[1-9][0-9]*$/.test(text || '') || Number(text) > max) fail('COACHING_NOT_CONFIGURED', 503);
    return Number(text);
  };
  const allowedUids = String(env.REPLAY_COACHING_TEST_UIDS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!allowedUids.length || allowedUids.length > 5 || allowedUids.some(s => s.length > 128)) fail('COACHING_NOT_CONFIGURED', 503);
  const timestamp = key => {
    const value = env[key], parsed = Date.parse(value);
    if (!Number.isSafeInteger(parsed) || new Date(parsed).toISOString() !== value) fail('COACHING_NOT_CONFIGURED', 503);
    return parsed;
  };
  let access;
  try { access = validateCoachingAccess({ id: env.REPLAY_COACHING_TEST_PERIOD_ID,
    startsAt: timestamp('REPLAY_COACHING_TEST_PERIOD_START'), endsAt: timestamp('REPLAY_COACHING_TEST_PERIOD_END'),
    successLimit: integer('REPLAY_COACHING_USER_LIMIT', MAX_SUCCESS), attemptLimit: integer('REPLAY_COACHING_ATTEMPT_LIMIT', MAX_ATTEMPTS) }); }
  catch { fail('COACHING_NOT_CONFIGURED', 503); }
  return { allowedUids, limits: {
    access, globalMonthly: integer('REPLAY_COACHING_GLOBAL_MONTHLY', 10000),
    globalUnits: integer('REPLAY_COACHING_GLOBAL_UNITS', 1e9), unitsPerRequest: integer('REPLAY_COACHING_UNITS_PER_REQUEST', 1e6),
  } };
}

function createReplayCoachingHandler({ db, verifyToken, getEnv = () => process.env, now = Date.now, loadModules = loadSharedModules } = {}) {
  return async (req, res) => {
    res.set('Cache-Control', 'no-store'); res.set('Vary', 'Origin');
    if (req.headers.origin && req.headers.origin !== ORIGIN) return res.status(403).json({ error: 'ORIGIN_NOT_ALLOWED' });
    res.set('Access-Control-Allow-Origin', ORIGIN);
    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Allow-Methods', 'POST'); res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      return res.status(204).send('');
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
    const env = getEnv();
    // No production-model mode exists, even if an API key is accidentally present.
    if (env.REPLAY_COACHING_MODE !== 'mock') return res.status(503).json({ error: 'COACHING_DISABLED' });
    try {
      const config = readConfig(env);
      const token = String(req.headers.authorization || '').match(/^Bearer ([^\s]+)$/i)?.[1];
      if (!token) fail('UNAUTHENTICATED', 401);
      let identity;
      try { identity = await verifyToken(token); } catch { fail('UNAUTHENTICATED', 401); }
      if (typeof identity?.uid !== 'string' || !config.allowedUids.includes(identity.uid)) fail('TEST_ACCOUNT_REQUIRED', 403);
      if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) fail('JSON_REQUIRED', 415);
      if (!Buffer.isBuffer(req.rawBody) || req.rawBody.length > 12288) fail('BODY_TOO_LARGE', 413);
      let body;
      try { body = JSON.parse(req.rawBody.toString('utf8')); } catch { fail('INVALID_JSON', 400); }
      if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length !== 2
        || !Object.hasOwn(body, 'evidence') || typeof body.requestId !== 'string') fail('INVALID_REQUEST', 400);
      const evidence = normalizeCoachingEvidence(body.evidence);
      if (!evidence.metrics) fail('INSUFFICIENT_EVIDENCE', 422);
      const { generate, validate } = await loadModules();
      const reservation = await reserveCoachingQuota(db, identity.uid, body.requestId, hash(JSON.stringify(evidence)), config.limits, now());
      if (reservation.duplicate) return res.status(200).json({ mode: 'mock', outcome: 'already_completed', requestId: body.requestId, used: reservation.used });
      if (!await markCoachingDispatched(db, reservation, now())) fail('ACCESS_EXPIRED', 403);
      let generated;
      try { generated = await generate(evidence); }
      catch {
        // Only local mock generation runs here: no provider charge to reconcile.
        await finishCoachingQuota(db, reservation, { customerSuccess: false, chargedUnits: 0 });
        return res.status(502).json({ error: 'MOCK_RESPONSE_FAILED' });
      }
      let response;
      try { response = validate(generated, evidence); }
      catch {
        // Simulate an incurred generation cost even when the returned text is
        // unusable. Restoring customer usage must not erase that expense.
        await finishCoachingQuota(db, reservation, { customerSuccess: false, chargedUnits: reservation.active.units });
        return res.status(502).json({ error: 'MOCK_RESPONSE_FAILED' });
      }
      // An ambiguous storage failure must not release a possibly committed usage.
      // This is a simulated cost, not measured provider usage or a currency.
      const used = await finishCoachingQuota(db, reservation, { customerSuccess: true, chargedUnits: reservation.active.units });
      return res.status(200).json({ mode: 'mock', outcome: 'completed', requestId: body.requestId, used, response });
    } catch (error) {
      return res.status(error.status || 503).json({ error: error.status ? error.code : 'COACHING_UNAVAILABLE' });
    }
  };
}
module.exports = { createReplayCoachingHandler, readConfig, loadSharedModules };
