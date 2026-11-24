import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("inline login modal closes only when pointer press and release both occur on the backdrop", () => {
  const source = fs.readFileSync("src/shared/assets/inline-login-modal.js", "utf8");

  assert.match(source, /modal\.addEventListener\("pointerdown"/);
  assert.match(source, /backdropPointerDown = event\.target === modal/);
  assert.match(source, /modal\.addEventListener\("pointerup"/);
  assert.match(source, /backdropPointerUp = event\.target === modal/);
  assert.match(
    source,
    /if \(backdropPointerDown && backdropPointerUp && event\.target === modal\)/
  );
});

test("inline login modal submits email login when Enter is pressed in the password field", () => {
  const source = fs.readFileSync("src/shared/assets/inline-login-modal.js", "utf8");

  assert.match(source, /const submitEmailLogin = async \(\) =>/);
  assert.match(source, /emailBtn\.onclick = submitEmailLogin/);
  assert.match(source, /passwordEl\.onkeydown = \(event\) =>/);
  assert.match(source, /event\.key !== "Enter" \|\| event\.isComposing/);
  assert.match(source, /event\.preventDefault\(\)/);
  assert.match(source, /submitEmailLogin\(\)/);
});
