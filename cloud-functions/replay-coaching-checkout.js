const { fail } = require('./replay-coaching-credits.js');
const { createCreditOrderManager } = require('./replay-coaching-credit-orders.js');
const { createTossPayBindingStore } = require('./replay-coaching-tosspay-store.js');
const { createTossPayCreditVerifiers } = require('./replay-coaching-tosspay-verifiers.js');
const configured = (provider, productDesc) => provider?.mode === 'LIVE'
  && ['createPayment', 'inspectPayment', 'approvePayment'].every(k => typeof provider[k] === 'function')
  && typeof productDesc === 'string' && productDesc.trim().length > 0 && productDesc.length <= 255 && !/[\\"\x00-\x1f]/.test(productDesc);
const check = value => { if (!value) fail('CHECKOUT_PAYMENT_UNCONFIRMED', 409); };
function checkedStatus(p, b) {
  check(p && p.mode === 'LIVE' && p.orderNo === b.orderNo && p.payToken === b.payToken && p.amountKRW === b.amountKRW
    && typeof p.payStatus === 'string' && Number.isSafeInteger(p.refundableAmount) && p.refundableAmount >= 0 && p.refundableAmount <= b.amountKRW
    && Array.isArray(p.transactions) && p.transactions.length <= 256);
  check(p.transactions.every(t => t && ['PAY', 'REFUND'].includes(t.kind) && typeof t.reference === 'string'
    && /^[A-Za-z0-9:_-]{1,100}$/.test(t.reference) && Number.isSafeInteger(t.amountKRW)
    && Math.abs(t.amountKRW) <= b.amountKRW && (t.kind === 'PAY' ? t.amountKRW > 0 : t.amountKRW < 0))
    && new Set(p.transactions.map(t => t.reference)).size === p.transactions.length);
  const pays = p.transactions.filter(t => t.kind === 'PAY');
  check(pays.length <= 1 && pays.every(t => t.amountKRW === b.amountKRW));
  return p;
}

// Trusted server orchestration only; disabled by default. Provider is injected,
// explicitly LIVE and never auto-created from keys or the TEST adapter. Every
// provider call is outside a transaction; unknown writes are never re-sent.
function createReplayCheckout({ db, enabled = false, provider, productDesc, now = Date.now } = {}) {
  const gate = () => {
    if (enabled !== true) fail('CHECKOUT_DISABLED');
    if (!db || !configured(provider, productDesc)) fail('CHECKOUT_NOT_CONFIGURED');
  };
  const manager = createCreditOrderManager({ db, enabled, now });
  const store = createTossPayBindingStore({ db, enabled, mode: 'LIVE', now });
  const uncertain = async (uid, orderId) => {
    // Dispatch/approval claims already fence duplicate writes even if these
    // best-effort status updates fail. Keep the capacity hold in either case.
    await Promise.allSettled([manager.markCheckoutUncertain(uid, orderId), store.markPaymentUncertain(uid, orderId)]);
  };
  const handoff = b => ({ outcome: 'checkout_ready', checkoutPage: b.checkoutPage });
  return {
    async start(uid, orderId) {
      gate(); const initial = await manager.readOrder(uid, orderId);
      if (initial.status === 'paid') return { outcome: 'already_funded' };
      const order = await manager.inspectCheckout(uid, orderId);
      const saved = await store.saveOrder(uid, orderId, order);
      const existing = await store.readCheckout(uid, orderId);
      if (existing?.stage === 'ready') return handoff(existing);
      if (order.checkout.state !== 'reserved' || saved.stage !== 'prepared') fail('CHECKOUT_UNRESOLVED', 409);
      await manager.beginCheckout(uid, orderId);
      // A crash after either claim blocks a new create. Never infer from a
      // timeout or a missing token that the provider did not create a payment.
      try {
        const expected = await store.markPaymentDispatched(uid, orderId);
        const created = await provider.createPayment({ ...expected, productDesc });
        await store.attachPayment(uid, orderId, created);
        return handoff(await store.readCheckout(uid, orderId));
      } catch {
        await uncertain(uid, orderId); fail('CHECKOUT_UNRESOLVED', 409);
      }
    },
    async complete(uid, orderId) {
      gate(); const initial = await manager.readOrder(uid, orderId);
      // The authoritative paid ledger survives refunds. Never re-grant a paid
      // order, even if a browser repeats completion after a full refund.
      if (initial.status === 'paid') return { outcome: 'already_funded' };
      await manager.inspectCheckout(uid, orderId);
      let binding;
      try { binding = await store.loadBinding(uid, orderId); } catch { fail('CHECKOUT_UNRESOLVED', 409); }
      if (!binding) fail('CHECKOUT_UNRESOLVED', 409);
      const expected = { orderNo: binding.orderNo, payToken: binding.payToken, amountKRW: binding.amountKRW };
      let payment;
      try { payment = checkedStatus(await provider.inspectPayment(expected), binding); }
      catch { fail('CHECKOUT_PAYMENT_UNCONFIRMED', 409); }
      if (payment.payStatus === 'PAY_STANDBY') return { outcome: 'awaiting_buyer' };
      if (payment.payStatus === 'PAY_PROGRESS') return { outcome: 'payment_pending' };
      if (payment.payStatus === 'PAY_APPROVED') {
        check(payment.refundableAmount === binding.amountKRW && !payment.transactions.some(t => t.kind === 'REFUND'));
        // One durable claim before approval; a lost response can only trigger
        // status inspection on a later request, never another approval call.
        await manager.beginApproval(uid, orderId);
        try { await provider.approvePayment(expected); }
        catch { await uncertain(uid, orderId); fail('CHECKOUT_UNRESOLVED', 409); }
        // Ignore the approval response as proof. Read the trusted status again.
        try { payment = checkedStatus(await provider.inspectPayment(expected), binding); }
        catch { await uncertain(uid, orderId); fail('CHECKOUT_UNRESOLVED', 409); }
        if (payment.payStatus !== 'PAY_COMPLETE') { await uncertain(uid, orderId); fail('CHECKOUT_UNRESOLVED', 409); }
      }
      if (payment.payStatus !== 'PAY_COMPLETE') fail('CHECKOUT_PAYMENT_UNCONFIRMED', 409);
      const pays = payment.transactions.filter(t => t?.kind === 'PAY');
      check(pays.length === 1 && /^[A-Za-z0-9:_-]{1,100}$/.test(pays[0].reference));
      // Freeze this fresh server observation for this one verification. No
      // callback/body values, global cache or network requests inside TX retries.
      const observation = structuredClone(payment);
      const ports = createTossPayCreditVerifiers({ enabled: true, loadBinding: store.loadBinding,
        inspectPayment: async value => {
          check(value.orderNo === expected.orderNo && value.payToken === expected.payToken && value.amountKRW === expected.amountKRW);
          return structuredClone(observation);
        } });
      const settlement = createCreditOrderManager({ db, enabled: true, now, verifyPayment: ports.verifyPayment });
      try {
        const result = await settlement.confirmPayment(uid, orderId, `tosspay:${pays[0].reference}`);
        return { outcome: result.duplicate ? 'already_funded' : 'funded' };
      } catch {
        await uncertain(uid, orderId); fail('PAYMENT_FULFILLMENT_UNRESOLVED', 503);
      }
    },
  };
}
module.exports = { createReplayCheckout, configured };
