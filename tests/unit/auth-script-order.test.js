import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("eager auth pages initialize Firebase before booting the auth domain", () => {
  const head = fs.readFileSync("src/shared/ui/head.html", "utf8");
  const firebaseConfigIndex = head.indexOf('src="/firebase-config.js"');
  const authClientIndex = head.indexOf('src="/auth/ui/auth-client.js"');

  assert.notEqual(firebaseConfigIndex, -1);
  assert.notEqual(authClientIndex, -1);
  assert.ok(
    firebaseConfigIndex < authClientIndex,
    "firebase-config.js must execute before auth-client.js",
  );
});
