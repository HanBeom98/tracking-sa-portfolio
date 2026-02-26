import test from "node:test";
import assert from "node:assert/strict";
import { buildLuckyPayload } from "../../src/domains/lucky-recommendation/application/lucky-payload.js";

test("lucky payload builder maps user info and current date", () => {
  const now = new Date("2026-02-26T09:10:11Z");
  const payload = buildLuckyPayload({
    name: "Tracking",
    month: "2",
    day: "26",
    gender: "male",
    language: "ko",
    now,
  });

  assert.equal(payload.language, "ko");
  assert.equal(payload.userInfo.name, "Tracking");
  assert.equal(payload.userInfo.birthMonth, "2");
  assert.equal(payload.userInfo.birthDay, "26");
  assert.equal(payload.currentDate.year, 2026);
  assert.equal(payload.currentDate.month, 2);
  assert.equal(payload.currentDate.day, 26);
});
