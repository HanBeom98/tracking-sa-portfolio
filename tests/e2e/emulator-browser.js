import fs from "node:fs/promises";
import path from "node:path";
import { expect } from "@playwright/test";

export const projectId = "demo-trackingsa-ownership";
export const firestoreBase = "http://127.0.0.1:8085/v1/projects/" + projectId + "/databases/(default)/documents";
export const password = "Local-only-12345";
const sdkRoot = path.resolve("tests/e2e/sdk/node_modules/firebase");
const scripts = new Set(["firebase-app.js", "firebase-app-check.js", "firebase-auth.js", "firebase-firestore.js", "firebase-storage.js"]);
const localOrigins = new Set(["http://127.0.0.1:4173", "http://127.0.0.1:8085", "http://127.0.0.1:9098", "http://127.0.0.1:9198"]);

async function localRequest(url, options) {
  if (!localOrigins.has(new URL(url).origin)) throw new Error("Emulator requests must stay on fixed loopback ports");
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error("Emulator " + response.status + ": " + await response.text());
  return response.json();
}

export async function resetEmulators() {
  await localRequest("http://127.0.0.1:9098/emulator/v1/projects/" + projectId + "/accounts", { method: "DELETE" });
  await localRequest("http://127.0.0.1:8085/emulator/v1/projects/" + projectId + "/databases/(default)/documents", { method: "DELETE" });
}

export async function createAccount(name, { admin = false, email = name + "@example.test" } = {}) {
  const account = await localRequest("http://127.0.0.1:9098/identitytoolkit.googleapis.com/v1/accounts:signUp?key=local-demo-key", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  if (admin) {
    // Fixture provisioning only. Browser reads/writes use the real signed-in client.
    await localRequest(firestoreBase + "/users/" + account.localId, {
      method: "PATCH", headers: { Authorization: "Bearer owner", "Content-Type": "application/json" },
      body: JSON.stringify({ fields: {
        uid: { stringValue: account.localId }, email: { stringValue: email }, nickname: { stringValue: "" },
        displayName: { stringValue: "" }, photoURL: { stringValue: "" }, role: { stringValue: "admin" },
        subscription: { mapValue: { fields: { status: { stringValue: "free" } } } },
      } }),
    });
  }
  return { email, uid: account.localId };
}

export async function installEmulatorBrowser(context) {
  const sdk = JSON.parse(await fs.readFile(path.join(sdkRoot, "package.json"), "utf8"));
  if (sdk.version !== "8.10.1") throw new Error("Use the production Firebase SDK version");
  const config = { apiKey: "local-demo-key", authDomain: projectId + ".firebaseapp.com", projectId, storageBucket: projectId + ".appspot.com", appId: "local-demo-app" };
  // Pin the inline config before any page script, including deferred-auth pages.
  await context.addInitScript((demoConfig) => {
    if (location.origin !== 'http://127.0.0.1:4173') return;
    Object.defineProperty(window, 'FIREBASE_CONFIG', {
      configurable: true, get: () => demoConfig, set() {},
    });
  }, config);
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    const filename = path.posix.basename(url.pathname);
    if (url.origin === "https://www.gstatic.com" && url.pathname === "/firebasejs/8.10.1/" + filename && scripts.has(filename)) {
      return route.fulfill({ contentType: "text/javascript", body: await fs.readFile(path.join(sdkRoot, filename), "utf8") });
    }
    // Home uses public Firestore REST instead of the SDK. Fulfill only this demo
    // project's exact query endpoint from the same fixed loopback emulator.
    if (url.origin === 'https://firestore.googleapis.com'
      && url.pathname === `/v1/projects/${projectId}/databases/(default)/documents:runQuery`) {
      return route.fulfill({ response: await route.fetch({ url: 'http://127.0.0.1:8085' + url.pathname + url.search }) });
    }
    if (!localOrigins.has(url.origin)) return route.abort();
    if (url.origin === "http://127.0.0.1:4173" && url.pathname === "/firebase-config.js") {
      const source = await fs.readFile("public/firebase-config.js", "utf8");
      const connect = "window.auth.useEmulator('http://127.0.0.1:9098', { disableWarnings: true }); window.db.useEmulator('127.0.0.1', 8085); if (window.storage) window.storage.useEmulator('127.0.0.1', 9198);";
      return route.fulfill({ contentType: "text/javascript", body: "window.FIREBASE_CONFIG = " + JSON.stringify(config) + ";\n" + source + "\n" + connect });
    }
    return route.continue();
  });
}

export async function login(page, account) {
  await page.goto("/account/");
  await page.locator("#account-login-btn").click();
  await page.locator("#inline-login-email").fill(account.email);
  await page.locator("#inline-login-password").fill(password);
  await page.locator("#inline-login-email-submit").click();
  // Auth state can render the account view without a full-page navigation.
  // Check the intended user as well as the UI so a prior session cannot pass.
  await expect.poll(() => page.evaluate(() => window.getCurrentUser?.()?.uid).catch(() => null)).toBe(account.uid);
  await expect(page.locator("#global-inline-login-modal")).not.toBeVisible();
  await expect(page.locator("#nickname")).toBeVisible();
}

export async function setNickname(page, nickname) {
  await page.goto("/account/");
  await page.locator("#nickname").fill(nickname);
  await page.locator("#nickname-check").click();
  await page.locator("#nickname-status").filter({ hasText: /사용.*가능/ }).waitFor();
  await page.locator("#profile-save").click();
  await page.locator("#profile-status").filter({ hasText: "저장되었습니다" }).waitFor();
}

export async function readCollection(page, collection) {
  return page.evaluate(async (name) => {
    const snapshot = await window.db.collection(name).get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }, collection);
}

export async function writePost(page, { category = "free", title = "로컬 통합 검증", content = "테스트 내용" } = {}) {
  await page.goto("/board/write/?category=" + category);
  const form = page.locator("board-write-form");
  await form.locator("#title").fill(title);
  await form.locator("[data-editor]").fill(content);
  page.once("dialog", (dialog) => dialog.accept());
  await form.locator("#submit-button").click();
  await page.waitForURL((url) => url.pathname === "/board");
  return (await readCollection(page, "board_posts"))[0];
}

export async function logout(page) {
  const accountPage = /^\/account\/?$/.test(new URL(page.url()).pathname);
  if (accountPage) {
    await page.locator("#auth-logout").click();
    await page.locator("#account-login-btn").waitFor();
  } else {
    await page.locator("#auth-logout").click();
    await page.waitForFunction(() => window.getCurrentUser?.() === null);
  }
}
