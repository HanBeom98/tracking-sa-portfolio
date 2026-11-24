const exact = (v, keys) => v && typeof v === 'object' && !Array.isArray(v)
  && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const id = v => typeof v === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(v);
const check = value => { if (!value) throw Error('INVALID_PURCHASE_RESPONSE'); };
const time = v => Number.isSafeInteger(v) && v >= 0 && Number.isFinite(new Date(v).getTime());
export function validateAcknowledgementIdentity(v, createdAt) {
  check(v && ['preview', 'sale'].includes(v.purpose) && id(v.version) && typeof v.digest === 'string' && /^[a-f0-9]{64}$/.test(v.digest)
    && time(v.acceptedAt) && v.acceptedAt === createdAt);
}
export function validateDisclosure(v, receipt = false, createdAt) {
  check(exact(v, ['purpose', 'version', 'title', 'text', 'digest', ...(receipt ? ['schemaVersion', 'acceptedAt'] : [])]));
  check(['preview', 'sale'].includes(v.purpose) && id(v.version) && typeof v.digest === 'string' && /^[a-f0-9]{64}$/.test(v.digest)
    && typeof v.title === 'string' && v.title.trim().length > 0 && new TextEncoder().encode(v.title).length <= 120
    && typeof v.text === 'string' && v.text.trim().length > 0 && new TextEncoder().encode(v.text).length <= 1400);
  if (receipt) { check(v.schemaVersion === 1); validateAcknowledgementIdentity(v, createdAt); }
}
