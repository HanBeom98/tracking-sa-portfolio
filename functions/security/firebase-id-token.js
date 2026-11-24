import { SA_STAFF_EMAILS, normalizeAccessEmail } from '../../src/domains/auth/domain/access-policy.js';

const FIREBASE_PROJECT_ID = 'demo-tracking-sa-portfolio';
const JWK_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/demo-b0edfb3e@example.com';
const ALLOWED_STAFF_EMAILS = new Set(SA_STAFF_EMAILS);

let cachedSigningKeys = null;
let signingKeysExpireAt = 0;

function decodeBase64Url(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function decodeJson(value) {
  return JSON.parse(new TextDecoder().decode(decodeBase64Url(value)));
}

async function getSigningKeys() {
  if (cachedSigningKeys && Date.now() < signingKeysExpireAt) return cachedSigningKeys;

  const response = await fetch(JWK_URL, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error('Unable to load Firebase signing certificates');

  const body = await response.json();
  cachedSigningKeys = Object.fromEntries((body.keys || []).map((key) => [key.kid, key]));
  const maxAgeMatch = response.headers.get('cache-control')?.match(/max-age=(\d+)/i);
  const maxAgeSeconds = Number(maxAgeMatch?.[1] || 300);
  signingKeysExpireAt = Date.now() + Math.max(60, maxAgeSeconds) * 1000;
  return cachedSigningKeys;
}

export async function verifyFirebaseIdToken(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) throw new Error('Invalid Firebase ID token');

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = decodeJson(encodedHeader);
  const payload = decodeJson(encodedPayload);
  if (header.alg !== 'RS256' || !header.kid) throw new Error('Invalid Firebase token header');

  const signingKeys = await getSigningKeys();
  const signingKey = signingKeys[header.kid];
  if (!signingKey) throw new Error('Unknown Firebase signing key');

  const key = await crypto.subtle.importKey(
    'jwk',
    signingKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  const validSignature = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    decodeBase64Url(encodedSignature),
    new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`),
  );
  if (!validSignature) throw new Error('Invalid Firebase token signature');

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (payload.aud !== FIREBASE_PROJECT_ID) throw new Error('Invalid Firebase token audience');
  if (payload.iss !== `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`) throw new Error('Invalid Firebase token issuer');
  if (!payload.sub || typeof payload.sub !== 'string') throw new Error('Invalid Firebase token subject');
  if (!Number.isFinite(payload.exp) || payload.exp <= nowSeconds) throw new Error('Expired Firebase ID token');
  if (!Number.isFinite(payload.iat) || payload.iat > nowSeconds + 60) throw new Error('Invalid Firebase token issue time');

  return payload;
}

export async function requireStaffToken(request) {
  const authorization = request.headers?.get
    ? request.headers.get('authorization')
    : request.headers?.authorization;
  const match = String(authorization || '').match(/^Bearer\s+(.+)$/i);
  if (!match) throw new Error('Missing authorization token');

  const payload = await verifyFirebaseIdToken(match[1]);
  const email = normalizeAccessEmail(payload.email);
  if (!ALLOWED_STAFF_EMAILS.has(email)) throw new Error('Staff authorization required');
  return payload;
}
