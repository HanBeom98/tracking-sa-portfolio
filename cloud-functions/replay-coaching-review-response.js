const { normalizeReviewEvidence } = require('./replay-coaching-review-input.js');
const { validateResultForEvidence } = require('./replay-coaching-openai.js');
let shared;

// Internal view adapter only: no HTTP export, entitlement lookup, provider call
// or storage write. Call AFTER access/result ownership checks in a future API.
// Stored accounting/result records remain byte-for-byte in their old format.
async function buildReviewClientResult(storedResult, rawEvidence) {
  const evidence = normalizeReviewEvidence(rawEvidence);
  const result = await validateResultForEvidence(storedResult, evidence);
  shared ||= import('./replay-coaching-shared/review-response.mjs');
  const contract = await shared;
  const envelope = { schemaVersion: 1, mode: 'saved_ai',
    evidenceHash: await contract.hashReplayReviewEvidence(evidence), response: result.response };
  await contract.validateReplayReviewEnvelope(envelope, evidence);
  return envelope;
}
module.exports = { buildReviewClientResult };
