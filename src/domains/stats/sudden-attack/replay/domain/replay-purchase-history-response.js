import { validateAcknowledgementIdentity } from './replay-purchase-acknowledgement.js';
const exact = (v, keys) => v && typeof v === 'object' && !Array.isArray(v)
  && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const check = v => { if (!v) throw Error('INVALID_PURCHASE_HISTORY'); };
const uint = n => Number.isSafeInteger(n) && n >= 0;
const time = n => uint(n) && Number.isFinite(new Date(n).getTime());
const id = v => typeof v === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(v);
const counters = ['remaining', 'expired', 'held', 'used', 'refundHeld', 'refunded'];
const total = v => counters.reduce((sum, k) => sum + v[k], 0);
const newer = (a, b) => a.createdAt > b.createdAt || a.createdAt === b.createdAt && a.orderId > b.orderId;
export function validatePurchaseHistory(body) {
  check(exact(body, ['asOf', 'account', 'orders', 'nextCursor']) && time(body.asOf));
  const a = body.account;
  check(exact(a, ['status', 'purchased', ...counters]) && ['active', 'blocked'].includes(a.status)
    && uint(a.purchased) && counters.every(k => uint(a[k])) && a.held <= 1
    && Number.isSafeInteger(total(a)) && total(a) === a.purchased);
  check(Array.isArray(body.orders) && body.orders.length <= 10);
  for (const [i, o] of body.orders.entries()) {
    const relative = o && Object.hasOwn(o, 'validDays');
    check(exact(o, ['orderId', 'quantity', 'amountKRW', 'currency', 'termsVersion', 'createdAt', 'paidAt', 'expiresAt',
      ...(relative ? ['validDays'] : []), 'status', 'checkoutState', ...counters,
      ...(o && Object.hasOwn(o, 'acknowledgement') ? ['acknowledgement'] : [])]));
    if (Object.hasOwn(o, 'acknowledgement')) {
      check(exact(o.acknowledgement, ['purpose', 'version', 'digest', 'acceptedAt']));
      validateAcknowledgementIdentity(o.acknowledgement, o.createdAt);
    }
    check(id(o.orderId) && uint(o.quantity) && o.quantity >= 1 && o.quantity <= 50
      && uint(o.amountKRW) && o.amountKRW > 0 && o.amountKRW <= 9999999999 && o.amountKRW % o.quantity === 0
      && o.currency === 'KRW' && id(o.termsVersion) && time(o.createdAt) && o.createdAt <= body.asOf
      && (o.expiresAt === null || time(o.expiresAt) && o.expiresAt > o.createdAt)
      && counters.every(k => uint(o[k])) && o.held <= 1 && ['pending', 'paid'].includes(o.status));
    const expired = o.expiresAt !== null && body.asOf >= o.expiresAt;
    check(o.status === 'paid' ? o.checkoutState === 'funded' && time(o.paidAt) && o.paidAt >= o.createdAt && o.paidAt <= body.asOf
      && total(o) === o.quantity && (expired ? o.remaining === 0 : o.expired === 0)
      : ['reserved', 'dispatching', 'uncertain', 'closed', 'unavailable'].includes(o.checkoutState) && o.paidAt === null && total(o) === 0);
    if (relative) check(Number.isSafeInteger(o.validDays) && o.validDays >= 1 && o.validDays <= 365
      && (o.status === 'pending' ? o.expiresAt === null : time(o.paidAt + o.validDays * 86400000)
        && o.expiresAt === o.paidAt + o.validDays * 86400000));
    if (i) check(newer(body.orders[i - 1], o));
  }
  for (const key of counters) check(body.orders.reduce((sum, o) => sum + o[key], 0) <= a[key]);
  const c = body.nextCursor, last = body.orders.at(-1);
  check(c === null || body.orders.length === 10 && exact(c, ['createdAt', 'orderId'])
    && c.createdAt === last.createdAt && c.orderId === last.orderId);
  return structuredClone(body);
}
