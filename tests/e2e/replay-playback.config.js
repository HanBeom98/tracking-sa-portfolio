import base from './playwright.ci.config.js';
export default { ...base, testMatch: ['replay-playback.spec.js', 'replay-comparison.spec.js'], retries: 0 };
