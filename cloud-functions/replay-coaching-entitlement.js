const { validateCoachingAccess, sameCoachingAccess } = require('./replay-coaching-access.js');
const fail = (code, status = 403) => { throw Object.assign(new Error(code), { code, status }); };
const exact = (v, keys) => v && typeof v === 'object' && !Array.isArray(v)
  && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const entitlementRef = (db, uid) => db.collection('users').doc(uid);

// Only a trusted billing/provisioning backend may write this grant. A generic
// profile subscription.status, client claim, site-admin role or support payment
// does not authorize AI. This reader does not verify a payment with a PG.
function validateReplayEntitlement(profile, uid, now, { expectedAccess, allowExpired = false } = {}) {
  const grant = profile?.subscription?.replayCoaching;
  if (profile?.uid !== uid || !exact(grant, ['schemaVersion', 'product', 'billingState', 'status', 'access'])
    || grant.schemaVersion !== 1 || grant.product !== 'replay_ai_monthly_v1' || grant.billingState !== 'paid'
    || !['active', 'cancel_at_period_end'].includes(grant.status)) fail('AI_SUBSCRIPTION_REQUIRED');
  let access;
  try { access = validateCoachingAccess(grant.access); } catch { fail('AI_SUBSCRIPTION_INVALID', 503); }
  if (!Number.isSafeInteger(now) || now < 0) fail('COACHING_NOT_CONFIGURED', 503);
  if (expectedAccess && !sameCoachingAccess(access, expectedAccess)) fail('ACCESS_PERIOD_CONFLICT', 409);
  if (now < access.startsAt) fail('ACCESS_NOT_STARTED');
  if (!allowExpired && now >= access.endsAt) fail('ACCESS_EXPIRED');
  return access;
}
async function readReplayEntitlement(db, uid, now, options) {
  return db.runTransaction(async tx => {
    const snapshot = await tx.get(entitlementRef(db, uid));
    return validateReplayEntitlement(snapshot.exists ? snapshot.data() : null, uid, now, options);
  });
}
module.exports = { entitlementRef, validateReplayEntitlement, readReplayEntitlement };
