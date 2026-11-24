import test from 'node:test';
import assert from 'node:assert/strict';
import { getMapImagePath } from '../../src/domains/stats/sudden-attack/ui/components/map-image-path.js';

test('map image path resolves shared match and preferred-map thumbnails', () => {
  assert.equal(
    getMapImagePath('프로방스(심플)'),
    '/stats/sudden-attack/assets/maps/5v5/provence-simple.jpg'
  );
  assert.equal(
    getMapImagePath('B프로방스'),
    '/stats/sudden-attack/assets/maps/3v3/b-provence-simple.jpg'
  );
  assert.equal(getMapImagePath('알 수 없는 맵'), '');
});
