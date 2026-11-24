import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

function runtime({ factoryFails = false } = {}) {
  const source = fs.readFileSync("src/shared/assets/common.js", "utf8").replace(/\r\n/g, "\n");
  const end = source.indexOf("\nasync function getAuthService()");
  assert.ok(end > source.indexOf("window.AuthStateBus ="));
  const context = vm.createContext({
    URL, console: { error() {} }, document: { currentScript: null },
    location: { href: "http://127.0.0.1:4173/" },
    dispatchEvent() {}, CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init.detail; } },
  });
  context.window = context;
  vm.runInContext(fs.readFileSync("src/shared/assets/auth-state-bus.js", "utf8"), context);
  const factory = context.createAuthStateBus;
  let factoryCalls = 0;
  context.createAuthStateBus = (...args) => {
    factoryCalls += 1;
    if (factoryFails) throw new Error("factory unavailable");
    return factory(...args);
  };
  vm.runInContext(source.slice(0, end), context);
  return { context, init: () => vm.runInContext("ensureAuthStateBus()", context), publish: (state) => context.publishAuthStateChange(state.user, state.profile), factoryCalls: () => factoryCalls };
}

test("subscribers registered before async initialization receive sign-in and sign-out", async () => {
  const app = runtime(), users = [];
  app.context.AuthStateBus.subscribe(({ user }) => users.push(user?.uid || null));
  await app.init();
  app.publish({ user: { uid: "member" }, profile: { nickname: "회원" } });
  app.publish({ user: null, profile: null });
  assert.deepEqual(users, ["member", null]);
});

test("early unsubscribe cancels registration; unsubscribe after initialization removes the listener", async () => {
  const app = runtime(), active = [], cancelled = [];
  app.context.AuthStateBus.subscribe((state) => cancelled.push(state))();
  const unsubscribe = app.context.AuthStateBus.subscribe(({ user }) => active.push(user?.uid || null));
  await app.init();
  app.publish({ user: { uid: "member" } });
  unsubscribe(); unsubscribe();
  app.publish({ user: null });
  assert.deepEqual(cancelled, []);
  assert.deepEqual(active, ["member"]);
});

test("concurrent initialization shares one bus and preserves early subscribers", async () => {
  const app = runtime(), seen = [];
  app.context.AuthStateBus.subscribe(({ user }) => seen.push(user?.uid));
  const [first, second] = await Promise.all([app.init(), app.init()]);
  assert.equal(first, second);
  assert.equal(app.factoryCalls(), 1);
  app.publish({ user: { uid: "member" } });
  assert.deepEqual(seen, ["member"]);
});

test("factory failure attaches early subscribers to the fallback bus", async () => {
  const app = runtime({ factoryFails: true }), seen = [];
  app.context.AuthStateBus.subscribe(({ user }) => seen.push(user?.uid || null));
  await app.init();
  app.publish({ user: null });
  assert.deepEqual(seen, [null]);
});

test("a state published before initialization is delivered after early subscribers attach", async () => {
  const app = runtime(), seen = [];
  app.context.AuthStateBus.subscribe(({ user }) => seen.push(user?.uid || null));
  app.publish({ user: { uid: "restored" }, profile: { nickname: "복원" } });
  await app.init();
  app.publish({ user: null, profile: null });
  assert.deepEqual(seen, ["restored", null]);
});
