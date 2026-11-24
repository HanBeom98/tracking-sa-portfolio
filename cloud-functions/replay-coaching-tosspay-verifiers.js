const { fail, hash, owner, id, validTime } = require('./replay-coaching-credits.js');
const check = value => { if (!value) fail('TOSSPAY_PROOF_UNCONFIRMED', 409); };
const money = n => Number.isSafeInteger(n) && n > 0 && n <= 9999999999;
const reference = v => typeof v === 'string' && /^[A-Za-z0-9:_-]{1,100}$/.test(v);

// Ports for the existing trusted credit-order manager. Bindings must come from
// a private server store, never callback bodies or browser-supplied UID/amount.
// This is NOT an endpoint or a complete checkout/refund orchestrator.
function createTossPayCreditVerifiers({ enabled = false, inspectPayment, loadBinding, loadRefundBinding } = {}) {
  const gate = () => { if (enabled !== true) fail('TOSSPAY_VERIFIER_DISABLED');
    check(typeof inspectPayment === 'function' && typeof loadBinding === 'function'); };
  async function payment(request, refund = false) {
    gate(); owner(request.uid); check(id(request.orderId) && request.currency === 'KRW' && money(request.amountKRW));
    const b = await loadBinding(request.uid, request.orderId);
    check(b && b.provider === 'tosspay' && b.mode === 'LIVE' && b.uid === request.uid && b.orderId === request.orderId
      && money(b.amountKRW) && (refund || b.amountKRW === request.amountKRW) && typeof b.orderNo === 'string' && typeof b.payToken === 'string');
    const p = await inspectPayment({ orderNo: b.orderNo, payToken: b.payToken, amountKRW: b.amountKRW });
    check(p && p.mode === 'LIVE' && p.orderNo === b.orderNo && p.payToken === b.payToken && p.amountKRW === b.amountKRW
      && Array.isArray(p.transactions) && Number.isSafeInteger(p.refundableAmount) && p.refundableAmount >= 0 && p.refundableAmount <= p.amountKRW);
    const pays = p.transactions.filter(t => t.kind === 'PAY');
    check(pays.length === 1 && pays[0].amountKRW === b.amountKRW && reference(pays[0].reference));
    return { binding: b, payment: p, paymentReference: `tosspay:${pays[0].reference}` };
  }
  return {
    async verifyPayment(request) {
      const verified = await payment(request), p = verified.payment;
      check(p.payStatus === 'PAY_COMPLETE' && p.refundableAmount === request.amountKRW
        && !p.transactions.some(t => t.kind === 'REFUND') && request.paymentReference === verified.paymentReference);
      // Only the fresh server-side status port may supply payment completion
      // time (the LIVE adapter must normalize Toss paidTs to epoch millis).
      check(!Object.hasOwn(p, 'paidAt') || validTime(p.paidAt));
      const { uid, orderId, paymentReference, amountKRW, currency } = request;
      return { uid, orderId, paymentReference, amountKRW, currency, mode: 'LIVE', status: 'settled',
        ...(Object.hasOwn(p, 'paidAt') ? { paidAt: p.paidAt } : {}) };
    },
    async verifyRefund(request) {
      gate(); check(typeof loadRefundBinding === 'function' && id(request.refundId) && reference(request.refundReference));
      const verified = await payment(request, true), p = verified.payment;
      check(['REFUND_SUCCESS', 'SETTLEMENT_REFUND_COMPLETE'].includes(p.payStatus)
        && request.paymentHash === hash(verified.paymentReference) && money(request.amountKRW));
      const r = await loadRefundBinding(request.uid, request.orderId, request.refundId);
      check(r && r.uid === request.uid && r.orderId === request.orderId && r.refundId === request.refundId
        && r.mode === 'LIVE' && r.paymentReference === verified.paymentReference && r.amountKRW === request.amountKRW
        && typeof r.refundNo === 'string' && /^[A-Za-z0-9_-]{1,36}$/.test(r.refundNo) && reference(r.transactionReference));
      const refunds = p.transactions.filter(t => t.kind === 'REFUND' && t.reference === r.transactionReference);
      check(refunds.length === 1 && refunds[0].amountKRW === -request.amountKRW && reference(refunds[0].reference)
        && (refunds[0].refundNo === undefined || refunds[0].refundNo === r.refundNo)
        && request.refundReference === `tosspay:${refunds[0].reference}`);
      return { ...request, mode: 'LIVE', status: 'settled' };
    },
  };
}
module.exports = { createTossPayCreditVerifiers };
