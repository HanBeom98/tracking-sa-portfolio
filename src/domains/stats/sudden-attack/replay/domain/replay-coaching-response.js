const fields = ['kind', 'title', 'observation', 'practice', 'limitation', 'evidenceRefs'];
const limits = { title: 80, observation: 400, practice: 300, limitation: 300 };
const invalid = () => { throw new Error('INVALID_COACHING_RESPONSE'); };
const record = value => value && typeof value === 'object' && !Array.isArray(value);
const exactKeys = (value, keys) => record(value) && Object.keys(value).length === keys.length
  && keys.every(key => Object.hasOwn(value, key));

// This checks structure and references, not the truth of generated prose.
// Evidence must come from the local analyzer (or a future trusted server).
export function validateReplayCoachingResponse(response, evidence) {
  if (evidence?.schemaVersion !== 1 || !Array.isArray(evidence.rounds)
    || !['ready', 'partial', 'insufficient_data'].includes(evidence.status)) invalid();
  const c = evidence.coverage;
  if (!c || ![c.totalRounds, c.verifiedRounds, c.excludedRounds].every(n => Number.isSafeInteger(n) && n >= 0)
    || c.verifiedRounds + c.excludedRounds !== c.totalRounds
    || evidence.status !== (c.verifiedRounds === 0 ? 'insufficient_data' : c.excludedRounds ? 'partial' : 'ready')
    || (c.verifiedRounds === 0 ? evidence.metrics !== null : evidence.metrics?.rounds !== c.verifiedRounds)
    || evidence.rounds.length > Math.min(c.verifiedRounds, 6)
    || evidence.rounds.some(r => !Number.isSafeInteger(r.round) || r.round < 1 || r.evidenceId !== `round-${r.round}`)
    || new Set(evidence.rounds.map(r => r.evidenceId)).size !== evidence.rounds.length
    || (evidence.metrics && evidence.metrics.evidenceId !== 'verified-rounds')) invalid();
  if (!exactKeys(response, ['schemaVersion', 'cards']) || response.schemaVersion !== 1
    || !Array.isArray(response.cards) || response.cards.length > 3) invalid();
  const available = new Set(evidence.rounds.map(r => r.evidenceId));
  if (evidence.metrics) available.add(evidence.metrics.evidenceId);
  if (evidence.status === 'insufficient_data' ? response.cards.length !== 0 : response.cards.length === 0) invalid();
  const kinds = new Set();
  const cards = response.cards.map(card => {
    if (!exactKeys(card, fields) || !['strength', 'review', 'practice'].includes(card.kind) || kinds.has(card.kind)) invalid();
    kinds.add(card.kind);
    for (const [field, max] of Object.entries(limits)) {
      if (typeof card[field] !== 'string' || !card[field].trim() || card[field].length > max) invalid();
    }
    if (!Array.isArray(card.evidenceRefs) || card.evidenceRefs.length < 1 || card.evidenceRefs.length > 2
      || new Set(card.evidenceRefs).size !== card.evidenceRefs.length
      || card.evidenceRefs.some(ref => typeof ref !== 'string' || !available.has(ref))) invalid();
    return { kind: card.kind, title: card.title.trim(), observation: card.observation.trim(),
      practice: card.practice.trim(), limitation: card.limitation.trim(), evidenceRefs: [...card.evidenceRefs] };
  });
  return { schemaVersion: 1, cards };
}
