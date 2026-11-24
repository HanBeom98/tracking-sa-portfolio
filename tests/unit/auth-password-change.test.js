import assert from "node:assert/strict";
import test from "node:test";

import { buildAuthService } from "../../src/domains/auth/application/authService.js";
import { createFirebaseAuthRepository } from "../../src/domains/auth/infra/firebaseAuthRepository.js";

test("auth service delegates password changes to the repository", async () => {
  const calls = [];
  const authService = buildAuthService({
    authRepository: {
      changePassword(payload) {
        calls.push(payload);
        return Promise.resolve();
      },
    },
  });

  await authService.changePassword({
    currentPassword: "old-password",
    newPassword: "new-password",
  });

  assert.deepEqual(calls, [{
    currentPassword: "old-password",
    newPassword: "new-password",
  }]);
});

test("firebase auth repository reauthenticates before updating the password", async () => {
  const calls = [];
  const user = {
    email: "user@example.com",
    async reauthenticateWithCredential(credential) {
      calls.push(["reauthenticate", credential]);
    },
    async updatePassword(password) {
      calls.push(["updatePassword", password]);
    },
  };
  const authInstance = { currentUser: user };
  const authFactory = () => authInstance;
  authFactory.EmailAuthProvider = {
    credential(email, password) {
      return { email, password };
    },
  };
  const repository = createFirebaseAuthRepository({
    firebaseApp: { auth: authFactory },
    db: { collection: () => ({}) },
  });

  await repository.changePassword({
    currentPassword: "old-password",
    newPassword: "new-password",
  });

  assert.deepEqual(calls, [
    ["reauthenticate", { email: "user@example.com", password: "old-password" }],
    ["updatePassword", "new-password"],
  ]);
});
