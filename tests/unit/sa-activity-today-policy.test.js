import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('player activity explains that today is still being aggregated', () => {
  const component = readFileSync(
    'src/domains/stats/sudden-attack/ui/components/player-card.js',
    'utf8'
  );

  assert.match(component, /오늘 활동 기록은 집계 중이며 내일 반영됩니다\./);
});
