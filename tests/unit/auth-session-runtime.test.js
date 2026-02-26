import test from "node:test";
import assert from "node:assert/strict";
import "../../src/shared/assets/auth-session-runtime.js";

const { createAuthSessionRuntime } = globalThis;

function createSessionStorage() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
  };
}

function withGlobals(stub, fn) {
  const keys = ["location", "sessionStorage"];
  const previous = Object.fromEntries(keys.map((key) => [key, globalThis[key]]));
  Object.assign(globalThis, stub);
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      keys.forEach((key) => {
        if (typeof previous[key] === "undefined") delete globalThis[key];
        else globalThis[key] = previous[key];
      });
    });
}

test("auth session runtime resolves null when auth service unavailable", async () => {
  const states = [];
  await withGlobals(
    {
      location: { pathname: "/x", search: "", href: "" },
      sessionStorage: createSessionStorage(),
    },
    async () => {
      const runtime = createAuthSessionRuntime({
        getAuthService: async () => null,
        onStateChanged(state) {
          states.push(state);
        },
      });
      await runtime.init();
      const readyUser = await runtime.waitForReady();
      assert.equal(readyUser, null);
      assert.equal(runtime.getCurrentUser(), null);
      assert.equal(states.length, 1);
      assert.equal(states[0].user, null);
    }
  );
});

test("auth session runtime requireAuth stores redirect and triggers callback", async () => {
  const sessionStorage = createSessionStorage();
  let requiredCalls = 0;
  await withGlobals(
    {
      location: { pathname: "/account/", search: "?a=1", href: "" },
      sessionStorage,
    },
    async () => {
      const runtime = createAuthSessionRuntime({
        getAuthService: async () => null,
        onAuthRequired() {
          requiredCalls += 1;
        },
      });
      await runtime.init();
      const user = await runtime.requireAuth({ redirectTo: "/board/write" });
      assert.equal(user, null);
      assert.equal(sessionStorage.getItem("postLoginRedirect"), "/board/write");
      assert.equal(requiredCalls, 1);
    }
  );
});

test("auth session runtime applies auth state and consumes redirect", async () => {
  const sessionStorage = createSessionStorage();
  sessionStorage.setItem("postLoginRedirect", "/target");
  let listener = null;

  await withGlobals(
    {
      location: { pathname: "/", search: "", href: "" },
      sessionStorage,
    },
    async () => {
      const runtime = createAuthSessionRuntime({
        getAuthService: async () => ({
          onAuthStateChanged(cb) {
            listener = cb;
          },
        }),
      });
      await runtime.init();
      listener({ user: { uid: "u1" }, profile: { nickname: "n1" } });
      assert.equal(runtime.getCurrentUser().uid, "u1");
      assert.equal(runtime.getCurrentUserProfile().nickname, "n1");
      assert.equal(globalThis.location.href, "/target");
      assert.equal(sessionStorage.getItem("postLoginRedirect"), null);
    }
  );
});
