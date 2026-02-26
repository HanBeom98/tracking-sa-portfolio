import test from "node:test";
import assert from "node:assert/strict";
import "../../src/shared/assets/auth-state-bus.js";

const { createAuthStateBus } = globalThis;

test("auth state bus publishes snapshot and unsubscribes listener", () => {
  const bus = createAuthStateBus();
  const events = [];

  const unsubscribe = bus.subscribe((state) => {
    events.push(state);
  });

  bus.publish({ user: { uid: "u1" }, profile: { nickname: "Tracking" } });
  unsubscribe();
  bus.publish({ user: { uid: "u2" }, profile: { nickname: "Other" } });

  assert.equal(events.length, 1);
  assert.equal(events[0].user.uid, "u1");
  assert.equal(events[0].profile.nickname, "Tracking");
  assert.equal(bus.getSnapshot().user.uid, "u2");
});

test("auth state bus catches listener error via callback", () => {
  let capturedError = null;
  const bus = createAuthStateBus({
    onListenerError(error) {
      capturedError = error;
    },
  });

  bus.subscribe(() => {
    throw new Error("listener-failed");
  });

  bus.publish({ user: { uid: "u3" } });

  assert.ok(capturedError instanceof Error);
  assert.equal(capturedError.message, "listener-failed");
});
