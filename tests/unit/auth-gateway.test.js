import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as gateway from '../../src/domains/auth/infra/auth-gateway.js';
import * as boardGateway from '../../src/domains/board/application/authGateway.js';
import { CrewRepository } from '../../src/domains/stats/sudden-attack/infra/crew-repository.js';
import { SaDiscordClient } from '../../src/domains/stats/sudden-attack/infra/discord-client.js';

async function withWindow(window, run) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, writable: true, value: window });
  try { return await run(); } finally {
    if (previous) Object.defineProperty(globalThis, 'window', previous);
    else delete globalThis.window;
  }
}

test('shared gateway reads late initialization and later logout without caching the user', async () => {
  await withWindow({}, async () => {
    assert.equal(gateway.getCurrentUser(), null);
    let user = { uid: 'restored', getIdToken: async () => 'token' };
    window.AuthGateway = { getCurrentUser: () => user };
    assert.equal(gateway.getCurrentUser(), user);
    user = null;
    assert.equal(gateway.getCurrentUser(), null);
  });
});

test('explicit gateway null never falls back to stale SDK user or legacy profile', async () => {
  await withWindow({ AuthGateway: { getCurrentUser: () => null, getCurrentUserProfile: () => null },
    getCurrentUser() { assert.fail('legacy user must not be read'); },
    getCurrentUserProfile() { assert.fail('legacy profile must not be read'); },
    firebase: { auth() { assert.fail('SDK must not be read'); } },
  }, async () => {
    assert.equal(gateway.getCurrentUser(), null);
    assert.equal(gateway.getCurrentUserProfile(), null);
  });
});

test('legacy null is final even if the SDK still has a user', async () => {
  await withWindow({ getCurrentUser: () => null, firebase: { auth() { assert.fail('SDK fallback must not resurrect a user'); } } }, () => {
    assert.equal(gateway.getCurrentUser(), null);
  });
});

test('SDK-only compatibility preserves the original user and token method', async () => {
  const user = { uid: 'sdk-only', getIdToken() { assert.equal(this, user); return 'sdk-token'; } };
  await withWindow({ firebase: { auth: () => ({ currentUser: user }) } }, () => {
    assert.equal(gateway.getCurrentUser(), user);
    assert.equal(gateway.getCurrentUser().getIdToken(), 'sdk-token');
  });
});

test('readiness waits for actual restoration and auth requests preserve redirect and method receiver', async () => {
  let resolve;
  const ready = new Promise((done) => { resolve = done; });
  const calls = [];
  const facade = { waitForReady() { assert.equal(this, facade); return ready; },
    requireAuth(options) { assert.equal(this, facade); calls.push(options.redirectTo); return null; },
  };
  await withWindow({ AuthGateway: facade }, async () => {
    let finished = false;
    const waiting = gateway.waitAuthReady().then((user) => { finished = true; return user; });
    await Promise.resolve();
    assert.equal(finished, false);
    resolve({ uid: 'restored' });
    assert.equal((await waiting).uid, 'restored');
    assert.equal(await gateway.requireAuth({ redirectTo: '/board/edit?id=p1' }), null);
    assert.deepEqual(calls, ['/board/edit?id=p1']);
  });
});

test('legacy service initialization is lazy and reads the service after runtime loading', async () => {
  const service = { signOut() {} };
  let loads = 0;
  await withWindow({ ensureAuthRuntime: async () => { loads++; window.AuthService = service; } }, async () => {
    assert.equal(loads, 0);
    assert.equal(await gateway.getAuthService(), service);
    assert.equal(await gateway.getAuthService(), service);
    assert.equal(loads, 1);
  });
});

test('gateway service unavailability is final rather than choosing another auth service', async () => {
  await withWindow({ AuthGateway: { getAuthService: async () => null }, AuthService: { stale: true } }, async () => {
    assert.equal(await gateway.getAuthService(), null);
  });
});

test('gateway subscription is preferred and unsubscribes without a duplicate bus listener', async () => {
  let notify, removed = 0;
  await withWindow({ AuthGateway: { subscribe(listener) { notify = listener; return () => removed++; } },
    AuthStateBus: { subscribe() { assert.fail('must not subscribe twice'); } },
  }, async () => {
    const users = [];
    const unsubscribe = gateway.subscribeAuthState(({ user }) => users.push(user?.uid || null));
    notify({ user: { uid: 'member' }, profile: { nickname: 'Member' } });
    notify({ user: null, profile: null });
    unsubscribe();
    assert.deepEqual(users, ['member', null]);
    assert.equal(removed, 1);
  });
});

test('legacy bus subscription preserves profile-only updates and null logout', async () => {
  let notify;
  await withWindow({ AuthStateBus: { subscribe(listener) { notify = listener; return () => { notify = null; }; } } }, () => {
    const seen = [];
    const unsubscribe = gateway.subscribeAuthState((state) => seen.push(state));
    const update = { user: { uid: 'member' }, profile: { nickname: 'Renamed' } };
    notify(update);
    notify({ user: null, profile: null });
    unsubscribe();
    assert.equal(seen[0], update);
    assert.equal(seen[1].user, null);
    assert.equal(notify, null);
  });
});

test('DOM fallback preserves explicit null and removes the exact event listener', async () => {
  const events = new Map();
  await withWindow({ getCurrentUser: () => ({ uid: 'old' }),
    addEventListener: (name, fn) => events.set(name, fn),
    removeEventListener: (name, fn) => { assert.equal(events.get(name), fn); events.delete(name); },
  }, () => {
    const seen = [];
    const unsubscribe = gateway.subscribeAuthState((state) => seen.push(state));
    events.get('auth-state-changed')({ detail: { user: null, profile: null } });
    assert.equal(seen[0].user, null);
    unsubscribe();
    assert.equal(events.size, 0);
  });
});

test('non-browser callers receive a guest and a safe no-op unsubscribe', async () => {
  await withWindow(undefined, async () => {
    assert.equal(gateway.getCurrentUser(), null);
    assert.equal(gateway.getCurrentUserProfile(), null);
    assert.equal(await gateway.waitAuthReady(), null);
    assert.equal(await gateway.getAuthService(), null);
    assert.equal(await gateway.requireAuth(), null);
    gateway.subscribeAuthState(() => {})();
    gateway.subscribeAuthState(null)();
  });
});

test('legacy events without a snapshot read the current state instead of treating a member as a guest', async () => {
  let notify;
  const user = { uid: 'member' }, profile = { nickname: 'Member' };
  await withWindow({ getCurrentUser: () => user, getCurrentUserProfile: () => profile,
    addEventListener: (_name, listener) => { notify = listener; }, removeEventListener() {},
  }, () => {
    const seen = [];
    gateway.subscribeAuthState((state) => seen.push(state));
    notify({ detail: {} });
    assert.deepEqual(seen[0], { user, profile });
    notify({ detail: { user: null } });
    assert.deepEqual(seen[1], { user: null, profile: null });
  });
});

test('board compatibility exports share the same implementation', () => {
  for (const key of Object.keys(gateway)) assert.equal(boardGateway[key], gateway[key]);
});

test('writer role resets on explicit null even while fallback getters contain an old admin', () => {
  const source = readFileSync('src/domains/board/write/main.js', 'utf8');
  const start = source.indexOf('function applyWriteFormRole(');
  const end = source.indexOf('function showError(');
  let state;
  const context = { getCurrentUser() { assert.fail('must not read stale user'); },
    getCurrentUserProfile() { assert.fail('must not read stale admin profile'); },
    resolveBoardRole: (value) => { state = value; return 'free'; },
  };
  vm.createContext(context);
  vm.runInContext(source.slice(start, end), context);
  context.applyWriteFormRole({ setAttribute() {} }, { user: null, profile: null });
  assert.equal(state.user, null);
  assert.equal(state.profile, null);
});

test('crew staff reads the shared user, preserves whitelist and honors explicit logout', async () => {
  const staff = { uid: 'staff', email: 'demo-9249b6f9@example.com' };
  await withWindow({ AuthGateway: { getCurrentUser: () => staff } }, () => {
    const repo = new CrewRepository(null);
    assert.equal(repo.isStaff(), true);
    assert.equal(Boolean(repo.isStaff(null)), false);
    assert.equal(Boolean(repo.isStaff({ email: 'ordinary@example.test', role: 'admin' })), false);
  });
});

test('Discord client uses the shared users real token and never sends when signed out', async () => {
  const originalFetch = globalThis.fetch;
  const sent = [];
  let user = { uid: 'staff', getIdToken: async () => 'test-id-token' };
  globalThis.fetch = async (url, options) => { sent.push({ url, options }); return { ok: true, json: async () => ({ ok: true }) }; };
  try {
    await withWindow({ AuthGateway: { getCurrentUser: () => user } }, async () => {
      const client = new SaDiscordClient();
      const match = { matchResult: 'WIN', matchId: 'm1', mapName: 'map', allPlayerStats: [] };
      await client.notifyMatchSettled(match, []);
      assert.equal(sent.length, 1);
      assert.equal(sent[0].options.headers.Authorization, 'Bearer test-id-token');
      user = null;
      await client.notifyMatchSettled(match, []);
      assert.equal(sent.length, 1);
    });
  } finally { globalThis.fetch = originalFetch; }
});
