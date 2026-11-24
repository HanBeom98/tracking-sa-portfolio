import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("common runtime versions dynamically loaded shared scripts", () => {
  const common = fs.readFileSync("src/shared/assets/common.js", "utf8");
  const templates = fs.readFileSync("src/shared/infra/templates.py", "utf8");

  assert.match(common, /function withCommonAssetVersion\(src\)/);
  assert.match(common, /script\.src = withCommonAssetVersion\(scriptSrc\)/);
  assert.match(templates, /scriptSrc:/);
  assert.match(templates, /specifier\.lstrip\("\/"\)/);
});
