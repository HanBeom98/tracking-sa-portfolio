import test from 'node:test';
import assert from 'node:assert/strict';
import { createShareCardController, createShareCardModel } from '../../src/domains/stats/sudden-attack/ui/share-card.js';

function element() {
  const classes = new Set(), handlers = new Map();
  return { handlers, style: {}, value: '', textContent: '',
    classList: { add: key => classes.add(key), remove: key => classes.delete(key),
      contains: key => classes.has(key), toggle: (key, enabled) => enabled ? classes.add(key) : classes.delete(key) },
    addEventListener: (key, fn) => handlers.set(key, fn), setAttribute() {} };
}

function fixture() {
  const frame = Object.assign(element(), { clientWidth: 200, clientHeight: 200 });
  const image = Object.assign(element(), { parentElement: frame });
  const nodes = new Map([['[data-share-profile-frame]', frame], ['[data-share-profile-image]', image]]);
  const panel = Object.assign(element(), { querySelector: key => nodes.get(key) || null });
  const profileImageInput = element(), resetProfileImageButton = element(), profileAdjustments = element();
  const profileZoomInput = element(), profileZoomValue = element(), resetProfilePositionButton = element();
  const shareButton = element(), status = element(), revoked = [], generated = [], captures = [], releases = [];
  frame.setPointerCapture = id => captures.push(id); frame.releasePointerCapture = id => releases.push(id);
  let nextId = 0, failDecode = false;
  const controller = createShareCardController({ panel, preview: element(), shareButton, status,
    profileImageInput, resetProfileImageButton, profileAdjustments, profileZoomInput, profileZoomValue,
    resetProfilePositionButton, ResizeObserverRef: null,
    matchMediaRef: () => ({ matches: false }), windowRef: { addEventListener() {}, requestAnimationFrame: fn => fn() },
    documentRef: { createElement(tag) {
      assert.equal(tag, 'img');
      return { naturalWidth: 1000, naturalHeight: 500,
        set src(_value) { queueMicrotask(() => failDecode ? this.onerror() : this.onload()); } };
    } },
    urlRef: { createObjectURL: () => `blob:local-${++nextId}`, revokeObjectURL: value => revoked.push(value) },
    navigatorRef: { clipboard: { write: async () => {} } },
    ClipboardItemRef: class { constructor(items) { this.items = items; } },
    createBlob: async (model, _document, options) => { generated.push({ model, options }); return new Blob(['png'], { type: 'image/png' }); },
  });
  const render = name => controller.render(createShareCardModel({ player: { nickname: name } }, {}));
  render('Tracking');
  const select = async (file = { type: 'image/png', size: 1024 }) => {
    profileImageInput.files = [file]; await profileImageInput.handlers.get('change')();
  };
  const zoom = value => { profileZoomInput.value = String(value); profileZoomInput.handlers.get('input')(); };
  return { controller, frame, image, profileImageInput, resetProfileImageButton, profileAdjustments,
    profileZoomInput, profileZoomValue, status, revoked, generated, captures, releases,
    select, zoom, render, failDecode: () => { failDecode = true; } };
}

test('sharing captures the selected local image and adjustment before later edits', async () => {
  const f = fixture(); await f.select();
  assert.equal(f.image.hidden, false);
  assert.equal(f.image.style.width, '400px');
  assert.equal(f.resetProfileImageButton.classList.contains('hidden'), false);
  f.zoom(150);
  const sharing = f.controller.share();
  f.zoom(200);
  await sharing;
  assert.equal(f.generated.length, 1);
  assert.deepEqual(f.generated[0].options, { profileImageUrl: 'blob:local-1', profileAdjustment: { zoom: 1.5, focusX: .5, focusY: .5 } });
  assert.equal(f.profileZoomValue.textContent, '200%');
});

test('image replacement and reset release URLs, while invalid uploads keep the previous image', async () => {
  const f = fixture(); await f.select(); await f.select();
  assert.deepEqual(f.revoked, ['blob:local-1']);
  assert.equal(f.image.src, 'blob:local-2');
  await f.select({ type: 'image/gif', size: 1024 });
  assert.match(f.status.textContent, /PNG/);
  assert.equal(f.image.src, 'blob:local-2');
  f.failDecode(); await f.select();
  assert.deepEqual(f.revoked, ['blob:local-1', 'blob:local-3']);
  assert.equal(f.image.src, 'blob:local-2');
  assert.match(f.status.textContent, /올바른 이미지/);
  f.controller.resetProfileImage({ announce: true });
  assert.deepEqual(f.revoked, ['blob:local-1', 'blob:local-3', 'blob:local-2']);
  assert.equal(f.image.hidden, true);
  assert.equal(f.profileAdjustments.classList.contains('hidden'), true);
  assert.equal(f.profileZoomInput.value, '100');
});

test('photo drag, position reset and profile changes retain the original editing behavior', async () => {
  const f = fixture(); await f.select(); f.zoom(200);
  const pointer = (id, x) => ({ pointerId: id, button: 0, clientX: x, clientY: 0, preventDefault() {} });
  const start = f.frame.handlers.get('pointerdown'), move = f.frame.handlers.get('pointermove');
  start(pointer(7, 0));
  move(pointer(8, 100)); assert.equal(f.image.style.left, '-300px');
  move(pointer(7, 100)); assert.ok(Math.abs(parseFloat(f.image.style.left) + 200) < 1e-8);
  f.frame.handlers.get('pointercancel')(pointer(7, 100));
  assert.deepEqual(f.captures, [7]); assert.deepEqual(f.releases, [7]);
  f.controller.resetProfilePosition();
  assert.equal(f.image.style.left, '-100px'); assert.equal(f.profileZoomValue.textContent, '100%');
  f.render('Tracking'); assert.equal(f.image.hidden, false);
  f.render('다른 닉네임'); assert.equal(f.image.hidden, true);
  assert.deepEqual(f.revoked, ['blob:local-1']);
});
