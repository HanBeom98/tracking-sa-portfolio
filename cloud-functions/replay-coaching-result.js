const fail = () => { throw Object.assign(new Error('INVALID_COACHING_RESULT'), { code: 'INVALID_COACHING_RESULT', status: 502 }); };
const { normalizeCoachingSelection } = require('./replay-coaching-facts.js');
const exact = (v, keys) => v && typeof v === 'object' && !Array.isArray(v)
  && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const limits = Object.freeze({ title: 30, observation: 100, practice: 80, limitation: 60 });
// Small, bounded result only. No provider envelope, prompt, replay or identity.
function normalizeCoachingResult(value) {
  const hasSelection = value && Object.hasOwn(value, 'selection');
  if (!exact(value, ['providerResponseId', 'response', ...(hasSelection ? ['selection'] : [])]) || typeof value.providerResponseId !== 'string'
    || !/^resp_[A-Za-z0-9_-]{1,120}$/.test(value.providerResponseId)
    || !exact(value.response, ['schemaVersion', 'cards']) || value.response.schemaVersion !== 1
    || !Array.isArray(value.response.cards) || value.response.cards.length < 1 || value.response.cards.length > 3) fail();
  const kinds = new Set();
  const cards = value.response.cards.map(card => {
    if (!exact(card, ['kind', ...Object.keys(limits), 'evidenceRefs'])
      || !['strength', 'review', 'practice'].includes(card.kind) || kinds.has(card.kind)) fail();
    kinds.add(card.kind);
    const fields = {};
    for (const [key, max] of Object.entries(limits)) {
      if (typeof card[key] !== 'string' || !card[key].trim() || card[key].length > max) fail();
      fields[key] = card[key].trim();
    }
    if (!Array.isArray(card.evidenceRefs) || card.evidenceRefs.length < 1 || card.evidenceRefs.length > 2
      || new Set(card.evidenceRefs).size !== card.evidenceRefs.length
      || card.evidenceRefs.some(r => typeof r !== 'string' || !/^(verified-rounds|round-([1-9]|[1-5][0-9]|6[0-4]))$/.test(r))) fail();
    return { kind: card.kind, ...fields, evidenceRefs: [...card.evidenceRefs] };
  });
  const result = { providerResponseId: value.providerResponseId, response: { schemaVersion: 1, cards },
    ...(hasSelection ? { selection: normalizeCoachingSelection(value.selection) } : {}) };
  if (Buffer.byteLength(JSON.stringify(result), 'utf8') > 3072) fail();
  return result;
}
module.exports = { normalizeCoachingResult };
