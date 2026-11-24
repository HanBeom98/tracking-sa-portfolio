import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function fixture(file) {
  const timers = [];
  const nodes = new Map();
  const document = { activeElement: null, body: { style: {}, appendChild() {} }, addEventListener() {} };
  const node = (id) => {
    if (!nodes.has(id)) nodes.set(id, { style: {}, classList: { add() {}, remove() {}, contains: () => true },
      value: '', addEventListener() {}, querySelector: node, contains: () => false,
      getBoundingClientRect: () => ({ top: 0 }), focus() { document.activeElement = nodes.get(id); },
    });
    return nodes.get(id);
  };
  document.createElement = () => node('modal');
  const context = { document, window: { scrollY: 0, scrollTo() {} }, setTimeout: (fn) => timers.push(fn) };
  vm.createContext(context);
  vm.runInContext(readFileSync(`src/shared/assets/${file}`, 'utf8'), context);
  return { context, node, timers, document };
}

test('opening inline login focuses email immediately and cannot steal later password input', async () => {
  const { context, node, timers, document } = fixture('inline-login-modal.js');
  const controller = context.window.createInlineLoginModalController({ getAuthService() {} });
  await controller.open();
  assert.equal(document.activeElement, node('#inline-login-email'));
  node('#inline-login-password').focus();
  for (const timer of timers) timer();
  assert.equal(document.activeElement, node('#inline-login-password'));
});

test('header login focuses email on opening and leaves subsequent password focus alone', () => {
  const { context, node, timers, document } = fixture('auth-controls.js');
  const controller = context.window.createAuthControlsController({ container: node('container'), getAuthService() {} });
  controller.openAuthPrompt();
  assert.equal(document.activeElement, node('#auth-email'));
  node('#auth-password').focus();
  for (const timer of timers) timer();
  assert.equal(document.activeElement, node('#auth-password'));
});
