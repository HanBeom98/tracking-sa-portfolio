import test, { before, after } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, deleteObject } from 'firebase/storage';

const root = process.env.TRACKING_SA_RULES_ROOT || process.cwd();
const { SITE_ADMIN_EMAILS, SA_MODERATOR_EMAILS } = await import(pathToFileURL(resolve(root, 'src/domains/auth/domain/access-policy.js')));
let env;
before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-trackingsa-ownership',
    firestore: { host: '127.0.0.1', port: 8085, rules: readFileSync(resolve(root, 'firestore.rules'), 'utf8') },
    storage: { host: '127.0.0.1', port: 9198, rules: readFileSync(resolve(root, 'storage.rules'), 'utf8') },
  });
  await env.withSecurityRulesDisabled(async (ctx) => {
    for (const uid of ['owner', 'victim']) {
      await setDoc(doc(ctx.firestore(), `users/${uid}`), { role: 'free', nickname: uid });
    }
  });
});
after(async () => { await env?.cleanup(); });
const context = (uid) => env.authenticatedContext(uid, { email: uid === 'admin' ? 'demo-9249b6f9@example.com' : `${uid}@example.test` });
const imagePath = (uid, id = 'image') => `board-images/${uid}/${id}.webp`;
const attachment = (uid, id = 'image') => ({
  path: imagePath(uid, id),
  url: `https://firebasestorage.googleapis.com/v0/b/demo-tracking-sa-portfolio.firebasestorage.app/o/${encodeURIComponent(imagePath(uid, id))}?alt=media&token=test`,
  width: 100, align: 'center', name: 'image.png',
});
const post = (uid, attachments = []) => ({
  authorUid: uid, authorName: uid, authorPhoto: '',
  title: 'title', content: 'body', category: 'free', createdAt: serverTimestamp(), attachments,
});

test('author can create a post with their own image', async () => {
  await assertSucceeds(setDoc(doc(context('owner').firestore(), 'board_posts/valid'), post('owner', [attachment('owner')])));
});
test('a forged foreign attachment path is denied on creation', async () => {
  await assertFails(setDoc(doc(context('owner').firestore(), 'board_posts/foreign'), post('owner', [attachment('victim')])));
});
test('mismatched object URLs and foreign buckets are denied', async () => {
  const own = attachment('owner');
  for (const url of [attachment('victim').url, attachment('owner', 'different').url, own.url.replace('demo-tracking-sa-portfolio', 'foreign-project')]) {
    await assertFails(setDoc(doc(context('owner').firestore(), 'board_posts/bad-url'), post('owner', [{ ...own, url }])));
  }
});
test('admin editing another post retains owner images and cannot attach unrelated paths', async () => {
  const target = doc(context('owner').firestore(), 'board_posts/admin-edit');
  await setDoc(target, post('owner', [attachment('owner')]));
  const editor = doc(context('admin').firestore(), 'board_posts/admin-edit');
  await assertSucceeds(updateDoc(editor, { title: 'edited', attachments: [attachment('owner', 'new')] }));
  await assertFails(updateDoc(editor, { attachments: [attachment('victim')] }));
  await assertFails(updateDoc(editor, { attachments: [attachment('admin')] }));
});
test('legacy invalid attachments can be removed during an admin edit', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'board_posts/legacy'), post('owner', [attachment('victim')]));
  });
  const target = doc(context('admin').firestore(), 'board_posts/legacy');
  await assertFails(updateDoc(target, { title: 'keep invalid' }));
  await assertSucceeds(updateDoc(target, { attachments: [] }));
});
test('ordinary users can upload only to their own directory', async () => {
  const storage = context('owner').storage('gs://demo-trackingsa-ownership.appspot.com');
  const metadata = { contentType: 'image/webp', customMetadata: { ownerUid: 'owner' } };
  await assertSucceeds(uploadBytes(ref(storage, imagePath('owner', 'uploaded')), new Uint8Array([1, 2, 3]), metadata));
  await assertFails(uploadBytes(ref(storage, imagePath('victim', 'forged')), new Uint8Array([1]), { ...metadata, customMetadata: { ownerUid: 'victim' } }));
  await assertFails(uploadBytes(ref(storage, imagePath('owner', 'wrong-metadata')), new Uint8Array([1]), { ...metadata, customMetadata: { ownerUid: 'victim' } }));
});
test('admin may upload an edit image in the post authors directory', async () => {
  const storage = context('admin').storage('gs://demo-trackingsa-ownership.appspot.com');
  await assertSucceeds(uploadBytes(ref(storage, imagePath('owner', 'admin-upload')), new Uint8Array([1]), {
    contentType: 'image/webp', customMetadata: { ownerUid: 'owner' },
  }));
});
test('foreign and anonymous users cannot delete an owners image', async () => {
  const bucket = 'gs://demo-trackingsa-ownership.appspot.com';
  const path = imagePath('owner', 'delete-protected');
  await uploadBytes(ref(context('owner').storage(bucket), path), new Uint8Array([1]), {
    contentType: 'image/webp', customMetadata: { ownerUid: 'owner' },
  });
  await assertFails(deleteObject(ref(context('victim').storage(bucket), path)));
  await assertFails(deleteObject(ref(env.unauthenticatedContext().storage(bucket), path)));
  await assertSucceeds(deleteObject(ref(context('owner').storage(bucket), path)));
});

test('text-only posts and legacy project-bucket attachments remain valid', async () => {
  await assertSucceeds(setDoc(doc(context('owner').firestore(), 'board_posts/text-only'), post('owner')));
  const oldBucket = attachment('owner');
  oldBucket.url = oldBucket.url.replace('firebasestorage.app', 'appspot.com');
  await assertSucceeds(setDoc(doc(context('owner').firestore(), 'board_posts/old-bucket'), post('owner', [oldBucket])));
});
test('another ordinary user cannot edit the owners post', async () => {
  const target = doc(context('victim').firestore(), 'board_posts/valid');
  await assertFails(updateDoc(target, { attachments: [attachment('owner')], title: 'unauthorized edit' }));
});
test('image upload still requires WebP and matching owner metadata', async () => {
  const storage = context('owner').storage('gs://demo-trackingsa-ownership.appspot.com');
  await assertFails(uploadBytes(ref(storage, imagePath('owner', 'wrong-type')), new Uint8Array([1]), {
    contentType: 'image/png', customMetadata: { ownerUid: 'owner' },
  }));
  await assertFails(uploadBytes(ref(storage, imagePath('owner', 'no-metadata')), new Uint8Array([1]), {
    contentType: 'image/webp',
  }));
});

test('the maximum three valid owner attachments fit the rule evaluation budget', async () => {
  await assertSucceeds(setDoc(doc(context('owner').firestore(), 'board_posts/three-images'),
    post('owner', ['one', 'two', 'three'].map((id) => attachment('owner', id)))));
});

test('site admin and league moderator email scopes retain different notice permissions', async () => {
  for (const [index, email] of [...SITE_ADMIN_EMAILS, ...SA_MODERATOR_EMAILS].entries()) {
    const uid = `policy${index}`;
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `users/${uid}`), { role: 'free', nickname: uid });
    });
    const db = env.authenticatedContext(uid, { email }).firestore();
    const createNotice = setDoc(doc(db, `board_posts/policy-${uid}`), { ...post(uid), category: 'notice' });
    if (SITE_ADMIN_EMAILS.includes(email)) await assertSucceeds(createNotice);
    else await assertFails(createNotice);
    await assertSucceeds(setDoc(doc(db, `sa_crew_members/policy-${uid}`), { characterName: uid }));
  }
});

test('league-only moderators cannot delete board images but both site admin emails can', async () => {
  const bucket = 'gs://demo-trackingsa-ownership.appspot.com';
  for (const [index, email] of [...SITE_ADMIN_EMAILS, ...SA_MODERATOR_EMAILS].entries()) {
    const path = imagePath('owner', `policy-delete-${index}`);
    await uploadBytes(ref(context('owner').storage(bucket), path), new Uint8Array([1]), {
      contentType: 'image/webp', customMetadata: { ownerUid: 'owner' },
    });
    const client = env.authenticatedContext(`policy${index}`, { email });
    const remove = deleteObject(ref(client.storage(bucket), path));
    if (SITE_ADMIN_EMAILS.includes(email)) await assertSucceeds(remove);
    else await assertFails(remove);
  }
});

test('ordinary members stay blocked while existing admin profiles retain site privileges', async () => {
  for (const role of ['free', 'admin']) {
    const uid = `profile-${role}`;
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `users/${uid}`), { role, nickname: role === 'free' ? 'FreeUser' : 'AdminUser' });
    });
    const db = env.authenticatedContext(uid, { email: `${role}@example.test` }).firestore();
    const notice = () => setDoc(doc(db, `board_posts/policy-${uid}`), { ...post(uid), authorName: role === 'free' ? 'FreeUser' : 'AdminUser', category: 'notice' });
    const crew = () => setDoc(doc(db, `sa_crew_members/policy-${uid}`), { characterName: uid });
    if (role === 'admin') { await assertSucceeds(notice()); await assertSucceeds(crew()); }
    else { await assertFails(notice()); await assertFails(crew()); }
  }
});
