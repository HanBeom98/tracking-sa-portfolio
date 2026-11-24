// Encrypted, browser-local TEST recovery only. The access code is never stored.
const TTL = 24 * 60 * 60 * 1000;
const hex = v => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const exact = (v, keys) => v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const pointer = v => exact(v, ['orderId', 'session']) && typeof v.orderId === 'string' && /^[A-Za-z0-9_-]{16,64}$/.test(v.orderId) && hex(v.session);
const bytes = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const base64 = b => btoa(String.fromCharCode(...b));
const aad = expiresAt => new TextEncoder().encode(`tracking-sa:merchant-test:recovery:v1:${expiresAt}`);
async function key(code, usage) {
  if (!hex(code)) throw Error('RECOVERY_INVALID');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code));
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, [usage]);
}
export async function sealRecovery(value, code, now = Date.now()) {
  if (!pointer(value) || !Number.isSafeInteger(now) || now < 0) throw Error('RECOVERY_INVALID');
  const expiresAt = now + TTL, iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad(expiresAt) }, await key(code, 'encrypt'), new TextEncoder().encode(JSON.stringify(value)));
  return JSON.stringify({ version: 1, expiresAt, iv: base64(iv), data: base64(new Uint8Array(encrypted)) });
}
export async function openRecovery(raw, code, now = Date.now()) {
  if (typeof raw !== 'string' || raw.length > 2048) throw Error('RECOVERY_INVALID');
  const v = JSON.parse(raw);
  if (!exact(v, ['version', 'expiresAt', 'iv', 'data']) || v.version !== 1 || !Number.isSafeInteger(v.expiresAt)
    || !Number.isSafeInteger(now) || now < 0 || v.expiresAt <= now || v.expiresAt > now + TTL
    || typeof v.iv !== 'string' || !/^[A-Za-z0-9+/]{16}$/.test(v.iv) || typeof v.data !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(v.data)) throw Error('RECOVERY_INVALID');
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes(v.iv), additionalData: aad(v.expiresAt) }, await key(code, 'decrypt'), bytes(v.data));
  const value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(plain));
  if (!pointer(value)) throw Error('RECOVERY_INVALID');
  return value;
}
