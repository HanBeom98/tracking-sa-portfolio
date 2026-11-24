import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveBoardRole,
  shouldShowNoticeCategory,
} from "../../src/domains/board/application/admin-role.js";

test("board role resolves an admin profile from the auth state event", () => {
  assert.equal(
    resolveBoardRole({
      user: { uid: "admin-user", email: "member@example.com" },
      profile: { role: "admin" },
    }),
    "admin"
  );
});

test("notice category remains visible on the requested notice write route", () => {
  assert.equal(
    shouldShowNoticeCategory({ role: "free", initialCategory: "notice" }),
    true
  );
  assert.equal(
    shouldShowNoticeCategory({ role: "free", initialCategory: "free" }),
    false
  );
});
