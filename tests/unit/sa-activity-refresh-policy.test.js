import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('public profile refresh keeps the daily player activity cache', () => {
  const source = readFileSync(
    'src/domains/stats/sudden-attack/home-main.js',
    'utf8'
  );
  const refreshHandler = source.match(
    /async function handleRefresh\(\) \{([\s\S]*?)\n\}/
  )?.[1] || '';

  assert.match(refreshHandler, /invalidatePublicMatchCategories/);
  assert.doesNotMatch(refreshHandler, /invalidatePlayerActivity/);
});
