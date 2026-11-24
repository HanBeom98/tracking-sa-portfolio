const DAY_MS = 86400000;
const { hasAck, identity, sameAcknowledgement } = require('./replay-coaching-acknowledgement.js');
const hasDuration = value => Object.hasOwn(value, 'validDays');
const validDays = value => Number.isSafeInteger(value) && value >= 1 && value <= 365;
function expiryFromPayment(paidAt, days) {
  const expiry = paidAt + days * DAY_MS;
  return Number.isSafeInteger(paidAt) && paidAt >= 0 && validDays(days)
    && Number.isSafeInteger(expiry) && Number.isFinite(new Date(expiry).getTime()) ? expiry : null;
}
const terms = ['product', 'quantity', 'amountKRW', 'termsVersion', 'createdAt'];
// Relative expiry is resolved once on funding. Compare the purchased duration,
// not the derived timestamp, when recovering a concurrent/committed payment.
function sameOrderTerms(a, b) {
  return terms.every(k => a[k] === b[k]) && hasDuration(a) === hasDuration(b)
    && (hasDuration(a) ? a.validDays === b.validDays : a.expiresAt === b.expiresAt) && sameAcknowledgement(a, b);
}
function orderTerms(order) {
  return { ...Object.fromEntries(terms.map(k => [k, order[k]])),
    expiresAt: hasDuration(order) ? null : order.expiresAt,
    ...(hasDuration(order) ? { validDays: order.validDays } : {}),
    ...(hasAck(order) ? { acknowledgement: identity(order.acknowledgement) } : {}) };
}
module.exports = { DAY_MS, hasDuration, validDays, expiryFromPayment, sameOrderTerms, orderTerms };
