import test from "node:test";
import assert from "node:assert/strict";
import {
  WRITE_PATH,
  ensureAuthenticated,
  getCurrentUser,
} from "../../src/domains/board/application/write-auth.js";

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

test("write-auth exposes fixed write path", () => {
  assert.equal(WRITE_PATH, "/board/write");
});

test("write-auth ensureAuthenticated forwards board write redirect path", async () => {
  const calls = [];
  await withWindow(
    {
      AuthGateway: {
        requireAuth: async ({ redirectTo }) => {
          calls.push(redirectTo);
          return { uid: "u1" };
        },
      },
    },
    async () => {
      const user = await ensureAuthenticated();
      assert.equal(user.uid, "u1");
    }
  );

  assert.deepEqual(calls, ["/board/write"]);
});

test("write-auth getCurrentUser delegates to AuthGateway", async () => {
  await withWindow(
    {
      AuthGateway: {
        getCurrentUser: () => ({ uid: "u2" }),
      },
    },
    async () => {
      const user = getCurrentUser();
      assert.equal(user.uid, "u2");
    }
  );
});
