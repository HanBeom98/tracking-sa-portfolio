import test from "node:test";
import assert from "node:assert/strict";
import { escapeHtml } from "../../src/domains/board/domain/html.js";

test("board HTML escaping neutralizes executable markup", () => {
  assert.equal(
    escapeHtml('<img src=x onerror="alert(1)"> & \'quoted\''),
    "&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; &#39;quoted&#39;",
  );
});

test("board HTML escaping handles empty values", () => {
  assert.equal(escapeHtml(null), "");
  assert.equal(escapeHtml(undefined), "");
});
