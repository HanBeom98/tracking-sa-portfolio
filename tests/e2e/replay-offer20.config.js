import base from './playwright.ci.config.js';
export default { ...base, testMatch: ['replay-merchant-test.spec.js', 'replay-purchase.spec.js', 'replay-pass-checkout.spec.js', 'replay-production-purchase.spec.js', 'replay-guest-checkout.spec.js'] };
