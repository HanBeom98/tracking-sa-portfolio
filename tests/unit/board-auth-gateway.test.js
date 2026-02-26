import test from "node:test";
import assert from "node:assert/strict";
import {
  waitAuthReady,
  getCurrentUser,
  requireAuth,
  getAuthService,
} from "../../src/domains/board/application/authGateway.js";

function withWindow(stubWindow, fn) {
  const previous = globalThis.window;
  globalThis.window = stubWindow;
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      if (typeof previous === "undefined") {
        delete globalThis.window;
      } else {
        globalThis.window = previous;
      }
    });
}

test("board authGateway uses AuthGateway methods when available", async () => {
  const calls = [];
  await withWindow(
    {
      AuthGateway: {
        waitForReady: async () => "ready",
        getCurrentUser: () => ({ uid: "u1" }),
        requireAuth: async ({ redirectTo }) => {
          calls.push(redirectTo);
          return { uid: "u1" };
        },
        getAuthService: async () => ({ signOut: async () => {} }),
      },
    },
    async () => {
      assert.equal(await waitAuthReady(), "ready");
      assert.equal(getCurrentUser().uid, "u1");
      assert.equal((await requireAuth({ redirectTo: "/board/write" })).uid, "u1");
      assert.equal(typeof (await getAuthService()).signOut, "function");
    }
  );

  assert.deepEqual(calls, ["/board/write"]);
});

test("board authGateway falls back to legacy globals", async () => {
  const fallbackReady = Promise.resolve({ uid: "u2" });
  await withWindow(
    {
      authStateReady: fallbackReady,
      getCurrentUser: () => ({ uid: "u2" }),
      requireAuth: async () => ({ uid: "u2" }),
      authDomainReady: Promise.resolve({ check: true }),
    },
    async () => {
      assert.equal(await waitAuthReady(), await fallbackReady);
      assert.equal(getCurrentUser().uid, "u2");
      assert.equal((await requireAuth()).uid, "u2");
      assert.equal((await getAuthService()).check, true);
    }
  );
});
