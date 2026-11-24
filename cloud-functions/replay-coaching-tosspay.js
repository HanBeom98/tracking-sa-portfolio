const { fail } = require('./replay-coaching-credits.js');
const API = 'https://pay.toss.im/api/v2/';
const MAX_BYTES = 65536;
const integer = (v, min = 0) => Number.isSafeInteger(v) && v >= min && v <= 9999999999;
const text = (v, max) => typeof v === 'string' && v.length > 0 && v.length <= max && /^[\x21-\x7e]+$/.test(v);
const orderNo = v => typeof v === 'string' && /^[\w\-:.^@]{1,50}$/.test(v);
const refundNo = v => typeof v === 'string' && /^[A-Za-z0-9_-]{1,36}$/.test(v);
const requireValue = (value, code = 'TOSSPAY_INVALID_REQUEST') => { if (!value) fail(code, 409); };
function url(value, { callback = false } = {}) {
  let u; try { u = new URL(value); } catch { fail('TOSSPAY_INVALID_URL', 400); }
  requireValue(value.length <= (callback ? 500 : 255) && !u.username && !u.password && !u.hash
    && (u.protocol === 'https:' || !callback && u.origin === 'http://127.0.0.1:4173'), 'TOSSPAY_INVALID_URL');
  if (callback) requireValue(!['localhost', '127.0.0.1', '[::1]'].includes(u.hostname)
    && !/^\d+\.\d+\.\d+\.\d+$/.test(u.hostname), 'TOSSPAY_INVALID_URL');
  return u.href;
}
function expectation(value) {
  requireValue(value && orderNo(value.orderNo) && integer(value.amountKRW, 1)
    && (value.payToken === undefined || text(value.payToken, 30)));
  return { orderNo: value.orderNo, amountKRW: value.amountKRW, ...(value.payToken ? { payToken: value.payToken } : {}) };
}
function normalizeStatus(body, expected) {
  requireValue(body.mode === 'TEST', 'TOSSPAY_MODE_MISMATCH');
  requireValue(body.orderNo === expected.orderNo && (body.amount === expected.amountKRW || body.payStatus === 'PAY_CANCEL' && body.amount === 0) && text(body.payToken, 30)
    && (!expected.payToken || body.payToken === expected.payToken), 'TOSSPAY_PAYMENT_MISMATCH');
  requireValue(typeof body.payStatus === 'string' && /^[A-Z_]{1,40}$/.test(body.payStatus)
    && integer(body.refundableAmount) && body.refundableAmount <= body.amount, 'TOSSPAY_INVALID_RESPONSE');
  const txs = body.transactions;
  requireValue(Array.isArray(txs) && txs.length <= 256, 'TOSSPAY_INVALID_RESPONSE');
  // Toss returns amount:0 for expired pre-payment orders. This is terminal
  // cancellation evidence only, never a successful payment or fulfillment.
  requireValue(body.payStatus !== 'PAY_CANCEL' || body.refundableAmount === 0 && txs.length === 0, 'TOSSPAY_INVALID_RESPONSE');
  const transactions = txs.filter(t => t?.stepType !== 'FEE').map(t => {
    requireValue(t && ['PAY', 'REFUND'].includes(t.stepType) && text(t.transactionId, 36)
      && Number.isSafeInteger(t.transactionAmount) && Math.abs(t.transactionAmount) <= body.amount
      && (t.stepType === 'PAY' ? t.transactionAmount > 0 : t.transactionAmount < 0 && (t.refundNo === undefined || refundNo(t.refundNo))), 'TOSSPAY_INVALID_RESPONSE');
    return { kind: t.stepType, reference: t.transactionId, amountKRW: t.transactionAmount,
      ...(t.stepType === 'REFUND' && t.refundNo !== undefined ? { refundNo: t.refundNo } : {}) };
  });
  requireValue(new Set(transactions.map(t => t.reference)).size === transactions.length
    && new Set(transactions.filter(t => t.refundNo !== undefined).map(t => t.refundNo)).size === transactions.filter(t => t.refundNo !== undefined).length,
  'TOSSPAY_INVALID_RESPONSE');
  return { mode: 'TEST', orderNo: body.orderNo, payToken: body.payToken, amountKRW: body.amount,
    payStatus: body.payStatus, refundableAmount: body.refundableAmount, transactions,
    simpleTax: body.amountTaxFree === 0 && body.amountServiceFee === 0 && body.disposableCupDeposit === 0 };
}

// Server-only, disabled by default and TEST keys only. No SDK, environment key
// loading, callback trust, retries, polling, Firebase access or live activation.
function createTossPayTestClient({ enabled = false, apiKey, fetchImpl = globalThis.fetch, timeoutMs = 10000,
  retUrl, retCancelUrl, resultCallback } = {}) {
  const gate = () => {
    if (enabled !== true) fail('TOSSPAY_DISABLED');
    requireValue(typeof apiKey === 'string' && /^sk_test_[A-Za-z0-9]{8,22}$/.test(apiKey), 'TOSSPAY_TEST_KEY_REQUIRED');
    requireValue(typeof fetchImpl === 'function' && Number.isSafeInteger(timeoutMs) && timeoutMs >= 10 && timeoutMs <= 15000, 'TOSSPAY_NOT_CONFIGURED');
  };
  async function call(endpoint, payload) {
    gate(); const controller = new AbortController(); let timer;
    const expired = new Promise((_, reject) => { timer = setTimeout(() => {
      controller.abort(); reject(Object.assign(new Error('TOSSPAY_REQUEST_UNCERTAIN'), { code: 'TOSSPAY_REQUEST_UNCERTAIN' }));
    }, timeoutMs); });
    const perform = async () => {
      let response;
      try { response = await fetchImpl(API + endpoint, { method: 'POST', redirect: 'error', signal: controller.signal,
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey, ...payload }) }); }
      catch { fail('TOSSPAY_REQUEST_UNCERTAIN', 409); }
      requireValue(response && !response.redirected && response.status >= 200 && response.status < 300, 'TOSSPAY_REQUEST_UNCERTAIN');
      const declared = response.headers.get('content-length');
      requireValue(declared === null || /^\d+$/.test(declared) && Number(declared) <= MAX_BYTES, 'TOSSPAY_INVALID_RESPONSE');
      requireValue(/^application\/json(?:;|$)/i.test(response.headers.get('content-type') || '') && response.body, 'TOSSPAY_INVALID_RESPONSE');
      const chunks = []; let size = 0;
      try { for await (const chunk of response.body) {
        size += chunk.byteLength; if (size > MAX_BYTES) { controller.abort(); fail('TOSSPAY_INVALID_RESPONSE'); }
        chunks.push(chunk);
      } } catch { fail('TOSSPAY_REQUEST_UNCERTAIN', 409); }
      let body; try { body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))); }
      catch { fail('TOSSPAY_INVALID_RESPONSE', 502); }
      requireValue(body && typeof body === 'object' && !Array.isArray(body), 'TOSSPAY_INVALID_RESPONSE');
      // Provider messages may echo keys or account details. Never propagate them.
      requireValue(body.code === 0, 'TOSSPAY_REJECTED'); return body;
    };
    try { return await Promise.race([perform(), expired]); }
    finally { clearTimeout(timer); controller.abort(); }
  }
  async function inspectPayment(value) {
    gate(); const expected = expectation(value);
    return normalizeStatus(await call('status', { orderNo: expected.orderNo, ...(expected.payToken ? { payToken: expected.payToken } : {}) }), expected);
  }
  function findRefund(payment, number, amount, knownReference) {
    const entry = payment.transactions.find(t => t.kind === 'REFUND' && (t.refundNo === number || knownReference && t.reference === knownReference));
    if (!entry) return null;
    requireValue(entry.amountKRW === -amount && (entry.refundNo === undefined || entry.refundNo === number)
      && (!knownReference || entry.reference === knownReference), 'TOSSPAY_REFUND_CONFLICT');
    requireValue(['REFUND_SUCCESS', 'SETTLEMENT_REFUND_COMPLETE'].includes(payment.payStatus), 'TOSSPAY_REFUND_UNRESOLVED');
    return { mode: 'TEST', refundNo: number, amountKRW: amount, reference: entry.reference, payment };
  }
  return Object.freeze({ mode: 'TEST',
    async createPayment(value) {
      gate(); const expected = expectation(value);
      requireValue(typeof value.productDesc === 'string' && value.productDesc.trim() && value.productDesc.length <= 255
        && !/[\\"\x00-\x1f]/.test(value.productDesc));
      const body = await call('payments', { orderNo: expected.orderNo, amount: expected.amountKRW, amountTaxFree: 0,
        productDesc: value.productDesc, retUrl: url(retUrl), retCancelUrl: url(retCancelUrl), autoExecute: false,
        ...(resultCallback ? { resultCallback: url(resultCallback, { callback: true }), callbackVersion: 'V2' } : {}) });
      requireValue(text(body.payToken, 30), 'TOSSPAY_INVALID_RESPONSE');
      let checkout; try { checkout = new URL(body.checkoutPage); } catch { fail('TOSSPAY_INVALID_RESPONSE'); }
      requireValue(checkout.origin === 'https://pay.toss.im' && !checkout.username && !checkout.password && !checkout.hash
        && checkout.pathname.startsWith('/payfront/') && checkout.searchParams.getAll('payToken').length === 1
        && checkout.searchParams.get('payToken') === body.payToken, 'TOSSPAY_INVALID_RESPONSE');
      return { mode: 'TEST', orderNo: expected.orderNo, amountKRW: expected.amountKRW, payToken: body.payToken, checkoutPage: checkout.href };
    },
    inspectPayment,
    async approvePayment(value) {
      const payment = await inspectPayment(value);
      if (payment.payStatus === 'PAY_COMPLETE') return payment;
      requireValue(payment.payStatus === 'PAY_APPROVED', 'TOSSPAY_PAYMENT_NOT_APPROVABLE');
      await call('execute', { orderNo: payment.orderNo, payToken: payment.payToken });
      // An approval response or browser return alone never proves fulfillment.
      const confirmed = await inspectPayment({ ...value, payToken: payment.payToken });
      requireValue(confirmed.payStatus === 'PAY_COMPLETE', 'TOSSPAY_PAYMENT_UNRESOLVED'); return confirmed;
    },
    async refundPayment(value) {
      gate(); requireValue(refundNo(value?.refundNo) && integer(value.amountKRWToRefund, 1)
        && (value.refundReference === undefined || text(value.refundReference, 36)));
      const payment = await inspectPayment(value), amount = value.amountKRWToRefund;
      const existing = findRefund(payment, value.refundNo, amount, value.refundReference); if (existing) return existing;
      requireValue(['PAY_COMPLETE', 'REFUND_SUCCESS'].includes(payment.payStatus), 'TOSSPAY_REFUND_UNRESOLVED');
      requireValue(payment.simpleTax, 'TOSSPAY_UNSUPPORTED_TAX_POLICY');
      requireValue(payment.refundableAmount >= amount, 'TOSSPAY_REFUND_EXCEEDS_BALANCE');
      const body = await call('refunds', { payToken: payment.payToken, orderNo: payment.orderNo, refundNo: value.refundNo,
        amount, amountTaxFree: 0, idempotent: true });
      // Actual TEST responses use negative refundedAmount; the docs describe
      // the requested amount. Correlate the exact transaction, never amount alone.
      requireValue(body.refundNo === value.refundNo && body.payToken === payment.payToken
        && Number.isSafeInteger(body.refundedAmount) && Math.abs(body.refundedAmount) === amount && text(body.transactionId, 36),
        'TOSSPAY_REFUND_UNRESOLVED');
      const confirmed = await inspectPayment({ ...value, payToken: payment.payToken });
      const refund = findRefund(confirmed, value.refundNo, amount, body.transactionId);
      requireValue(refund, 'TOSSPAY_REFUND_UNRESOLVED'); return refund;
    },
  });
}
module.exports = { createTossPayTestClient };
