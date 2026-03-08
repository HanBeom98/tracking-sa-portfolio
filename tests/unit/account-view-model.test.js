import test from "node:test";
import assert from "node:assert/strict";

import { t, formatProvider, getAccountViewModel } from "../../src/domains/account/application/account-view-model.js";

test("account view-model translation helper falls back without globals", () => {
  const prev = globalThis.getTranslation;
  const prevWindow = globalThis.window;
  try {
    delete globalThis.getTranslation;
    delete globalThis.window;
    assert.equal(t("k", "fallback"), "fallback");
  } finally {
    if (typeof prev === "undefined") delete globalThis.getTranslation;
    else globalThis.getTranslation = prev;
    if (typeof prevWindow === "undefined") delete globalThis.window;
    else globalThis.window = prevWindow;
  }
});

test("account view-model translation helper prefers global translator", () => {
  const prev = globalThis.getTranslation;
  const prevWindow = globalThis.window;
  try {
    globalThis.getTranslation = (key) => `tr:${key}`;
    globalThis.window = {
      getTranslation: () => "window-only",
    };
    assert.equal(t("account_provider_email", "이메일"), "tr:account_provider_email");
    assert.equal(formatProvider(["password"]), "tr:account_provider_email");
  } finally {
    if (typeof prev === "undefined") delete globalThis.getTranslation;
    else globalThis.getTranslation = prev;
    if (typeof prevWindow === "undefined") delete globalThis.window;
    else globalThis.window = prevWindow;
  }
});

test("account view-model maps user/profile into render fields", () => {
  const vm = getAccountViewModel(
    {
      displayName: "User1",
      providerData: [{ providerId: "google.com" }],
    },
    {
      role: "admin",
      nickname: "닉네임",
      subscription: { status: "active", planName: "pro", renewAt: "2026-03-08T00:00:00Z" },
    }
  );

  assert.equal(vm.isAdmin, true);
  assert.equal(vm.nickname, "닉네임");
  assert.equal(vm.subscriptionStatus, "active");
  assert.equal(vm.subscriptionPlan, "pro");
  assert.equal(vm.subscriptionRenewAt, "2026-03-08T00:00:00Z");
});
