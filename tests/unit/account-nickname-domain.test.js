import test from "node:test";
import assert from "node:assert/strict";

async function loadNicknameDomain() {
  return import(`../../src/domains/account/domain/nickname.js?ts=${Date.now()}`);
}

test("account nickname domain normalizes and validates nickname", async () => {
  const nickname = await loadNicknameDomain();

  assert.equal(nickname.normalizeNickname("  Tracking_SA "), "tracking_sa");
  assert.equal(nickname.validateNickname("트래킹"), true);
  assert.equal(nickname.validateNickname("a"), false);
  assert.equal(nickname.validateNickname("invalid-name!"), false);
});

test("account nickname cooldown info is generated when timestamp exists", async () => {
  const nickname = await loadNicknameDomain();

  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;
  const cooldown = nickname.getNicknameCooldownInfo({ toMillis: () => oneHourAgo });

  assert.ok(cooldown);
  assert.ok(cooldown.nextAt > now);
  assert.ok(cooldown.remainingMs > 0);
});
