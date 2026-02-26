import test from "node:test";
import assert from "node:assert/strict";
import "../../src/shared/assets/auth-action-handlers.js";

const { createAuthActionHandlers } = globalThis;

test("auth action handlers signInWithEmail validates required fields", async () => {
  const handlers = createAuthActionHandlers({
    getAuthService: async () => ({ signInWithEmail: async () => {} }),
  });

  let validationMessage = "";
  const ok = await handlers.signInWithEmail(
    { email: "", password: "" },
    {
      onValidationError(message) {
        validationMessage = message;
      },
    }
  );

  assert.equal(ok, false);
  assert.ok(validationMessage.length > 0);
});

test("auth action handlers signInWithProvider invokes success callback", async () => {
  let called = false;
  const handlers = createAuthActionHandlers({
    getAuthService: async () => ({
      signInWithProvider: async () => {},
    }),
  });

  const ok = await handlers.signInWithProvider("google", {
    onSuccess() {
      called = true;
    },
  });

  assert.equal(ok, true);
  assert.equal(called, true);
});

test("auth action handlers signOut returns false when auth service missing", async () => {
  const handlers = createAuthActionHandlers({
    getAuthService: async () => null,
  });

  const ok = await handlers.signOut();
  assert.equal(ok, false);
});
