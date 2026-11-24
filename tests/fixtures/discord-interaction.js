import { generateKeyPairSync, sign } from 'node:crypto';

export const DISCORD_TEST_APPLICATION_ID = '1478495458900054300';
const endpoint = 'https://trackingsa.com/api/discord-interaction';

// Each caller owns fresh synthetic keys. No production handler/config is used
// to sign requests, so a broken verifier cannot manufacture its own evidence.
export function createDiscordSignatureFixture() {
  const keys = generateKeyPairSync('ed25519');
  const publicKey = keys.publicKey.export({ type: 'spki', format: 'der' }).subarray(-32).toString('hex');
  function signedRequest(raw, timestamp = String(Math.floor(Date.now() / 1000))) {
    const signature = sign(null, Buffer.from(timestamp + raw), keys.privateKey).toString('hex');
    return new Request(endpoint, { method: 'POST', body: raw,
      headers: { 'x-signature-ed25519': signature, 'x-signature-timestamp': timestamp } });
  }
  return { publicKey, signedRequest };
}

// These cases intentionally run at each ingress boundary. Keep their request
// construction and expected rejection contract in one place, not their runners.
// Help has no side effects if authentication regresses; rollback tests opt in
// to a legacy command with a loader that fails before any external operation.
export function discordIngressRejections({ signedRequest }, { command = '도움말' } = {}) {
  const value = { type: 2, application_id: DISCORD_TEST_APPLICATION_ID, data: { name: command } };
  const raw = JSON.stringify(value);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const exact = signedRequest(raw, timestamp);
  return [
    { name: 'non-POST method', request: new Request(endpoint), status: 405 },
    { name: 'missing signature', request: new Request(endpoint, { method: 'POST', body: raw }), status: 401 },
    { name: 'tampered exact body', request: new Request(endpoint, { method: 'POST', headers: exact.headers, body: raw + ' ' }), status: 401 },
    { name: 'expired timestamp', request: signedRequest(raw, String(Number(timestamp) - 301)), status: 401 },
    { name: 'oversized body', request: signedRequest('x'.repeat(65537)), status: 413 },
    { name: 'malformed signed JSON', request: signedRequest('{broken'), status: 400 },
    { name: 'null signed interaction', request: signedRequest('null'), status: 400 },
    { name: 'another application', request: signedRequest(JSON.stringify({ ...value, application_id: 'another-app' })), status: 401 },
  ];
}
