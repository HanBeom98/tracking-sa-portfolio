import test from "node:test";
import assert from "node:assert/strict";
import "../../src/shared/assets/app-shell-runtime.js";

const { createAppShellRuntime } = globalThis;

function withRuntimeGlobals(stub, fn) {
  const keys = ["window", "document", "localStorage", "location", "translations", "getTranslation", "applyTranslations", "setLanguage"];
  const previous = Object.fromEntries(keys.map((key) => [key, globalThis[key]]));

  Object.assign(globalThis, stub);
  if (!globalThis.window) {
    globalThis.window = globalThis;
  }

  return Promise.resolve()
    .then(fn)
    .finally(() => {
      keys.forEach((key) => {
        if (typeof previous[key] === "undefined") delete globalThis[key];
        else globalThis[key] = previous[key];
      });
    });
}

test("app shell runtime initializes language and translation globals", async () => {
  const store = new Map();
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
      location: { pathname: "/en/news/", href: "", reload() {} },
    },
    async () => {
      const runtime = createAppShellRuntime();
      assert.equal(runtime.getCurrentLang(), "en");
      assert.equal(htmlLang, "en");
      assert.equal(globalThis.getTranslation("hello", "fallback"), "Hello");
      assert.equal(globalThis.getTranslation("unknown", "fallback"), "fallback");
      runtime.initShell();
    }
  );
});
