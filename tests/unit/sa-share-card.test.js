import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createShareCardModel,
  createShareCardController,
  getShareProfilePlacement,
  getShareProfileImageError,
  SHARE_PROFILE_IMAGE_MAX_BYTES,
} from '../../src/domains/stats/sudden-attack/ui/share-card.js';

test('share card model uses existing profile data without persistence', () => {
  const model = createShareCardModel({
    player: {
      nickname: 'tracking',
      rankName: '대장',
      rankImage: 'https://open.api.nexon.com/static/suddenattack/rank/general.png',
      soloTier: 'MASTER I',
      soloImage: 'https://open.api.nexon.com/static/suddenattack/tier/master.png',
      partyTier: 'UNRANK',
      partyImage: 'https://open.api.nexon.com/static/suddenattack/tier/unrank.png',
    },
  }, {
    stats: {
      winRate: 60,
      kd: 1.25,
      kdPercent: 56,
      officialRecentKd: 61.7,
      seasonPrecisionRate: 0.375,
    },
    matches: [
      { matchResult: 'WIN' },
      { matchResult: 'LOSE' },
      { matchResult: 'WIN' },
    ],
  }, 'https://trackingsa.com/stats/sudden-attack/?foo=bar');

  assert.equal(model.nickname, 'tracking');
  assert.equal(model.rankName, '대장');
  assert.equal(model.rankImage, 'https://open.api.nexon.com/static/suddenattack/rank/general.png');
  assert.equal(model.soloTier, 'MASTER I');
  assert.equal(model.soloImage, 'https://open.api.nexon.com/static/suddenattack/tier/master.png');
  assert.equal(model.partyTier, 'UNRANK');
  assert.equal(model.partyImage, 'https://open.api.nexon.com/static/suddenattack/tier/unrank.png');
  assert.equal(model.winRate, 60);
  assert.equal(model.kdPercent, 61.7);
  assert.equal(model.headshotRate, 37.5);
  assert.equal(new URL(model.url).searchParams.get('n'), 'tracking');
});

test('share card accepts only supported profile images up to 5MB', () => {
  assert.equal(getShareProfileImageError({ type: 'image/png', size: 1024 }), '');
  assert.equal(getShareProfileImageError({ type: 'image/jpeg', size: 1024 }), '');
  assert.equal(getShareProfileImageError({ type: 'image/webp', size: 1024 }), '');
  assert.match(getShareProfileImageError({ type: 'image/gif', size: 1024 }), /PNG/);
  assert.match(
    getShareProfileImageError({ type: 'image/png', size: SHARE_PROFILE_IMAGE_MAX_BYTES + 1 }),
    /5MB/,
  );
});

test('share card custom profile image is not persisted in browser storage', async () => {
  const { readFile } = await import('node:fs/promises');
  for (const name of ['share-card', 'share-card-model', 'share-card-canvas', 'share-profile-image']) {
    const source = await readFile(new URL(`../../src/domains/stats/sudden-attack/ui/${name}.js`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB/, name);
  }
});

test('share card profile placement supports zoom, drag focus, and black-space shrink', () => {
  assert.deepEqual(
    getShareProfilePlacement(1000, 500, 200, 200, { zoom: 1, focusX: .5, focusY: .5 }),
    { x: -100, y: 0, width: 400, height: 200 },
  );
  assert.deepEqual(
    getShareProfilePlacement(1000, 500, 200, 200, { zoom: 2, focusX: 1, focusY: 1 }),
    { x: -600, y: -200, width: 800, height: 400 },
  );
  assert.deepEqual(
    getShareProfilePlacement(500, 1000, 200, 200, { zoom: .5, focusX: 0, focusY: 1 }),
    { x: 50, y: 0, width: 100, height: 200 },
  );
  const clampedPlacement = getShareProfilePlacement(
    1000,
    500,
    200,
    200,
    { zoom: 10, focusX: -5, focusY: 5 },
  );
  assert.equal(clampedPlacement.width, 1200);
});

test('web preview uses the same profile frame ratio as the shared PNG', async () => {
  const source = await import('node:fs/promises')
    .then(({ readFile }) => readFile(
      new URL('../../src/domains/stats/sudden-attack/ui/style.css', import.meta.url),
      'utf8',
    ));
  assert.match(source, /\.sa-share-emblem\s*\{[^}]*aspect-ratio:\s*292\s*\/\s*544;/s);
  assert.match(source, /\.sa-share-emblem\s*>\s*img\s*\{[^}]*max-width:\s*none;/s);
  assert.match(source, /\.sa-share-emblem\s*>\s*img\s*\{[^}]*right:\s*auto;/s);
  assert.doesNotMatch(source, /grid-template-columns:\s*(?:31|28)%/);
});

test('share card repositions a selected photo when its preview frame resizes', () => {
  const frame = {
    addEventListener() {},
  };
  const panel = {
    querySelector(selector) {
      return selector === '[data-share-profile-frame]' ? frame : null;
    },
  };
  let observedTarget = null;
  class ResizeObserverStub {
    constructor(callback) {
      assert.equal(typeof callback, 'function');
    }

    observe(target) {
      observedTarget = target;
    }
  }

  createShareCardController({
    panel,
    ResizeObserverRef: ResizeObserverStub,
    windowRef: { addEventListener() {} },
    matchMediaRef: () => ({ matches: false }),
  });

  assert.equal(observedTarget, frame);
});
