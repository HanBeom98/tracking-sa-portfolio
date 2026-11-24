import local from './playwright.ci.config.js';
export default { ...local, testMatch: ['replay-review.spec.js', 'replay-review-api.spec.js', 'replay-purchase.spec.js', 'replay-merchant-test.spec.js'] };
