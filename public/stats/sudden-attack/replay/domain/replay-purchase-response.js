import { validateDisclosure } from './replay-purchase-acknowledgement.js?v=6b0e8659feb1';
const exact = (v, keys) => v && typeof v === 'object' && !Array.isArray(v)
  && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const check = v => { if (!v) throw new Error('INVALID_PURCHASE_RESPONSE'); };
const time = v => Number.isSafeInteger(v) && v >= 0 && Number.isFinite(new Date(v).getTime());
const relative = v => v && Object.hasOwn(v, 'validDays');
export const purchaseOrderId = v => typeof v === 'string' && /^[A-Za-z0-9_-]{16,64}$/.test(v);
function product(v) {
  check(v && v.id === 'replay_ai_credits_v1' && Number.isSafeInteger(v.quantity) && v.quantity >= 1 && v.quantity <= 50
    && Number.isSafeInteger(v.amountKRW) && v.amountKRW > 0 && v.amountKRW <= 9999999999 && v.amountKRW % v.quantity === 0
    && v.currency === 'KRW' && typeof v.termsVersion === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(v.termsVersion)
    && (v.expiresAt === null || time(v.expiresAt))
    && (!relative(v) || Number.isSafeInteger(v.validDays) && v.validDays >= 1 && v.validDays <= 365));
}
export function validatePurchaseEnvelope(body, action, orderId) {
  if (action === 'product') {
    check(exact(body, ['product', 'paymentEnabled']) && typeof body.paymentEnabled === 'boolean'
      && exact(body.product, ['id', 'quantity', 'amountKRW', 'currency', 'termsVersion', 'expiresAt', 'disclosure', ...(relative(body.product) ? ['validDays'] : [])]));
    validateDisclosure(body.product.disclosure);
    check(!relative(body.product) || body.product.expiresAt === null);
    product(body.product); return structuredClone(body);
  }
  check(body && exact(body.order, ['orderId', 'product', 'quantity', 'amountKRW', 'currency', 'termsVersion', 'expiresAt', 'createdAt', 'status', 'checkoutState', 'paymentEnabled',
    ...(relative(body.order) ? ['validDays', 'paidAt'] : []), ...(body.order && Object.hasOwn(body.order, 'acknowledgement') ? ['acknowledgement'] : [])]));
  const o = body.order;
  if (Object.hasOwn(o, 'acknowledgement')) validateDisclosure(o.acknowledgement, true, o.createdAt);
  product({ ...o, id: o.product });
  check(purchaseOrderId(o.orderId) && o.orderId === orderId && time(o.createdAt) && (o.expiresAt === null || o.expiresAt > o.createdAt)
    && typeof o.paymentEnabled === 'boolean' && ['pending', 'paid'].includes(o.status)
    && (o.status === 'paid' ? o.checkoutState === 'funded' : ['reserved', 'dispatching', 'uncertain', 'closed', 'unavailable'].includes(o.checkoutState)));
  if (relative(o)) check(o.status === 'pending' ? o.paidAt === null && o.expiresAt === null
    : time(o.paidAt) && o.paidAt >= o.createdAt && time(o.paidAt + o.validDays * 86400000)
      && o.expiresAt === o.paidAt + o.validDays * 86400000);
  if (['create', 'cancel'].includes(action)) check(exact(body, ['order', 'duplicate']) && typeof body.duplicate === 'boolean');
  else if (action === 'get') check(exact(body, ['order']));
  else if (action === 'checkout' && body.outcome === 'checkout_ready') {
    check(exact(body, ['order', 'outcome', 'checkoutPage']) && o.status === 'pending' && ['dispatching', 'uncertain'].includes(o.checkoutState) && o.paymentEnabled);
    let u; try { u = new URL(body.checkoutPage); } catch { check(false); }
    check(typeof body.checkoutPage === 'string' && body.checkoutPage.length <= 255 && u.origin === 'https://pay.toss.im'
      && !u.username && !u.password && !u.hash && u.pathname.startsWith('/payfront/')
      && u.searchParams.getAll('payToken').length === 1 && /^[\x21-\x7e]{1,30}$/.test(u.searchParams.get('payToken') || ''));
  } else {
    check(['checkout', 'complete'].includes(action) && exact(body, ['order', 'outcome']));
    check(['funded', 'already_funded'].includes(body.outcome) ? o.status === 'paid'
      && (action === 'complete' || body.outcome === 'already_funded')
      : action === 'complete' && ['awaiting_buyer', 'payment_pending'].includes(body.outcome)
        && o.status === 'pending' && ['dispatching', 'uncertain'].includes(o.checkoutState));
  }
  return structuredClone(body);
}
