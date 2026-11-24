const invalid = () => { throw new Error('INVALID_REVIEW_RESULT'); };
const exact = (v, keys) => v && typeof v === 'object' && !Array.isArray(v)
  && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const stable = v => Array.isArray(v) ? v.map(stable) : v && typeof v === 'object'
  ? Object.fromEntries(Object.keys(v).sort().map(k => [k, stable(v[k])])) : v;
const fields = { title: 30, observation: 100, practice: 80, limitation: 60 };
export const MAX_REVIEW_RESULT_BYTES = 8192;

// Trusted analyzer output only. Server callers normalize the untrusted v2
// input first. This binds semantic evidence, not replay identity or provenance.
export function serializeReplayReviewBinding(review) {
  if (review?.schemaVersion !== 2 || review.scope !== 'selected_player_review_candidates'
    || !Array.isArray(review.candidates) || review.candidates.length > 6) invalid();
  const projected = { schemaVersion: review.schemaVersion, scope: review.scope, status: review.status,
    coverage: review.coverage, selection: review.selection, patterns: review.patterns,
    candidates: review.candidates.map(c => ({ candidateId: c.candidateId, evidenceId: c.evidenceId,
      rank: c.rank, round: c.round, side: c.side,
      basis: { primaryReason: c.basis.primaryReason, matchingVerifiedRounds: c.basis.matchingVerifiedRounds,
        matchedReasons: c.basis.matchedReasons, repeatedReasons: c.basis.repeatedReasons }, flow: c.flow })) };
  // Canonical ordering avoids browser/server property insertion-order changes.
  // Fixed explanatory prose is deliberately excluded: the server replaces it.
  return `replay_review_binding_v1\n${JSON.stringify(stable(projected))}`;
}

export async function hashReplayReviewEvidence(review) {
  const bytes = new TextEncoder().encode(serializeReplayReviewBinding(review));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// Shape and current-scene references only. Server canonical rendering remains
// authoritative; an editable local file/digest is not an AI authenticity proof.
export function validateReplayReviewCards(response, review) {
  serializeReplayReviewBinding(review);
  const { totalRounds, verifiedRounds, excludedRounds } = review.coverage ?? {};
  if (![totalRounds, verifiedRounds, excludedRounds].every(n => Number.isSafeInteger(n) && n >= 0 && n <= 64)
    || totalRounds !== verifiedRounds + excludedRounds || verifiedRounds < 1
    || review.status !== (excludedRounds ? 'partial' : 'ready')
    || review.candidates.length !== Math.min(verifiedRounds, 6)
    || review.candidates.some(c => !Number.isInteger(c.round) || c.round < 1 || c.round > 64
      || c.evidenceId !== `round-${c.round}` || c.candidateId !== `review2_r${c.round}`)
    || new Set(review.candidates.map(c => c.evidenceId)).size !== review.candidates.length
    || !exact(response, ['schemaVersion', 'cards']) || response.schemaVersion !== 1
    || !Array.isArray(response.cards) || response.cards.length < 1 || response.cards.length > 2) invalid();
  const refs = new Set(review.candidates.map(c => c.evidenceId)), kinds = new Set(), usedRefs = new Set();
  return { schemaVersion: 1, cards: response.cards.map(c => {
    if (!exact(c, ['kind', ...Object.keys(fields), 'evidenceRefs']) || !['review', 'practice'].includes(c.kind) || kinds.has(c.kind)
      || !Array.isArray(c.evidenceRefs) || c.evidenceRefs.length !== 1 || !refs.has(c.evidenceRefs[0]) || usedRefs.has(c.evidenceRefs[0])) invalid();
    kinds.add(c.kind); usedRefs.add(c.evidenceRefs[0]);
    const text = {};
    for (const [key, max] of Object.entries(fields)) {
      if (typeof c[key] !== 'string' || !c[key].trim() || c[key].length > max) invalid();
      text[key] = c[key].trim();
    }
    return { kind: c.kind, ...text, evidenceRefs: [...c.evidenceRefs] };
  }) };
}

export async function validateReplayReviewEnvelope(value, review) {
  if (!exact(value, ['schemaVersion', 'mode', 'evidenceHash', 'response']) || value.schemaVersion !== 1
    || value.mode !== 'saved_ai' || typeof value.evidenceHash !== 'string' || !/^[a-f0-9]{64}$/.test(value.evidenceHash)
    || new TextEncoder().encode(JSON.stringify(value)).byteLength > MAX_REVIEW_RESULT_BYTES) invalid();
  if (value.evidenceHash !== await hashReplayReviewEvidence(review)) throw new Error('REVIEW_EVIDENCE_MISMATCH');
  return validateReplayReviewCards(value.response, review);
}
