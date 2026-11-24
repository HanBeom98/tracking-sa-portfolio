const MAX_SUCCESS = 50;
const MAX_ATTEMPTS = 70;
const DAY = 86400000;
const invalid = () => { throw Object.assign(new Error('INVALID_ACCESS_PERIOD'), { code: 'INVALID_ACCESS_PERIOD', status: 503 }); };

// Explicit monthly windows only. The minimum duration and two previous windows
// retain all receipts whose request-ID month could still be accepted as new.
function validateCoachingAccess(value) {
  if (!value || typeof value.id !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(value.id)
    || !Number.isSafeInteger(value.startsAt) || value.startsAt < 0
    || !Number.isSafeInteger(value.endsAt)
    || value.endsAt - value.startsAt < 28 * DAY || value.endsAt - value.startsAt > 32 * DAY
    || !Number.isSafeInteger(value.successLimit) || value.successLimit < 1 || value.successLimit > MAX_SUCCESS
    || !Number.isSafeInteger(value.attemptLimit) || value.attemptLimit < value.successLimit || value.attemptLimit > MAX_ATTEMPTS) invalid();
  return { id: value.id, startsAt: value.startsAt, endsAt: value.endsAt,
    successLimit: value.successLimit, attemptLimit: value.attemptLimit };
}
function sameCoachingAccess(a, b) {
  return ['id', 'startsAt', 'endsAt', 'successLimit', 'attemptLimit'].every(key => a[key] === b[key]);
}
module.exports = { MAX_SUCCESS, MAX_ATTEMPTS, validateCoachingAccess, sameCoachingAccess };
