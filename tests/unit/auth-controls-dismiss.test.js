import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("header auth controls do not close when a pointer drag starts inside", () => {
  const source = fs.readFileSync("src/shared/assets/auth-controls.js", "utf8");

  assert.match(source, /document\.addEventListener\("pointerdown"/);
  assert.match(source, /if \(!container\.contains\(event\.target\)\)/);
  assert.doesNotMatch(source, /document\.addEventListener\("click"/);
});
