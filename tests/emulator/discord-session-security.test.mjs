import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { generateKeyPairSync, sign } from 'node:crypto';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';

const root = process.env.TRACKING_SA_RULES_ROOT || process.cwd();
const { default: service } = await import(pathToFileURL(resolve(root, 'cloud-functions/discord-session-service.js')));
const pair = generateKeyPairSync('ed25519');
const publicKey = pair.publicKey.export({ type: 'spki', format: 'der' }).subarray(-32).toString('hex');
const APP = '1478495458900054300';
let env;
before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-trackingsa-ownership',
    firestore: { host: '127.0.0.1', port: 8085, rules: readFileSync(resolve(root, 'firestore.rules'), 'utf8') },
  });
});
after(async () => { await env?.cleanup(); });
const payload = { status: 'RECRUITING', participants: [], hostId: '1', createdAt: new Date().toISOString(), lastRefreshedAt: 0 };
function request(id, uid, action = null) {
  const rawBody = Buffer.from(JSON.stringify({ id, application_id: APP, guild_id: '987654321',
    type: action ? 3 : 2, member: { user: { id: uid } }, data: action ? { custom_id: action } : { name: '대내모집' },
  }));
  const timestamp = String(Math.floor(Date.now() / 1000));
  return { method: 'POST', rawBody, headers: { 'x-signature-timestamp': timestamp,
    'x-signature-ed25519': sign(null, Buffer.concat([Buffer.from(timestamp), rawBody]), pair.privateKey).toString('hex') } };
}
async function callServer(db, req) {
  let status = 200, data;
  const res = { set: () => res, status: (code) => { status = code; return res; }, json: (body) => { data = body; return res; } };
  await service.createDiscordSessionHandler({ db, publicKey, applicationId: APP })(req, res);
  return { status, data };
}

test('anonymous, normal and site-admin Firebase clients cannot create, update or delete sessions', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'match_sessions/protected'), payload); });
  for (const ctx of [env.unauthenticatedContext(), env.authenticatedContext('normal'),
    env.authenticatedContext('admin', { email: 'demo-9249b6f9@example.com', role: 'admin' })]) {
    const db = ctx.firestore();
    await assertFails(setDoc(doc(db, 'match_sessions/new'), payload));
    await assertFails(updateDoc(doc(db, 'match_sessions/protected'), { status: 'CANCELLED' }));
    await assertFails(deleteDoc(doc(db, 'match_sessions/protected')));
  }
  await assertSucceeds(getDoc(doc(env.unauthenticatedContext().firestore(), 'match_sessions/protected')));
});

test('the signed server path can create and concurrently update a session using transactions', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    assert.equal((await callServer(db, request('100', '1'))).status, 200);
    const results = await Promise.all([
      callServer(db, request('101', '2', 'set_pos_rifler_Alpha')),
      callServer(db, request('102', '3', 'set_pos_sniper_Bravo')),
    ]);
    assert.ok(results.every((r) => r.status === 200));
    const session = (await getDoc(doc(db, 'match_sessions/987654321'))).data();
    assert.deepEqual(session.participants.map((p) => p.discordId).sort(), ['2', '3']);
  });
});

test('even the privileged server path rejects unsigned requests and non-host cancellations', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    assert.equal((await callServer(db, { method: 'POST', rawBody: Buffer.from('{}'), headers: {} })).status, 401);
    assert.equal((await callServer(db, request('103', '2', 'cancel_match'))).status, 403);
    assert.equal((await getDoc(doc(db, 'match_sessions/987654321'))).data().status, 'RECRUITING');
    assert.equal((await callServer(db, request('104', '1', 'cancel_match'))).status, 200);
    assert.equal((await getDoc(doc(db, 'match_sessions/987654321'))).data().status, 'CANCELLED');
  });
});
