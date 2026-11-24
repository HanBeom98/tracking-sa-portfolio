export function testAccess(overrides = {}) {
  return { id: 'test-oct25-nov25', startsAt: Date.parse('2026-10-25T00:00:00Z'),
    endsAt: Date.parse('2026-11-25T00:00:00Z'), successLimit: 2, attemptLimit: 20, ...overrides };
}
export function testAccessEnv() {
  const access = testAccess();
  return { REPLAY_COACHING_TEST_PERIOD_ID: access.id, REPLAY_COACHING_TEST_PERIOD_START: new Date(access.startsAt).toISOString(),
    REPLAY_COACHING_TEST_PERIOD_END: new Date(access.endsAt).toISOString(),
    REPLAY_COACHING_USER_LIMIT: String(access.successLimit), REPLAY_COACHING_ATTEMPT_LIMIT: String(access.attemptLimit) };
}
