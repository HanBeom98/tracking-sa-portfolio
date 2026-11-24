import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("mobile header exposes an accessible collapsible navigation", () => {
  const header = fs.readFileSync("src/shared/ui/header.html", "utf8");
  const styles = fs.readFileSync("src/shared/assets/style.css", "utf8");
  const runtime = fs.readFileSync("src/shared/assets/app-shell-runtime.js", "utf8");

  assert.match(header, /class="mobile-menu-toggle"/);
  assert.match(header, /aria-controls="primary-navigation"/);
  assert.match(styles, /header\.mobile-nav-open \.desktop-menu-container/);
  assert.match(styles, /--header-h: 56px/);
  assert.match(runtime, /function initMobileNavigation\(\)/);
  assert.match(runtime, /initMobileNavigation\(\);/);
});
