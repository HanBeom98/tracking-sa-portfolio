import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("auth initialization always applies the final guest state to header controls", () => {
  const source = fs.readFileSync("src/shared/assets/common.js", "utf8");
  const guardedUpdates = source.match(
    /const currentUser = sessionRuntime\.getCurrentUser\(\);\s+if \(window\.updateAuthControls\) \{\s+window\.updateAuthControls\(currentUser\);\s+\}/g
  ) || [];

  assert.equal(guardedUpdates.length, 2);
  assert.doesNotMatch(source, /if \(currentUser && window\.updateAuthControls\)/);
});
