import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const headTemplate = fs.readFileSync(new URL('../../src/shared/ui/head.html', import.meta.url), 'utf8');

test('public pages use the official AdSense script directly in the shared head', () => {
  assert.match(headTemplate,
    /<script async src="https:\/\/pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js\?client=\{\{ADSENSE_CLIENT_ID\}\}" crossorigin="anonymous"><\/script>/);
  assert.doesNotMatch(headTemplate, /adsense-loader\.js/);
});
