import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generateKeyPairSync, sign } from 'node:crypto';
import { PROFILE_ADMIN_EMAILS, SITE_ADMIN_EMAILS, SA_MODERATOR_EMAILS, SA_STAFF_EMAILS } from '../../src/domains/auth/domain/access-policy.js';
import { ADMIN_EMAILS } from '../../src/domains/auth/domain/roles.js';
import { resolveBoardRole, isAdminEmail } from '../../src/domains/board/application/admin-role.js';
import { CrewRepository } from '../../src/domains/stats/sudden-attack/infra/crew-repository.js';
import { createFirebaseAuthRepository } from '../../src/domains/auth/infra/firebaseAuthRepository.js';
import { createTransactionalFirestore } from '../helpers/transactional-firestore.js';
import { requireStaffToken } from '../../functions/security/firebase-id-token.js';
import { NOTICE_DURATION_MS, NOTICE_DISPLAY_LIMIT, getNoticeCreatedAtMs } from '../../src/domains/board/domain/notice-policy.js';
import { getPostCreatedAtMs, isActivePinnedNotice } from '../../src/domains/board/domain/noticePinning.js';
import { getActiveHomeNotices, readHomeNoticeCache, writeHomeNoticeCache, HOME_NOTICE_CACHE_TTL_MS } from '../../src/domains/home/notice-ticker.js';
import { readBoardListCache, writeBoardListCache, clearBoardListCache, BOARD_LIST_CACHE_TTL_MS } from '../../src/domains/board/application/board-list-cache.js';
import { readCommentListCache, writeCommentListCache, COMMENT_LIST_CACHE_TTL_MS } from '../../src/domains/board/application/comment-list-cache.js';
import { getHomeNoticeCacheKey } from '../../src/domains/board/domain/content-cache-policy.js';
import { buildPostService } from '../../src/domains/board/application/postService.js';

function storageFixture() {
  const values = new Map();
  return { get length() { return values.size; }, key: (index) => [...values.keys()][index] ?? null,
    getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}
function restNotice(id, createdAt) {
  return { document: { name: `projects/test/databases/(default)/documents/board_posts/${id}`, fields: {
    title: { stringValue: id }, category: { stringValue: 'notice' }, createdAt: { timestampValue: new Date(createdAt).toISOString() },
  } } };
}

test('automatic profile admins, site admins and league staff retain distinct scopes', () => {
  assert.equal(ADMIN_EMAILS, PROFILE_ADMIN_EMAILS);
  assert.equal(PROFILE_ADMIN_EMAILS.length, 1);
  assert.equal(SITE_ADMIN_EMAILS.length, 2);
  assert.equal(SA_MODERATOR_EMAILS.length, 3);
  assert.equal(SA_STAFF_EMAILS.length, 5);
  const repo = new CrewRepository(null);
  for (const email of SA_STAFF_EMAILS) {
    assert.equal(repo.isStaff({ email }), true);
    assert.equal(resolveBoardRole({ user: { email }, profile: { role: 'free' } }), SITE_ADMIN_EMAILS.includes(email) ? 'admin' : 'free');
  }
  assert.equal(repo.isStaff({ email: 'member@example.test', role: 'admin' }), false);
  assert.equal(resolveBoardRole({ user: { email: 'member@example.test' }, profile: { role: 'admin' } }), 'admin');
});

test('site email normalization and case-sensitive league UI behavior remain unchanged', () => {
  assert.equal(isAdminEmail(' DEMO-9249B6F9@EXAMPLE.COM '), true);
  assert.equal(new CrewRepository(null).isStaff({ email: 'DEMO-9249B6F9@EXAMPLE.COM' }), false);
  assert.equal(isAdminEmail(SA_MODERATOR_EMAILS[0]), false);
});

test('profile creation auto-promotes only the original bootstrap administrator', async () => {
  for (const [index, email] of [...SA_STAFF_EMAILS, 'member@example.test'].entries()) {
    const db = createTransactionalFirestore();
    const user = { uid: `u${index}`, email, displayName: '', photoURL: '', updateProfile: async () => {} };
    const repository = createFirebaseAuthRepository({ db, firebaseApp: { auth: () => ({ currentUser: user }) } });
    const profile = await repository.ensureUserProfile(user);
    assert.equal(profile.role, PROFILE_ADMIN_EMAILS.includes(email) ? 'admin' : 'free', email);
  }
});

test('shared email policy collections cannot be mutated by a caller', () => {
  for (const list of [PROFILE_ADMIN_EMAILS, SITE_ADMIN_EMAILS, SA_MODERATOR_EMAILS, SA_STAFF_EMAILS]) {
    assert.throws(() => list.push('unexpected@example.test'), TypeError);
  }
});

function ruleHelper(source, name) {
  const match = source.match(new RegExp(`function ${name}\\(\\)\\s*\\{([\\s\\S]*?)\\n\\s*\\}`));
  assert.ok(match, `Missing rule helper ${name}`);
  return match[1];
}
function emailChecks(source) {
  return [...source.matchAll(/request\.auth\.token\.email\s*==\s*["']([^"']+)["']/g)].map((match) => match[1]).sort();
}
test('Firestore and Storage role scopes cannot drift from the shared policy', () => {
  const firestore = readFileSync('firestore.rules', 'utf8'), storage = readFileSync('storage.rules', 'utf8');
  for (const [source, helper, emails] of [
    [firestore, 'isStaff', SITE_ADMIN_EMAILS], [firestore, 'isAdminEmail', SITE_ADMIN_EMAILS],
    [firestore, 'isSaStaff', SA_MODERATOR_EMAILS], [storage, 'isStaff', SITE_ADMIN_EMAILS],
  ]) assert.deepEqual(emailChecks(ruleHelper(source, helper)), [...emails].sort());
  assert.match(ruleHelper(firestore, 'isStaff'), /\.data\.role == "admin"/);
  assert.match(ruleHelper(storage, 'isStaff'), /\.data\.role == "admin"/);
  assert.doesNotMatch(ruleHelper(firestore, 'isSaStaff'), /\.data\.role/);
});

test('server staff token verification retains all five staff emails and rejects role-only forgery', async () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'policy-fixture-key', alg: 'RS256', use: 'sig' };
  const previousFetch = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async () => { requests++; return { ok: true, headers: new Headers({ 'cache-control': 'max-age=3600' }), json: async () => ({ keys: [jwk] }) }; };
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const request = (email, extra = {}) => {
    const now = Math.floor(Date.now() / 1000);
    const body = `${encode({ alg: 'RS256', kid: jwk.kid })}.${encode({ sub: 'local-fixture', email, aud: 'demo-tracking-sa-portfolio', iss: 'https://securetoken.google.com/demo-tracking-sa-portfolio', iat: now, exp: now + 300, ...extra })}`;
    return new Request('https://example.test/local-only', { headers: { Authorization: `Bearer ${body}.${sign('RSA-SHA256', Buffer.from(body), privateKey).toString('base64url')}` } });
  };
  try {
    for (const email of SA_STAFF_EMAILS) assert.equal((await requireStaffToken(request(email))).email, email);
    assert.equal((await requireStaffToken(request(' DEMO-9249B6F9@EXAMPLE.COM '))).sub, 'local-fixture');
    await assert.rejects(requireStaffToken(request('member@example.test', { role: 'admin' })), /Staff authorization required/);
    await assert.rejects(requireStaffToken(request(SITE_ADMIN_EMAILS[0], { aud: 'foreign-project' })), /audience/);
    assert.equal(requests, 1);
  } finally { globalThis.fetch = previousFetch; }
});

test('notice timestamps share one schema across SDK, serialized cache, Date, string and milliseconds', () => {
  const now = Date.UTC(2026, 9, 22), created = now - NOTICE_DURATION_MS + 1;
  for (const value of [created, new Date(created), new Date(created).toISOString(), { toMillis: () => created }, { seconds: created / 1000 }]) {
    assert.equal(getNoticeCreatedAtMs(value), created);
    assert.equal(getPostCreatedAtMs({ createdAt: value }), created);
    assert.equal(isActivePinnedNotice({ category: 'notice', createdAt: value }, now), true);
    assert.equal(isActivePinnedNotice({ category: 'notice', createdAt: value }, now + 1), false);
  }
  for (const value of [null, {}, 'invalid', NaN, { toMillis: () => NaN }]) assert.equal(getNoticeCreatedAtMs(value), null);
});

test('home and board expire notices at exactly the same 14-day boundary', () => {
  const now = Date.UTC(2026, 9, 22), created = now - NOTICE_DURATION_MS;
  assert.equal(isActivePinnedNotice({ category: 'notice', createdAt: new Date(created) }, now), false);
  assert.deepEqual(getActiveHomeNotices([restNotice('expired', created)], now), []);
  const storage = storageFixture();
  writeHomeNoticeCache([{ id: 'last', createdAt: created + 1 }], { projectId: 'p', storage, nowMs: now });
  assert.equal(readHomeNoticeCache({ projectId: 'p', storage, nowMs: now }).length, 1);
  assert.deepEqual(readHomeNoticeCache({ projectId: 'p', storage, nowMs: now + 1 }), []);
});

test('home and board still request at most five notices', async () => {
  const now = Date.now();
  assert.equal(NOTICE_DISPLAY_LIMIT, 5);
  assert.equal(getActiveHomeNotices(Array.from({ length: 8 }, (_, index) => restNotice(`n${index}`, now - index)), now).length, 5);
  const calls = [];
  const service = buildPostService({ postRepository: { list: async (query) => { calls.push(query); return []; } } });
  await service.listPosts({ category: 'free', limit: 30 });
  assert.deepEqual(calls, [{ limit: 5, category: 'notice' }, { limit: 30, category: 'free' }]);
});

test('missing or malformed expiration metadata cannot become an unlimited comment or home cache', () => {
  const storage = storageFixture();
  for (const expiresAt of [undefined, null, '999999', 'invalid']) {
    storage.setItem('board-comments:v2:p', JSON.stringify({ expiresAt, comments: [{ id: 'stale' }] }));
    storage.setItem(getHomeNoticeCacheKey('p'), JSON.stringify({ expiresAt, notices: [{ id: 'stale', createdAt: 1000 }] }));
    assert.equal(readCommentListCache({ postId: 'p', storage, now: 1001 }), null);
    assert.equal(readHomeNoticeCache({ projectId: 'p', storage, nowMs: 1001 }), null);
    assert.equal(storage.getItem('board-comments:v2:p'), null);
    assert.equal(storage.getItem(getHomeNoticeCacheKey('p')), null);
  }
});

test('cache durations and exact expiry boundaries retain the existing public contract', () => {
  assert.deepEqual([BOARD_LIST_CACHE_TTL_MS, COMMENT_LIST_CACHE_TTL_MS, HOME_NOTICE_CACHE_TTL_MS], [300000, 60000, 600000]);
  const storage = storageFixture();
  writeBoardListCache([{ id: 'board' }], { storage, now: 1000 });
  writeCommentListCache([{ id: 'comment' }], { postId: 'p', storage, now: 1000 });
  writeHomeNoticeCache([{ id: 'notice', createdAt: 1000 }], { projectId: 'p', storage, nowMs: 1000 });
  assert.equal(readBoardListCache({ storage, now: 300999 }).length, 1);
  assert.equal(readBoardListCache({ storage, now: 301000 }), null);
  assert.equal(readCommentListCache({ postId: 'p', storage, now: 60999 }).length, 1);
  assert.equal(readCommentListCache({ postId: 'p', storage, now: 61000 }), null);
  assert.equal(readHomeNoticeCache({ projectId: 'p', storage, nowMs: 600999 }).length, 1);
  assert.equal(readHomeNoticeCache({ projectId: 'p', storage, nowMs: 601000 }), null);
});

test('board mutations invalidate each project home cache while retaining comments and unrelated settings', () => {
  const storage = storageFixture();
  for (const projectId of ['first', 'second']) writeHomeNoticeCache([{ id: 'n', createdAt: 1000 }], { projectId, storage, nowMs: 1000 });
  writeBoardListCache([{ id: 'b' }], { storage, now: 1000 });
  writeCommentListCache([{ id: 'c' }], { postId: 'p', storage, now: 1000 });
  storage.setItem('theme', 'dark');
  clearBoardListCache(storage);
  assert.equal(readBoardListCache({ storage, now: 1001 }), null);
  assert.equal(readHomeNoticeCache({ projectId: 'first', storage, nowMs: 1001 }), null);
  assert.equal(readHomeNoticeCache({ projectId: 'second', storage, nowMs: 1001 }), null);
  assert.equal(readCommentListCache({ postId: 'p', storage, now: 1001 })[0].id, 'c');
  assert.equal(storage.getItem('theme'), 'dark');
});
