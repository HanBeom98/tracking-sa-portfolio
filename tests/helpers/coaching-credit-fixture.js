import credits from '../../cloud-functions/replay-coaching-credits.js';
import cost from '../../cloud-functions/replay-coaching-cost.js';
import catalog from '../../cloud-functions/replay-coaching-review-catalog.js';
import { coachingMemoryDb } from './coaching-memory-db.js';
import { analyzeReplay } from '../../src/domains/stats/sudden-attack/replay/domain/replay-analyzer.js';
import { buildReplayCoachingReview } from '../../src/domains/stats/sudden-attack/replay/domain/replay-coaching-review.js';
import { contextFixture } from '../fixtures/replay-context.js';
import { openAIEnvelope } from './coaching-openai-fixture.js';

// Synthetic already-verified payment records for offline tests only.
// Production must use the gated order manager and a trusted verification port.
export function creditFixtureEntries(uid, { quantity = 2, now = Date.parse('2026-10-26T00:00:00Z'), expiresAt = null, orderId = 'fixture_order' } = {}) {
  const wallet = credits.emptyWallet(uid), paymentHash = credits.hash(`fixture_payment_${uid}_${orderId}`);
  wallet.purchased = quantity; wallet.available = quantity;
  wallet.lots = [{ orderId, remaining: quantity, held: 0, refundHeld: 0, expiresAt }];
  const order = { schemaVersion: 1, ownerHash: credits.owner(uid), orderId, product: credits.PRODUCT,
    quantity, amountKRW: quantity * 66, termsVersion: 'test_terms_only', expiresAt,
    createdAt: now - 1000, status: 'paid', paymentHash, paidAt: now - 500,
    remaining: quantity, held: 0, used: 0, refundHeld: 0, refunded: 0 };
  const fake = { collection: name => ({ doc: id => ({ path: `${name}/${id}` }) }) };
  return [[`users/${uid}`, { uid, subscription: { status: 'free' } }], [credits.walletRef(fake, uid).path, wallet], [credits.orderRef(fake, uid, orderId).path, order]];
}
export function seedCreditFixture(db, uid, options) {
  for (const [path, value] of creditFixtureEntries(uid, options)) db.data.set(path, value);
}

export function creditRuntime({ quantity = 2, expiresAt = null } = {}) {
  const db = coachingMemoryDb(), clock = { value: Date.parse('2026-10-26T00:00:00Z') }, calls = { tokens: 0, generate: 0, auth: 0 };
  for (const uid of ['alice', 'bob']) seedCreditFixture(db, uid, { quantity, expiresAt });
  db.data.set(cost.controlRef(db).path, { schemaVersion: 1, enabled: true, period: '202610', allocatedMicros: 100000, rateVersion: cost.POLICY.rateVersion });
  const evidence = buildReplayCoachingReview(analyzeReplay(contextFixture(), 'focus'));
  const f = catalog.createReviewCatalog(evidence).facts[0], selection = { schemaVersion: 2, cards: [{ kind: 'practice', factId: f.id, questionId: f.questions[0], practiceId: f.practices[0] }] };
  const options = { db, enabled: true, now: () => clock.value, config: { userMicros: cost.POLICY.maxUserMicros, globalMonthly: 100 },
    verifyToken: async token => { calls.auth++; if (!['alice', 'bob'].includes(token)) throw Error('private'); return { uid: token }; },
    countTokens: async () => { calls.tokens++; return 1000; }, generate: async (_request, quote) => { calls.generate++; return openAIEnvelope(quote, selection); } };
  return { db, clock, calls, options, evidence, wallet: (uid = 'alice') => db.data.get(credits.walletRef(db, uid).path),
    global: () => db.data.get('_replay_coaching_months/usd_micro_v1_202610') };
}
