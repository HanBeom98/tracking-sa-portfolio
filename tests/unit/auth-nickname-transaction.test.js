import test from 'node:test';
import assert from 'node:assert/strict';
import { createFirebaseAuthRepository } from '../../src/domains/auth/infra/firebaseAuthRepository.js';
import { buildAuthService } from '../../src/domains/auth/application/authService.js';
import { createTransactionalFirestore } from '../helpers/transactional-firestore.js';

const yesterday = () => new Date(Date.now() - 25 * 60 * 60 * 1000);
const profile = (uid, nickname = 'OldName', nicknameUpdatedAt = yesterday()) => ({
  uid, email: `${uid}@example.test`, nickname, displayName: nickname, photoURL: '',
  role: 'free', subscription: { status: 'free' }, nicknameUpdatedAt,
});
function setup(seed = { 'users/a': profile('a'), 'nicknames/oldname': { uid: 'a', nickname: 'OldName' } }) {
  const db = createTransactionalFirestore(seed);
  function client(uid = 'a') {
    const user = { uid, email: `${uid}@example.test`, displayName: db.read(`users/${uid}`)?.nickname || '', photoURL: '',
      calls: [], async updateProfile(updates) { this.calls.push(updates); Object.assign(this, updates); } };
    const auth = { currentUser: user };
    const repository = createFirebaseAuthRepository({ db, firebaseApp: {
      auth: () => auth, firestore: { FieldValue: { serverTimestamp: () => new Date() } },
    } });
    return { repository, user, auth };
  }
  return { db, client };
}

test('nickname commit rejection preserves profile and both reservations without touching Auth', async () => {
  const { db, client } = setup(), { repository, user } = client();
  const before = db.read('users/a'); db.failNextCommit = true;
  await assert.rejects(repository.updateProfile({ nickname: 'NextName' }), /commit rejected/);
  assert.deepEqual(db.read('users/a'), before);
  assert.equal(db.read('nicknames/oldname').uid, 'a');
  assert.equal(db.read('nicknames/nextname'), undefined);
  assert.equal(user.calls.length, 0);
});

test('two users racing for a nickname produce one owner and preserve the loser old name', async () => {
  const { db, client } = setup({ 'users/a': profile('a', 'Alpha'), 'users/b': profile('b', 'Bravo'),
    'nicknames/alpha': { uid: 'a', nickname: 'Alpha' }, 'nicknames/bravo': { uid: 'b', nickname: 'Bravo' } });
  const clients = [client('a'), client('b')];
  const results = await Promise.allSettled(clients.map(({ repository }) => repository.updateProfile({ nickname: 'Winner' })));
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(results.find((r) => r.status === 'rejected').reason.code, 'auth/nickname-taken');
  const winner = db.read('nicknames/winner').uid, loser = winner === 'a' ? 'b' : 'a';
  assert.equal(db.read(`users/${winner}`).nickname, 'Winner');
  assert.equal(db.read(`nicknames/${loser === 'a' ? 'alpha' : 'bravo'}`).uid, loser);
  assert.equal(db.read(`users/${loser}`).nickname, loser === 'a' ? 'Alpha' : 'Bravo');
  assert.ok(db.retries >= 1);
});

test('simultaneous changes for the same user recheck cooldown after retry', async () => {
  const { db, client } = setup();
  const results = await Promise.allSettled(['NextOne', 'NextTwo'].map((nickname) => client().repository.updateProfile({ nickname })));
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(results.find((r) => r.status === 'rejected').reason.code, 'auth/nickname-cooldown');
  assert.equal(db.paths().filter((p) => p.startsWith('nicknames/')).length, 1);
  assert.equal(db.read('nicknames/oldname'), undefined);
});

test('same-name save and casing changes preserve the existing cooldown', async () => {
  const updatedAt = new Date(), { db, client } = setup({ 'users/a': profile('a', 'OldName', updatedAt),
    'nicknames/oldname': { uid: 'a', nickname: 'OldName' } });
  const { repository } = client();
  await repository.updateProfile({ nickname: '  OldName  ' });
  assert.equal(db.commits, 0);
  await repository.updateProfile({ nickname: 'oldNAME', photoURL: 'https://example.test/photo' });
  assert.deepEqual(db.read('users/a').nicknameUpdatedAt, updatedAt);
  assert.equal(db.read('users/a').nickname, 'oldNAME');
  assert.equal(db.read('nicknames/oldname').nickname, 'oldNAME');
  assert.equal(db.read('users/a').photoURL, 'https://example.test/photo');
});

test('invalid names and unauthenticated saves are rejected before any write', async () => {
  const { db, client } = setup(), { repository, auth } = client();
  for (const nickname of ['', 'a', 'has space', 'name/name', '1234567890123', '😀😀']) {
    await assert.rejects(repository.updateProfile({ nickname }), { code: 'auth/invalid-nickname' });
    assert.equal((await repository.checkNicknameAvailability(nickname)).reason, 'invalid');
  }
  auth.currentUser = null;
  await assert.rejects(repository.updateProfile({ nickname: 'Valid' }), { code: 'auth/not-authenticated' });
  assert.equal(db.commits, 0);
});

test('legacy missing index is repaired without resetting cooldown or deleting a foreign index', async () => {
  const updatedAt = new Date(), { db, client } = setup({ 'users/a': profile('a', 'OldName', updatedAt) });
  await client().repository.updateProfile({ nickname: 'OldName' });
  assert.equal(db.read('nicknames/oldname').uid, 'a');
  assert.deepEqual(db.read('users/a').nicknameUpdatedAt, updatedAt);
  db.write('nicknames/oldname', { uid: 'other', nickname: 'OldName' });
  db.write('users/a', profile('a'));
  await client().repository.updateProfile({ nickname: 'NextName' });
  assert.equal(db.read('nicknames/oldname').uid, 'other');
  assert.equal(db.read('nicknames/nextname').uid, 'a');
});

test('Auth sync failure does not undo a commit and the next load repairs Auth from Firestore', async () => {
  const { db, client } = setup(), { repository, user } = client();
  const normalUpdate = user.updateProfile;
  user.updateProfile = async () => { throw Object.assign(new Error('offline'), { code: 'auth/network-request-failed' }); };
  const result = await repository.updateProfile({ nickname: 'NextName', photoURL: 'https://example.test/new' });
  assert.equal(result.nickname, 'NextName');
  assert.equal(user.displayName, 'OldName');
  assert.equal(db.read('nicknames/oldname'), undefined);
  user.updateProfile = normalUpdate;
  await repository.ensureUserProfile(user);
  assert.equal(user.displayName, 'NextName');
  assert.equal(user.photoURL, 'https://example.test/new');
  assert.equal(db.read('users/a').displayName, 'NextName');
});

test('post-commit profile read failure still returns the committed nickname', async () => {
  const { db, client } = setup(), { repository } = client();
  const collection = db.collection.bind(db);
  db.collection = (name) => {
    const original = collection(name);
    return { ...original, doc(id) {
      const ref = original.doc(id);
      return { ...ref, get: async () => { throw new Error('offline'); } };
    } };
  };
  const result = await repository.updateProfile({ nickname: 'NextName' });
  assert.equal(result.nickname, 'NextName');
  assert.ok(result.nicknameUpdatedAt instanceof Date);
  assert.equal(db.read('users/a').nickname, 'NextName');
});

test('missing profile cannot create an incomplete nickname account', async () => {
  const { db, client } = setup({});
  await assert.rejects(client().repository.updateProfile({ nickname: 'NextName' }), { code: 'auth/profile-unavailable' });
  assert.deepEqual(db.paths(), []);
});

test('profile save publishes canonical state and a stale initial load cannot overwrite it', async () => {
  let listener, finishLoad;
  const states = [], user = { uid: 'a' }, saved = profile('a', 'SavedName');
  const service = buildAuthService({ authRepository: {
    onAuthStateChanged(cb) { listener = cb; return () => {}; },
    ensureUserProfile: () => new Promise((resolve) => { finishLoad = resolve; }),
    updateProfile: async () => saved,
  } });
  const unsubscribe = service.onAuthStateChanged((state) => states.push(state));
  const pending = listener(user);
  assert.equal(await service.updateProfile({ nickname: 'SavedName' }), saved);
  finishLoad(profile('a')); await pending;
  assert.equal(states.length, 1); assert.equal(states[0].profile.nickname, 'SavedName');
  await listener(null);
  await service.updateProfile({ nickname: 'SavedName' });
  assert.equal(states.length, 2); assert.equal(states[1].user, null);
  unsubscribe();
  await service.updateProfile({ nickname: 'SavedName' });
  assert.equal(states.length, 2);
});

test('an old signed-in load cannot restore state after logout', async () => {
  let listener, finishLoad;
  const states = [];
  const service = buildAuthService({ authRepository: {
    onAuthStateChanged(cb) { listener = cb; return () => {}; },
    ensureUserProfile: () => new Promise((resolve) => { finishLoad = resolve; }),
  } });
  service.onAuthStateChanged((state) => states.push(state));
  const pending = listener({ uid: 'a' }); await listener(null);
  finishLoad(profile('a')); await pending;
  assert.deepEqual(states, [{ user: null, profile: null }]);
});
