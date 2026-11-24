import test from "node:test";
import assert from "node:assert/strict";

async function loadAccountErrorMessages() {
  return import(`../../src/domains/account/application/error-messages.js?ts=${Date.now()}`);
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

test("account error messages map password change errors", async () => {
  const m = await loadAccountErrorMessages();
  assert.equal(m.resolvePasswordChangeError({ code: "auth/wrong-password" }).key, "password_change_wrong_current");
  assert.equal(m.resolvePasswordChangeError({ code: "auth/invalid-credential" }).key, "password_change_wrong_current");
  assert.equal(m.resolvePasswordChangeError({ code: "auth/weak-password" }).key, "password_change_weak");
  assert.equal(m.resolvePasswordChangeError({ code: "auth/too-many-requests" }).key, "password_change_too_many");
  assert.equal(m.resolvePasswordChangeError({ code: "auth/network-request-failed" }).key, "password_change_network_error");
  assert.equal(m.resolvePasswordChangeError({ code: "unknown" }).key, "password_change_failed");
});
