import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequest } from '../../functions/api/sa-image.js';

test('SA image proxy rejects paths outside Nexon static image hashes', async () => {
  const response = await onRequest({
    request: {
      method: 'GET',
      url: 'https://trackingsa.com/api/sa-image?path=https://example.com/image.png',
    },
  });

  assert.equal(response.status, 400);
});

test('SA image proxy returns a cacheable image response', async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async (url) => {
    assert.equal(
      url.toString(),
      'https://open.api.nexon.com/static/suddenattack/img/cf9b9c46cec3344aeb3ce37ba262ce8b',
    );
    return new Response(new Uint8Array([1, 2, 3]), {
      status: 200,
      headers: { 'Content-Type': 'image/png' },
    });
  };

  const response = await onRequest({
    request: {
      method: 'GET',
      url: 'https://trackingsa.com/api/sa-image?path=%2Fstatic%2Fsuddenattack%2Fimg%2Fcf9b9c46cec3344aeb3ce37ba262ce8b',
    },
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Content-Type'), 'image/png');
  assert.match(response.headers.get('Cache-Control'), /s-maxage=604800/);
  assert.deepEqual([...new Uint8Array(await response.arrayBuffer())], [1, 2, 3]);
});
