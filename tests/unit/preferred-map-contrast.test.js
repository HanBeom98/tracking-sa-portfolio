import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('preferred map name stays white over its image in every theme', () => {
  const source = readFileSync(
    'src/domains/stats/sudden-attack/ui/components/stats-summary-styles.js',
    'utf8'
  );

  assert.match(source, /\.preferred-map-copy strong\s*\{[^}]*color:\s*#fff;/s);
});
