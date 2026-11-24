import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import local from '../../playwright.config.js';
import auth from '../e2e/playwright.auth.config.js';
import coaching from '../e2e/playwright.coaching.config.js';
import production from '../e2e/playwright.production.config.js';

test('default and authenticated browser commands stay on fixed local fixtures', () => {
  for (const config of [local, auth, coaching]) {
    assert.equal(config.use.baseURL, 'http://127.0.0.1:4173');
    assert.equal(config.use.serviceWorkers, 'block');
    assert.ok(path.isAbsolute(config.testDir));
    assert.ok(path.isAbsolute(config.globalSetup));
  }
  assert.deepEqual(local.testMatch, ['local-smoke.spec.js', 'public-match-list.spec.js', 'board-theme.spec.js', 'replay-fast-start.spec.js', 'replay-lazy-loading.spec.js', 'replay-print-report.spec.js', 'replay-product-example.spec.js', 'replay-polishing.spec.js', 'home-replay-entry.spec.js', 'admin-dashboard.spec.js', 'mygun2.spec.js']);
  assert.equal(auth.testMatch, 'local-auth.spec.js');
  assert.equal(coaching.testMatch, 'local-coaching.spec.js');
  assert.deepEqual(production.testMatch, ['auth-smoke.spec.js', 'sa-smoke.spec.js']);
  assert.equal(production.globalSetup, undefined);
});

test('standard npm aliases select local tests while deployed smoke is explicit', () => {
  const scripts = JSON.parse(readFileSync('package.json', 'utf8')).scripts;
  assert.equal(scripts.test, 'npm run test:unit');
  assert.equal(scripts['test:e2e'], 'npm run test:e2e:ci');
  assert.equal(scripts['test:e2e:auth'], 'npm run test:e2e:auth:local');
  assert.equal(scripts['test:e2e:smoke'], 'npm run test:e2e:ci');
  assert.match(scripts['test:e2e:production'], /playwright\.production\.config\.js/);
});
