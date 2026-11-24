import test from 'node:test';
import assert from 'node:assert/strict';
import { sealRecovery, openRecovery } from '../../src/domains/ai-replay-pass/recovery.js';
const code = 'a'.repeat(64), value = { orderId: 'test_order_0123456789', session: 'b'.repeat(64) }, now = 1793034000000;
test('browser TEST recovery stores ciphertext only and decrypts the exact original owner pointer', async () => {
  const raw = await sealRecovery(value, code, now);
  assert.ok(!raw.includes(value.session) && !raw.includes(value.orderId) && !raw.includes(code));
  assert.deepEqual(await openRecovery(raw, code, now + 1), value);
  assert.notEqual(raw, await sealRecovery(value, code, now));
});
test('wrong code, tampered ciphertext/deadline, expiry, oversized and unknown fields fail closed', async () => {
  const raw = await sealRecovery(value, code, now), record = JSON.parse(raw);
  await assert.rejects(openRecovery(raw, 'c'.repeat(64), now));
  for (const mutated of [{ ...record, expiresAt: record.expiresAt - 1 }, { ...record, extra: true },
    { ...record, data: (record.data[0] === 'A' ? 'B' : 'A') + record.data.slice(1) }, { ...record, iv: '' }]) await assert.rejects(openRecovery(JSON.stringify(mutated), code, now));
  await assert.rejects(openRecovery(raw, code, record.expiresAt));
  await assert.rejects(openRecovery('x'.repeat(2049), code, now));
  await assert.rejects(sealRecovery({ ...value, extra: true }, code, now));
});
