import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BoardWriteSubmitController } from '../../src/domains/board/ui/board-write-submit-controller.js';

function createFakeForm() {
  return { onsubmit: null };
}

test('board write submit controller keeps submission working after form rerender', () => {
  const calls = [];
  const controller = new BoardWriteSubmitController();
  controller.setHandler((values) => calls.push(values));

  const firstForm = createFakeForm();
  controller.bind(firstForm, () => ({ title: '첫 폼' }));

  const replacementForm = createFakeForm();
  controller.bind(replacementForm, () => ({ title: '재렌더링 폼' }));
  let prevented = false;
  replacementForm.onsubmit({ preventDefault: () => { prevented = true; } });

  assert.equal(prevented, true);
  assert.deepEqual(calls, [{ title: '재렌더링 폼' }]);
});

test('board write submit controller safely ignores submit before handler registration', () => {
  const controller = new BoardWriteSubmitController();
  const form = createFakeForm();
  controller.bind(form, () => ({ title: '제목' }));

  assert.doesNotThrow(() => form.onsubmit({ preventDefault() {} }));
});
