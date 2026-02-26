import test from "node:test";
import assert from "node:assert/strict";

function createElement(tagName) {
  const listeners = new Map();
  const attributes = new Map();
  return {
    tagName,
    id: "",
    className: "",
    type: "",
    textContent: "",
    children: [],
    setAttribute(name, value) {
      attributes.set(name, String(value));
    },
    getAttribute(name) {
      if (name === "href" && this.href) return this.href;
      return attributes.get(name) || null;
    },
    appendChild(child) {
      this.children.push(child);
    },
    addEventListener(event, handler) {
      const arr = listeners.get(event) || [];
      arr.push(handler);
      listeners.set(event, arr);
    },
    async trigger(event, payload = {}) {
      const handlers = listeners.get(event) || [];
      for (const handler of handlers) {
        await handler(payload);
      }
    },
  };
}

function createSessionStorage() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
  };
}

function withGlobals(stub, fn) {
  const keys = ["window", "document", "sessionStorage", "alert"];
  const prev = Object.fromEntries(keys.map((key) => [key, globalThis[key]]));
  Object.assign(globalThis, stub);
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      keys.forEach((key) => {
        if (typeof prev[key] === "undefined") delete globalThis[key];
        else globalThis[key] = prev[key];
      });
    });
}

async function loadFactory() {
  if (!globalThis.window) globalThis.window = globalThis;
  await import("../../src/shared/assets/auth-prompt-kit.js");
  return globalThis.window.createAuthPromptKit || globalThis.createAuthPromptKit;
}

test("auth prompt kit promptLogin opens inline modal with redirect", async () => {
  const calls = [];
  await withGlobals(
    {
      window: globalThis,
      document: { createElement, querySelectorAll: () => [] },
      sessionStorage: createSessionStorage(),
      alert() {},
    },
    async () => {
      const factory = await loadFactory();
      const kit = factory({
        ensureInlineLoginModalController: async () => ({
          open: async ({ redirectTo }) => calls.push(redirectTo),
        }),
      });

      await kit.promptLogin({ redirectTo: "/board/write" });
      assert.deepEqual(calls, ["/board/write"]);
    }
  );
});

test("auth prompt kit creates login prompt and binds click action", async () => {
  const calls = [];
  await withGlobals(
    {
      window: globalThis,
      document: { createElement, querySelectorAll: () => [] },
      sessionStorage: createSessionStorage(),
      alert() {},
    },
    async () => {
      const factory = await loadFactory();
      const kit = factory({
        ensureInlineLoginModalController: async () => ({
          open: async ({ redirectTo }) => calls.push(redirectTo),
        }),
        getTranslation: (key, fallback) => {
          if (key === "login") return "LOGIN";
          if (key === "auth_required") return "NEED_LOGIN";
          return fallback;
        },
      });

      const prompt = kit.createLoginRequiredPrompt({
        promptId: "need-login",
        buttonId: "login-btn",
        redirectTo: "/account/",
      });
      assert.equal(prompt.id, "need-login");
      assert.equal(prompt.children.length, 2);
      assert.equal(prompt.children[0].textContent, "NEED_LOGIN");
      assert.equal(prompt.children[1].textContent, "LOGIN");

      await prompt.children[1].trigger("click");
      assert.deepEqual(calls, ["/account/"]);
    }
  );
});

test("auth prompt kit blocks auth-gated link and stores redirect when user missing", async () => {
  const link = createElement("a");
  link.href = "/board/write";
  let shown = 0;
  await withGlobals(
    {
      window: globalThis,
      document: {
        createElement,
        querySelectorAll: () => [link],
      },
      sessionStorage: createSessionStorage(),
      alert() {},
    },
    async () => {
      const factory = await loadFactory();
      const kit = factory({
        getAuthStateReady: () => Promise.resolve(null),
        showAuthMenu: () => {
          shown += 1;
        },
      });

      kit.initAuthGateLinks();
      let prevented = false;
      await link.trigger("click", {
        preventDefault() {
          prevented = true;
        },
      });

      assert.equal(prevented, true);
      assert.equal(globalThis.sessionStorage.getItem("postLoginRedirect"), "/board/write");
      assert.equal(shown, 1);
    }
  );
});
