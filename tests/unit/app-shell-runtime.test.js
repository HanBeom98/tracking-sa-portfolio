import test from "node:test";
import assert from "node:assert/strict";
import "../../src/shared/assets/app-shell-runtime.js";

const { createAppShellRuntime } = globalThis;

function withRuntimeGlobals(stub, fn) {
  const keys = ["window", "document", "localStorage", "location", "translations", "getTranslation", "applyTranslations"];
  const previous = Object.fromEntries(keys.map((key) => [key, globalThis[key]]));

  Object.assign(globalThis, stub);
  if (!globalThis.window) {
    globalThis.window = globalThis;
  }
  globalThis.dispatchEvent = globalThis.dispatchEvent || function() {};

  return Promise.resolve()
    .then(fn)
    .finally(() => {
      keys.forEach((key) => {
        if (typeof previous[key] === "undefined") delete globalThis[key];
        else globalThis[key] = previous[key];
      });
    });
}

test("app shell runtime keeps Korean UI with a stale English preference", async () => {
  const store = new Map([["lang", "en"]]);
  let htmlLang = "ko";
  const documentStub = {
    body: {
      classList: {
        add() {},
        remove() {},
        toggle() {
          return false;
        },
      },
    },
    documentElement: {
      classList: {
        add() {},
        remove() {},
        toggle() {},
      },
      setAttribute(name, value) {
        if (name === "lang") htmlLang = value;
      },
    },
    querySelectorAll() {
      return [];
    },
    getElementById() {
      return null;
    },
  };

  await withRuntimeGlobals(
    {
      translations: {
        ko: { hello: "안녕하세요" },
        en: { hello: "Hello" },
      },
      document: documentStub,
      localStorage: {
        getItem(key) {
          return store.has(key) ? store.get(key) : null;
        },
        setItem(key, value) {
          store.set(key, String(value));
        },
      },
      location: { pathname: "/en/", href: "", reload() {} },
    },
    async () => {
      const runtime = createAppShellRuntime();
      assert.equal(runtime.getCurrentLang(), "ko");
      assert.equal(htmlLang, "ko");
      assert.equal(globalThis.getTranslation("hello", "fallback"), "안녕하세요");
      assert.equal(globalThis.getTranslation("unknown", "fallback"), "fallback");
      assert.equal(typeof globalThis.setLanguage, "undefined");
      runtime.initShell();
    }
  );
});

test("app shell runtime keeps html and body theme classes synchronized", async () => {
  const store = new Map([["theme", "dark"]]);
  const bodyClasses = new Set();
  const htmlClasses = new Set();
  const themeButton = {};
  const createClassList = (classes) => ({
    add(name) {
      classes.add(name);
    },
    remove(name) {
      classes.delete(name);
    },
    toggle(name, force) {
      const enabled = typeof force === "boolean" ? force : !classes.has(name);
      if (enabled) classes.add(name);
      else classes.delete(name);
      return enabled;
    },
  });
  const documentStub = {
    body: { classList: createClassList(bodyClasses) },
    documentElement: {
      classList: createClassList(htmlClasses),
      setAttribute() {},
    },
    querySelectorAll() {
      return [];
    },
    getElementById(id) {
      return id === "color-change" ? themeButton : null;
    },
  };

  await withRuntimeGlobals(
    {
      document: documentStub,
      localStorage: {
        getItem(key) {
          return store.get(key) || null;
        },
        setItem(key, value) {
          store.set(key, String(value));
        },
      },
      location: { pathname: "/", href: "", reload() {} },
    },
    async () => {
      const runtime = createAppShellRuntime();
      runtime.initShell();
      assert.equal(bodyClasses.has("dark-mode"), true);
      assert.equal(htmlClasses.has("dark-mode"), true);

      themeButton.onclick();
      assert.equal(bodyClasses.has("dark-mode"), false);
      assert.equal(htmlClasses.has("dark-mode"), false);
      assert.equal(store.get("theme"), "light");
    }
  );
});
