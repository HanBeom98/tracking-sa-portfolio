import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequest } from '../../functions/api/discord-interaction.js';
import { createDiscordSignatureFixture, discordIngressRejections } from '../fixtures/discord-interaction.js';

test('native Ed25519 accepts only the exact signed ping and a fresh timestamp', async () => {
  const fixture = createDiscordSignatureFixture();
  const env = { DISCORD_PUBLIC_KEY: fixture.publicKey };
  const valid = await onRequest({ request: fixture.signedRequest('{"type":1}'), env });
  assert.equal(valid.status, 200);
  assert.deepEqual(await valid.json(), { type: 1 });
  for (const { name, request, status } of discordIngressRejections(fixture)) {
    assert.equal((await onRequest({ request, env })).status, status, name);
  }
  const otherKey = createDiscordSignatureFixture().publicKey;
  const wrongKey = await onRequest({ request: fixture.signedRequest('{"type":1}'), env: { DISCORD_PUBLIC_KEY: otherKey } });
  assert.equal(wrongKey.status, 401);
});
