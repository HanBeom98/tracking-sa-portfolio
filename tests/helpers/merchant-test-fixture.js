import service from '../../cloud-functions/replay-coaching-merchant-test.js';
import core from '../../cloud-functions/replay-coaching-credits.js';
import { coachingMemoryDb } from './coaching-memory-db.js';
export const NOW = Date.parse('2026-10-26T00:00:00Z');
export const ACCESS = 'a'.repeat(64), SESSION = 'b'.repeat(64), ORDER = 'synthetic_order_01';
export const uidFor = session => `merchant_test_${core.owner(session)}`;
export function merchantFixture(options = {}) {
  const db = options.db || coachingMemoryDb(), payments = new Map(), counts = { create: 0, approve: 0, inspect: 0 };
  const provider = { mode: 'TEST', async createPayment(expected) {
    counts.create++; const payToken = `synthetic_${expected.orderNo.slice(-10)}`;
    const value = { ...expected, mode: 'TEST', payToken, payStatus: 'PAY_STANDBY', refundableAmount: 3300, transactions: [],
      checkoutPage: `https://pay.toss.im/payfront/auth?payToken=${payToken}` };
    payments.set(expected.orderNo, value); return structuredClone(value);
  }, async inspectPayment(expected) { counts.inspect++; return structuredClone(payments.get(expected.orderNo)); },
  async approvePayment(expected) { counts.approve++; const p = payments.get(expected.orderNo); p.payStatus = 'PAY_COMPLETE';
    p.transactions = [{ kind: 'PAY', reference: `tx_${p.payToken}`, amountKRW: 3300 }]; }, };
  const config = { db, enabled: true, accessKey: ACCESS, provider, now: () => NOW, ...options };
  const handler = service.createMerchantTestHandler(config);
  const call = async (action = 'create', { orderId = ORDER, session = SESSION, headers = {}, body = { action, orderId }, method = 'POST' } = {}) => {
    const req = { method, headers: { origin: 'https://trackingsa.com', authorization: `Bearer ${ACCESS}`,
      'x-review-session': session, 'content-type': 'application/json', ...headers }, rawBody: Buffer.from(JSON.stringify(body)) };
    const result = { status: 200, headers: {} }, res = { set(k, v) { result.headers[k] = v; return this; },
      status(v) { result.status = v; return this; }, json(v) { result.body = v; return this; } };
    await handler(req, res); return result;
  };
  return { db, counts, payments, provider, config, handler, call, payment: () => [...payments.values()][0] };
}
