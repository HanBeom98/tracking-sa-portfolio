import base from './playwright.ci.config.js';
export default {...base,testMatch:['replay-fast-start.spec.js','replay-playback.spec.js','replay-comparison.spec.js','replay-review.spec.js'],retries:0};
