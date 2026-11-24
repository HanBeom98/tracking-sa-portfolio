import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { requestDiscordSession } from '../../functions/infra/discord-session-client.js';
import { onRequest } from '../../functions/api/discord-interaction.js';

const keys = generateKeyPairSync('ed25519');
const publicKey = keys.publicKey.export({ type: 'spki', format: 'der' }).subarray(-32).toString('hex');
const makeRequest = (interaction) => {
  const raw = JSON.stringify(interaction);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = sign(null, Buffer.from(timestamp + raw), keys.privateKey).toString('hex');
  return { method: 'POST', headers: new Headers({ 'x-signature-ed25519': signature, 'x-signature-timestamp': timestamp }), text: async () => raw };
};
test('session RPC forwards the exact signed body and propagates storage failures', async () => {
  const request = makeRequest({ type: 2 }); const raw = await request.text();
  let captured;
  const result = await requestDiscordSession(request, raw, { fetchImpl: async (url, options) => {
    captured = { url, ...options }; return Response.json({ code: 'UPDATED', session: {} });
  } });
  assert.equal(result.code, 'UPDATED'); assert.equal(captured.body, raw);
  assert.equal(captured.headers['x-signature-ed25519'], request.headers.get('x-signature-ed25519'));
  assert.match(captured.url, /cloudfunctions[.]net\/discordMatchSession$/);
  await assert.rejects(requestDiscordSession(request, raw, { fetchImpl: async () => Response.json({ error: 'HOST_REQUIRED' }, { status: 403 }) }), { code: 'HOST_REQUIRED', status: 403 });
});

test('a recruiting command defers immediately and stores through the signed backend only', async () => {
  const tasks = []; const calls = []; const originalFetch = globalThis.fetch;
  let completeStorage;
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    if (String(url).includes('cloudfunctions.net')) return new Promise((resolve) => { completeStorage = () => resolve(Response.json({ code: 'UPDATED', session: { participants: [] } })); });
    return Response.json({});
  };
  try {
    const response = await onRequest({ request: makeRequest({ type: 2, id: '100', application_id: '1478495458900054300', guild_id: '12345', member: { user: { id: '1' } }, token: 'test-token', data: { name: '대내모집' } }),
      env: { DISCORD_PUBLIC_KEY: publicKey }, waitUntil: (p) => tasks.push(p) });
    assert.equal((await response.json()).type, 5);
    assert.equal(tasks.length, 1); assert.equal(calls.length, 1);
    completeStorage(); await Promise.all(tasks);
    assert.equal(calls.length, 2);
    assert.ok(calls[1].url.startsWith('https://discord.com/'));
    assert.ok(!calls.some((call) => call.url.includes('firestore.googleapis.com')));
  } finally { globalThis.fetch = originalFetch; }
});

test('participant components render the authoritative server session without a direct write', async () => {
  const originalFetch = globalThis.fetch; const tasks = []; const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    if (String(url).includes('cloudfunctions.net')) return Response.json({ code: 'UPDATED', session: { status: 'RECRUITING', hostId: '1', participants: [{ discordId: '2', nickname: 'ServerName', position: 'rifler' }] } });
    return Response.json({});
  };
  try {
    const response = await onRequest({ request: makeRequest({ type: 3, id: '101', application_id: '1478495458900054300', guild_id: '12345', member: { user: { id: '2' } }, token: 'test-token', data: { custom_id: 'set_pos_rifler_ClientName' } }),
      env: { DISCORD_PUBLIC_KEY: publicKey }, waitUntil: (p) => tasks.push(p) });
    assert.equal((await response.json()).type, 6); await Promise.all(tasks);
    assert.match(JSON.parse(calls[1].options.body).content, /ServerName/);
    assert.ok(!calls.some((call) => call.url.includes('firestore.googleapis.com')));
  } finally { globalThis.fetch = originalFetch; }
});

test('Cloudflare rejects oversized streamed bodies before parsing and cancels the reader', async () => {
  let cancelled = false;
  const stream = new ReadableStream({
    start(controller) { controller.enqueue(new Uint8Array(65537)); },
    cancel() { cancelled = true; },
  });
  const response = await onRequest({ request: { method: 'POST', headers: new Headers(), body: stream }, env: {} });
  assert.equal(response.status, 413);
  assert.equal(cancelled, true);
});

test('Cloudflare preserves non-JSON authorization and method errors', async () => {
  const unauthorized = await onRequest({ request: { method: 'POST', headers: new Headers(), text: async () => '{}' }, env: {} });
  assert.equal(unauthorized.status, 401);
  assert.equal(await unauthorized.text(), 'Unauthorized');
  const wrongMethod = await onRequest({ request: { method: 'GET' }, env: {} });
  assert.equal(wrongMethod.status, 405);
});

test('the Discord ingress limit counts UTF-8 bytes and accepts an exact signed 64 KiB body', async () => {
  const oversized = await onRequest({ request: { method: 'POST', headers: new Headers(), text: async () => '가'.repeat(21846) }, env: {} });
  assert.equal(oversized.status, 413);
  const raw = '{"type":1}'.padEnd(65536, ' ');
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = sign(null, Buffer.from(timestamp + raw), keys.privateKey).toString('hex');
  const request = new Request('https://trackingsa.com/api/discord-interaction', { method: 'POST', body: raw,
    headers: { 'x-signature-ed25519': signature, 'x-signature-timestamp': timestamp } });
  const response = await onRequest({ request, env: { DISCORD_PUBLIC_KEY: publicKey } });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { type: 1 });
});

test('the public verification-key fallback rejects unsigned requests without a runtime secret', async () => {
  const response = await onRequest({ request: { method: 'POST', headers: new Headers(), text: async () => '{}' }, env: {} });
  assert.equal(response.status, 401);
});
