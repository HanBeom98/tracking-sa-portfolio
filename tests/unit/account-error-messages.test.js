import test from "node:test";
import assert from "node:assert/strict";

async function loadAccountErrorMessages() {
  globalThis.window = {};
  await import(`../../src/domains/account/application/error-messages.js?ts=${Date.now()}`);
  return globalThis.window.AccountDomain.errorMessages;
}

test("account error messages map profile save errors", async () => {
  const m = await loadAccountErrorMessages();
  assert.equal(m.resolveProfileSaveError({ code: "auth/nickname-taken" }).key, "nickname_taken");
  assert.equal(m.resolveProfileSaveError({ code: "auth/invalid-nickname" }).key, "nickname_invalid");
  assert.equal(m.resolveProfileSaveError({ code: "auth/nickname-cooldown" }).key, "nickname_cooldown");
  assert.equal(m.resolveProfileSaveError({ code: "auth/not-authenticated" }).key, "account_profile_auth_required");
  assert.equal(m.resolveProfileSaveError({ code: "auth/service-unavailable" }).key, "account_profile_service_unavailable");
});

test("account error messages map delete account errors", async () => {
  const m = await loadAccountErrorMessages();
  assert.equal(m.resolveDeleteAccountError({ code: "auth/requires-recent-login" }).key, "delete_account_requires_recent_login");
  assert.equal(m.resolveDeleteAccountError({ code: "auth/password-required" }).key, "delete_account_password_prompt");
  assert.equal(m.resolveDeleteAccountError({ code: "auth/not-authenticated" }).key, "account_delete_auth_required");
  assert.equal(m.resolveDeleteAccountError({ code: "auth/service-unavailable" }).key, "account_delete_service_unavailable");
  assert.equal(m.resolveDeleteAccountError({ code: "unknown" }).key, "delete_account_failed");
});
