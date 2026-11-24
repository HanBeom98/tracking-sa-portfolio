const { createReplayPurchaseHandler } = require('./replay-coaching-purchase-service.js');
const { saleDisclosure } = require('./replay-coaching-acknowledgement.js');
const { configured } = require('./replay-coaching-checkout.js');
const PRODUCT = Object.freeze({ id: 'replay_ai_credits_v1', quantity: 20, amountKRW: 3300, validDays: 365, termsVersion: 'sale_offer_20261027_v1' });
const DESCRIPTION = 'TrackingSA AI 리플레이 분석 20회 이용권';

// Production composition root, not an activation mechanism. The deployment
// entry supplies neither a LIVE provider nor an approved sale document yet.
// TEST providers and preview acknowledgements cannot cross this boundary.
function createReplayProductionPurchaseHandler({ db, verifyToken, env = {}, provider, disclosureDocument, now = Date.now } = {}) {
  let documentReady = false;
  try { documentReady = saleDisclosure(PRODUCT, disclosureDocument).purpose === 'sale'; } catch {}
  const enabled = env.REPLAY_PURCHASE_ENABLED === 'true' && env.REPLAY_MERCHANT_APPROVED === 'true'
    && documentReady && configured(provider, DESCRIPTION) && typeof verifyToken === 'function';
  const accepting = enabled && env.REPLAY_SALES_ENABLED === 'true';
  const authenticate = async token => {
    const identity = await verifyToken(token);
    if (!identity?.firebase?.sign_in_provider || identity.firebase.sign_in_provider === 'anonymous') throw Error('UNAUTHENTICATED');
    return identity;
  };
  const handler = createReplayPurchaseHandler({ db, verifyToken: authenticate, enabled, product: PRODUCT,
    provider, productDesc: DESCRIPTION, disclosureDocument, requireSaleAcknowledgement: true, checkoutEnabled: enabled, now });
  return async (req, res) => {
    // Pausing new sales still permits a previously started, owned payment to
    // settle and be fulfilled. Product discovery then disables new purchases.
    if (enabled && !accepting && Buffer.isBuffer(req.rawBody) && req.rawBody.length <= 2048) {
      let action; try { action = JSON.parse(req.rawBody.toString('utf8'))?.action; } catch {}
      if (['create', 'checkout'].includes(action)) { res.set('Cache-Control', 'no-store'); return res.status(503).json({ error: 'CREDIT_PURCHASE_DISABLED' }); }
    }
    const target = Object.create(res);
    target.json = value => res.json(value?.product && !accepting ? { ...value, paymentEnabled: false } : value);
    // The underlying response methods may return res; keep status chaining on
    // this wrapper so the product-only sales pause cannot be skipped.
    target.status = code => { res.status(code); return target; };
    target.set = (name, value) => { res.set(name, value); return target; };
    target.send = value => res.send(value);
    return handler(req, target);
  };
}
module.exports = { createReplayProductionPurchaseHandler, PRODUCT, DESCRIPTION };
