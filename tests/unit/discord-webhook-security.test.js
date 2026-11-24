import test from "node:test";
import assert from "node:assert/strict";
import { onRequest } from "../../functions/api/discord-sa.js";

test("Discord webhook proxy rejects unauthenticated requests before forwarding", async () => {
  let fetchCount = 0;
  const originalFetch = global.fetch;
  global.fetch = async () => {
    fetchCount += 1;
    return new Response('{}', { status: 200 });
  };

  try {
    const response = await onRequest({
      request: {
        method: 'POST',
        headers: new Headers(),
        json: async () => ({ embeds: [{ title: 'unauthorized' }] }),
      },
      env: { SA_DISCORD_WEBHOOK: 'https://discord.example/webhook' },
    });

    assert.equal(response.status, 401);
    assert.equal(fetchCount, 0);
    assert.deepEqual(await response.json(), { error: 'Unauthorized' });
  } finally {
    global.fetch = originalFetch;
  }
});

test("Discord webhook proxy rejects unsupported methods", async () => {
  const response = await onRequest({
    request: { method: 'GET', headers: new Headers() },
    env: { SA_DISCORD_WEBHOOK: 'https://discord.example/webhook' },
  });

  assert.equal(response.status, 405);
});
