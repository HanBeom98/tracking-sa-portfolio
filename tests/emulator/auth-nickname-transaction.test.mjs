import test, { before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { initializeTestEnvironment, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, deleteDoc, writeBatch, runTransaction, Timestamp, serverTimestamp } from 'firebase/firestore';

const root = process.env.TRACKING_SA_RULES_ROOT || process.cwd();
const { createFirebaseAuthRepository } = await import(pathToFileURL(resolve(root, 'src/domains/auth/infra/firebaseAuthRepository.js')));
let env;
before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-trackingsa-ownership', firestore: {
    host: '127.0.0.1', port: 8085, rules: readFileSync(resolve(root, 'firestore.rules'), 'utf8'),
  } });
});
beforeEach(async () => { await env.clearFirestore(); });
after(async () => { await env?.cleanup(); });

const snapshot = (value) => ({ exists: value.exists(), data: () => value.data() });
function compat(db) {
  return {
    collection(name) { return { doc(id) {
      const native = doc(db, name, id);
      return { native, get: async () => snapshot(await getDoc(native)) };
    } }; },
    runTransaction(update) {
      return runTransaction(db, (tx) => update({
        get: async (ref) => snapshot(await tx.get(ref.native)),
        set: (ref, ...args) => tx.set(ref.native, ...args),
        delete: (ref) => tx.delete(ref.native),
      }));
    },
  };
}
const dbFor = (uid) => env.authenticatedContext(uid, { email: `${uid}@example.test` }).firestore();
function client(uid) {
  const user = { uid, email: `${uid}@example.test`, displayName: '', photoURL: '',
    async updateProfile(updates) { Object.assign(this, updates); } };
  const repo = createFirebaseAuthRepository({ db: compat(dbFor(uid)), firebaseApp: {
    auth: () => ({ currentUser: user }), firestore: { FieldValue: { serverTimestamp } },
  } });
  return { repo, user };
}
const oldTime = () => Timestamp.fromMillis(Date.now() - 25 * 60 * 60 * 1000);
const profile = (uid, nickname = '', at = oldTime()) => ({ uid, email: `${uid}@example.test`,
  nickname, displayName: nickname, photoURL: '', role: 'free', subscription: { status: 'free' },
  createdAt: oldTime(), ...(nickname ? { nicknameUpdatedAt: at } : {}),
});
async function seed(profiles = { a: 'Alpha' }, extra = {}) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore(), batch = writeBatch(db);
    for (const [uid, nickname] of Object.entries(profiles)) {
      batch.set(doc(db, 'users', uid), profile(uid, nickname));
      if (nickname) batch.set(doc(db, 'nicknames', nickname.toLowerCase()), { uid, nickname, updatedAt: oldTime() });
    }
    for (const [path, data] of Object.entries(extra)) batch.set(doc(db, path), data);
    await batch.commit();
  });
}
async function read(path) {
  let value;
  await env.withSecurityRulesDisabled(async (ctx) => { value = (await getDoc(doc(ctx.firestore(), path))).data(); });
  return value;
}

test('first claim and subsequent rename commit profile, target and old release together', async () => {
  await seed({ a: '' });
  const { repo } = client('a');
  await repo.updateProfile({ nickname: 'Tracking' });
  const saved = await read('users/a');
  assert.equal(saved.nickname, 'Tracking'); assert.equal(saved.displayName, 'Tracking');
  assert.equal((await read('nicknames/tracking')).uid, 'a');
  assert.ok(saved.nicknameUpdatedAt instanceof Timestamp);
  await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'users/a'), { nicknameUpdatedAt: oldTime() }, { merge: true }));
  await repo.updateProfile({ nickname: 'NewName' });
  assert.equal((await read('users/a')).nickname, 'NewName');
  assert.equal(await read('nicknames/tracking'), undefined);
  assert.equal((await read('nicknames/newname')).uid, 'a');
});

test('competing authenticated accounts leave one winner and the loser original reservation', async () => {
  await seed({ a: 'Alpha', b: 'Bravo' });
  const results = await Promise.allSettled(['a', 'b'].map((uid) => client(uid).repo.updateProfile({ nickname: 'Winner' })));
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(results.find((r) => r.status === 'rejected').reason.code, 'auth/nickname-taken');
  const winner = (await read('nicknames/winner')).uid, loser = winner === 'a' ? 'b' : 'a';
  assert.equal((await read(`users/${winner}`)).nickname, 'Winner');
  assert.equal((await read(`users/${loser}`)).nickname, loser === 'a' ? 'Alpha' : 'Bravo');
  assert.equal((await read(`nicknames/${loser === 'a' ? 'alpha' : 'bravo'}`)).uid, loser);
});

test('taken nickname preserves the original profile and reservation', async () => {
  await seed({ a: 'Alpha', b: 'Bravo' });
  await assert.rejects(client('a').repo.updateProfile({ nickname: 'bravo' }), { code: 'auth/nickname-taken' });
  assert.equal((await read('users/a')).nickname, 'Alpha');
  assert.equal((await read('nicknames/alpha')).uid, 'a');
  assert.equal((await read('nicknames/bravo')).uid, 'b');
});

test('same-name, case-only and photo saves preserve the 24-hour clock', async () => {
  const at = Timestamp.now();
  await seed({ a: 'Alpha' }, { 'users/a': profile('a', 'Alpha', at) });
  const { repo } = client('a');
  await repo.updateProfile({ nickname: '  Alpha  ' });
  await repo.updateProfile({ nickname: 'ALpha', photoURL: 'https://example.test/avatar' });
  assert.equal((await read('users/a')).nicknameUpdatedAt.toMillis(), at.toMillis());
  assert.equal((await read('nicknames/alpha')).nickname, 'ALpha');
  await repo.updateProfile({ photoURL: '' });
  assert.equal((await read('users/a')).nicknameUpdatedAt.toMillis(), at.toMillis());
  await assert.rejects(repo.updateProfile({ nickname: 'Bravo' }), { code: 'auth/nickname-cooldown' });
});

test('missing legacy reservation is repaired without restarting cooldown', async () => {
  const at = Timestamp.now();
  await seed({ a: '' }, { 'users/a': profile('a', 'Legacy', at) });
  await client('a').repo.updateProfile({ nickname: 'Legacy' });
  assert.equal((await read('nicknames/legacy')).uid, 'a');
  assert.equal((await read('users/a')).nicknameUpdatedAt.toMillis(), at.toMillis());
});

test('a mismatched historical reservation owned by another user is never deleted', async () => {
  await seed({ a: 'Alpha', b: '' }, { 'nicknames/alpha': { uid: 'b', nickname: 'Alpha', updatedAt: oldTime() } });
  await client('a').repo.updateProfile({ nickname: 'NewName' });
  assert.equal((await read('nicknames/alpha')).uid, 'b');
  assert.equal((await read('nicknames/newname')).uid, 'a');
});

test('direct profile rename without a matching reservation is denied', async () => {
  await seed();
  await assertFails(setDoc(doc(dbFor('a'), 'users/a'), {
    nickname: 'Forged', displayName: 'Forged', nicknameUpdatedAt: serverTimestamp(),
  }, { merge: true }));
  assert.equal((await read('users/a')).nickname, 'Alpha');
});

test('standalone claim, wrong normalized path, foreign overwrite and current-name deletion are denied', async () => {
  await seed({ a: 'Alpha', b: 'Bravo' });
  const db = dbFor('a');
  await assertFails(setDoc(doc(db, 'nicknames/unused'), { uid: 'a', nickname: 'Unused', updatedAt: serverTimestamp() }));
  await assertFails(setDoc(doc(db, 'nicknames/Alpha'), { uid: 'a', nickname: 'Alpha', updatedAt: serverTimestamp() }));
  await assertFails(setDoc(doc(db, 'nicknames/bravo'), { uid: 'a', nickname: 'Bravo', updatedAt: serverTimestamp() }));
  await assertFails(deleteDoc(doc(db, 'nicknames/bravo')));
  await assertFails(deleteDoc(doc(db, 'nicknames/alpha')));
  assert.equal((await read('nicknames/alpha')).uid, 'a');
});

test('atomic rename cannot retain the old reservation or use a mismatched display name', async () => {
  await seed();
  const db = dbFor('a');
  for (const release of [false, true]) {
    const batch = writeBatch(db);
    batch.set(doc(db, 'nicknames/newname'), { uid: 'a', nickname: 'NewName', updatedAt: serverTimestamp() });
    batch.update(doc(db, 'users/a'), { nickname: 'NewName', displayName: release ? 'Wrong' : 'NewName', nicknameUpdatedAt: serverTimestamp() });
    if (release) batch.delete(doc(db, 'nicknames/alpha'));
    await assertFails(batch.commit());
  }
  assert.equal((await read('nicknames/alpha')).uid, 'a');
  assert.equal(await read('nicknames/newname'), undefined);
});

test('server cooldown and timestamp integrity cannot be bypassed with a direct batch', async () => {
  const at = Timestamp.now();
  await seed({ a: 'Alpha' }, { 'users/a': profile('a', 'Alpha', at) });
  const db = dbFor('a'), batch = writeBatch(db);
  batch.delete(doc(db, 'nicknames/alpha'));
  batch.set(doc(db, 'nicknames/newname'), { uid: 'a', nickname: 'NewName', updatedAt: serverTimestamp() });
  batch.update(doc(db, 'users/a'), { nickname: 'NewName', displayName: 'NewName', nicknameUpdatedAt: serverTimestamp() });
  await assertFails(batch.commit());
  await assertFails(setDoc(doc(db, 'users/a'), { nicknameUpdatedAt: oldTime() }, { merge: true }));
  await assertFails(setDoc(doc(db, 'users/a'), { nicknameUpdatedAt: serverTimestamp() }, { merge: true }));
  assert.equal((await read('users/a')).nicknameUpdatedAt.toMillis(), at.toMillis());
});

test('new account bootstrap and Auth repair follow the canonical Firestore profile', async () => {
  const { repo, user } = client('a');
  await repo.ensureUserProfile(user);
  assert.equal((await read('users/a')).role, 'free');
  await repo.updateProfile({ nickname: '사이트회원' });
  user.displayName = 'stale';
  await repo.ensureUserProfile(user);
  assert.equal(user.displayName, '사이트회원');
  assert.equal((await read('users/a')).displayName, '사이트회원');
  const db = dbFor('a');
  await assertFails(setDoc(doc(db, 'users/a'), { role: 'admin' }, { merge: true }));
});

test('rule rejection rolls back all three writes, including the old-name release', async () => {
  await seed();
  const db = dbFor('a'), batch = writeBatch(db);
  batch.delete(doc(db, 'nicknames/alpha'));
  batch.set(doc(db, 'nicknames/newname'), { uid: 'a', nickname: 'NewName', updatedAt: serverTimestamp() });
  batch.update(doc(db, 'users/a'), { nickname: 'NewName', displayName: 'NewName', nicknameUpdatedAt: serverTimestamp(), role: 'admin' });
  await assertFails(batch.commit());
  assert.equal((await read('users/a')).nickname, 'Alpha');
  assert.equal((await read('nicknames/alpha')).uid, 'a');
  assert.equal(await read('nicknames/newname'), undefined);
});
