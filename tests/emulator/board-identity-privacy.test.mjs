import test, { before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, getDocs, collection, deleteDoc, updateDoc, writeBatch, serverTimestamp } from 'firebase/firestore';

const root = process.env.TRACKING_SA_RULES_ROOT || process.cwd();
const { createPrivacyClient, migrateBoardPrivacy } = await import(pathToFileURL(resolve(root, 'scripts/migrate-board-privacy.mjs')));
let env;
before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-trackingsa-ownership', firestore: {
    host: '127.0.0.1', port: 8085, rules: readFileSync(resolve(root, 'firestore.rules'), 'utf8'),
  } });
});
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    for (const [uid, nickname] of Object.entries({ member: '회원닉네임', other: '다른회원', unset: '', admin: '관리자닉네임', adminUnset: '' })) {
      await setDoc(doc(ctx.firestore(), `users/${uid}`), { uid, nickname, role: uid.startsWith('admin') ? 'admin' : 'free' });
    }
  });
});
after(async () => { await env?.cleanup(); });
const dbFor = (uid) => env.authenticatedContext(uid, { email: uid.startsWith('admin') ? 'demo-9249b6f9@example.com' : `${uid}@example.test` }).firestore();
const post = (uid = 'member', name = '회원닉네임') => ({ title: 'title', content: 'body', category: 'free', authorUid: uid,
  authorName: name, authorPhoto: '', attachments: [], createdAt: serverTimestamp() });
async function comment(uid, name, id = 'abcdefghijklmnopqrst') {
  const db = dbFor(uid), batch = writeBatch(db);
  batch.set(doc(db, `board_posts/p1/comments/${id}`), { content: 'reply', authorUid: uid, authorName: name,
    parentId: null, deleted: false, createdAt: serverTimestamp() });
  batch.set(doc(db, `comment_rate_limits/${uid}`), { lastCommentAt: serverTimestamp(), commentId: id });
  return batch.commit();
}
async function seedLegacy() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'board_posts/p1'), { ...post(), authorEmail: 'private@example.test', authorName: 'private@example.test' });
    await setDoc(doc(db, 'board_posts/p2'), { ...post('unset', 'unset@example.test'), authorEmail: '' });
    await setDoc(doc(db, 'board_posts/p3'), { ...post(), authorEmail: 'member@example.test' });
    await setDoc(doc(db, 'board_posts/p1/comments/c1'), { authorUid: 'member', authorName: 'member@example.test', content: 'reply', parentId: null, deleted: false });
    // Comments can survive a historically deleted parent. showMissing must
    // discover these as well, rather than leaving orphaned emails exposed.
    await setDoc(doc(db, 'board_posts/missing/comments/orphan'), { authorUid: 'unset', authorName: 'unset@example.test', content: 'orphan' });
  });
}
const migrationClient = () => createPrivacyClient({ projectId: 'demo-trackingsa-ownership', token: 'owner', emulatorHost: '127.0.0.1:8085' });
async function privilegedRead(path) {
  let data;
  await env.withSecurityRulesDisabled(async (ctx) => { data = (await getDoc(doc(ctx.firestore(), path))).data(); });
  return data;
}

test('registered members can create public posts without an email field', async () => {
  await assertSucceeds(setDoc(doc(dbFor('member'), 'board_posts/p1'), post()));
  const saved = (await getDoc(doc(env.unauthenticatedContext().firestore(), 'board_posts/p1'))).data();
  assert.equal(saved.authorName, '회원닉네임'); assert.equal('authorEmail' in saved, false);
});

test('missing nickname, arbitrary author name, stale nickname and email fields are denied', async () => {
  for (const payload of [post('unset', 'LooksValid'), post('member', '다른회원'), post('member', '익명'), post('member', 'member@example.test'), { ...post(), authorEmail: '' }]) {
    await assertFails(setDoc(doc(dbFor(payload.authorUid), 'board_posts/p1'), payload));
  }
  await env.withSecurityRulesDisabled((ctx) => updateDoc(doc(ctx.firestore(), 'users/member'), { nickname: '새닉네임' }));
  await assertFails(setDoc(doc(dbFor('member'), 'board_posts/p1'), post()));
  await assertSucceeds(setDoc(doc(dbFor('member'), 'board_posts/p1'), post('member', '새닉네임')));
});

test('admin notices require nickname too, and ordinary members still cannot create notices', async () => {
  await assertSucceeds(setDoc(doc(dbFor('admin'), 'board_posts/p1'), { ...post('admin', '관리자닉네임'), category: 'notice' }));
  await assertFails(setDoc(doc(dbFor('adminUnset'), 'board_posts/p2'), { ...post('adminUnset', 'Admin'), category: 'notice' }));
  await assertFails(setDoc(doc(dbFor('member'), 'board_posts/p2'), { ...post(), category: 'notice' }));
});

test('registered comments succeed while anonymous, no-nickname and forged-name comments are denied', async () => {
  await setDoc(doc(dbFor('member'), 'board_posts/p1'), post());
  await assertSucceeds(comment('member', '회원닉네임'));
  await assertFails(comment('unset', 'LooksValid'));
  await assertFails(comment('other', '회원닉네임'));
  await assertFails(comment('other', 'other@example.test'));
  await assertFails(setDoc(doc(env.unauthenticatedContext().firestore(), 'board_posts/anon'), post()));
});

test('nickname setup is enforced at save time, and comment rate limiting remains active', async () => {
  await setDoc(doc(dbFor('member'), 'board_posts/p1'), post());
  await assertSucceeds(comment('member', '회원닉네임'));
  await assertFails(comment('member', '회원닉네임', 'bcdefghijklmnopqrstu1'));
  await env.withSecurityRulesDisabled((ctx) => updateDoc(doc(ctx.firestore(), 'users/other'), { nickname: '' }));
  await assertFails(comment('other', '다른회원'));
});

test('historical content remains readable and owned deletion works without a nickname', async () => {
  await seedLegacy();
  const db = dbFor('unset');
  await assertSucceeds(updateDoc(doc(db, 'board_posts/p2'), { title: 'edited' }));
  await assertSucceeds(getDoc(doc(env.unauthenticatedContext().firestore(), 'board_posts/p2')));
  await assertFails(updateDoc(doc(dbFor('other'), 'board_posts/p2'), { title: 'forged' }));
  await assertSucceeds(deleteDoc(doc(db, 'board_posts/p2')));
});

test('audit makes no writes; cleanup backs up only identity fields and is idempotent, including orphan comments', async () => {
  await seedLegacy();
  const client = migrationClient();
  const audit = await migrateBoardPrivacy({ client });
  assert.equal(audit.postsScanned, 3); assert.equal(audit.commentsScanned, 2);
  assert.equal(audit.planned, 5); assert.equal(audit.applied, 0);
  assert.equal((await privilegedRead('board_posts/p1')).authorEmail, 'private@example.test');
  const applied = await migrateBoardPrivacy({ client, apply: true });
  assert.equal(applied.applied, 5);
  const saved = await privilegedRead('board_posts/p1');
  assert.equal('authorEmail' in saved, false); assert.equal(saved.authorName, '회원닉네임');
  assert.equal(saved.title, 'title'); assert.equal(saved.content, 'body'); assert.deepEqual(saved.attachments, []);
  assert.match((await privilegedRead('board_posts/p2')).authorName, /^미설정회원_[0-9a-f]{12}$/);
  assert.equal((await privilegedRead('board_posts/p1/comments/c1')).authorName, '회원닉네임');
  assert.match((await privilegedRead('board_posts/missing/comments/orphan')).authorName, /^미설정회원_[0-9a-f]{12}$/);
  assert.equal((await migrateBoardPrivacy({ client, apply: true })).planned, 0);
  let backups;
  await env.withSecurityRulesDisabled(async (ctx) => { backups = await getDocs(collection(ctx.firestore(), '_board_privacy_backups')); });
  assert.equal(backups.size, 5);
  for (const backup of backups.docs) {
    assert.equal('content' in backup.data().original, false);
    for (const uid of ['member', 'admin']) await assertFails(getDoc(doc(dbFor(uid), backup.ref.path)));
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), backup.ref.path)));
  }
});

test('a concurrent edit aborts cleanup and its backup together, then rerun preserves the edit', async () => {
  await seedLegacy();
  const client = migrationClient(), commit = client.commit;
  let injected = false, editedPath;
  client.commit = async (writes) => {
    if (!injected) {
      injected = true;
      editedPath = writes.at(-1).update.name.split('/documents/')[1];
      await env.withSecurityRulesDisabled((ctx) => updateDoc(doc(ctx.firestore(), editedPath), { content: 'concurrent edit' }));
    }
    return commit(writes);
  };
  await assert.rejects(migrateBoardPrivacy({ client, apply: true }));
  assert.equal((await privilegedRead('board_posts/p1')).authorEmail, 'private@example.test');
  let backups;
  await env.withSecurityRulesDisabled(async (ctx) => { backups = await getDocs(collection(ctx.firestore(), '_board_privacy_backups')); });
  assert.equal(backups.size, 0);
  await migrateBoardPrivacy({ client: migrationClient(), apply: true });
  assert.equal((await privilegedRead(editedPath)).content, 'concurrent edit');
});
