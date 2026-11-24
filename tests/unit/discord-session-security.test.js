import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import service from '../../cloud-functions/discord-session-service.js';

const { createDiscordSessionHandler, transitionSession } = service;
const pair = generateKeyPairSync('ed25519');
const publicKey = pair.publicKey.export({ type: 'spki', format: 'der' }).subarray(-32).toString('hex');
const NOW = 1792526400000;
const APP = '1478495458900054300';
const makeInteraction = (id = '100', uid = '1', action = null) => ({
  id, application_id: APP, guild_id: '123456789', member: { user: { id: uid } },
  type: action ? 3 : 2, data: action ? { custom_id: action } : { name: '대내모집' },
});
const currentSession = () => ({ status: 'RECRUITING', participants: [], hostId: '1', createdAt: new Date(NOW).toISOString(), lastRefreshedAt: 0 });
function signedRequest(interaction, timestamp = String(Math.floor(NOW / 1000))) {
  const rawBody = Buffer.from(JSON.stringify(interaction));
  const signature = sign(null, Buffer.concat([Buffer.from(timestamp), rawBody]), pair.privateKey).toString('hex');
  return { method: 'POST', rawBody, headers: { 'x-signature-timestamp': timestamp, 'x-signature-ed25519': signature } };
}
function mockDb(initial = null) {
  let value = initial;
  let queue = Promise.resolve();
  let writes = 0;
  const paths = [];
  return {
    collection: (name) => ({ doc: (id) => { paths.push(`${name}/${id}`); return { id }; } }),
    runTransaction: (fn) => {
      const work = queue.then(async () => {
        let next;
        const result = await fn({ get: async () => ({ exists: value !== null, data: () => structuredClone(value) }), set: (_ref, data) => { next = structuredClone(data); } });
        if (next) { value = next; writes++; }
        return result;
      });
      queue = work.catch(() => {});
      return work;
    },
    get state() { return value; }, get writes() { return writes; }, paths,
  };
}
async function invoke(db, req, options = {}) {
  let status = 200, data;
  const res = { set: () => res, status: (n) => { status = n; return res; }, json: (v) => { data = v; return res; } };
  await createDiscordSessionHandler({ db, publicKey, applicationId: APP, now: () => NOW, ...options })(req, res);
  return { status, data };
}

test('Discord session writes require a valid signed raw request', async () => {
  const db = mockDb();
  const denied = await invoke(db, { method: 'POST', rawBody: Buffer.from('{}'), headers: {} });
  assert.equal(denied.status, 401); assert.equal(db.writes, 0); assert.deepEqual(db.paths, []);
  const accepted = await invoke(db, signedRequest(makeInteraction()));
  assert.equal(accepted.status, 200); assert.equal(db.state.hostId, '1');
  assert.deepEqual(db.paths, ['match_sessions/123456789']);
});

test('tampered bodies, stale signatures and malformed headers never touch Firestore', async () => {
  const db = mockDb();
  const tampered = signedRequest(makeInteraction()); tampered.rawBody = Buffer.from(JSON.stringify(makeInteraction('100', '2')));
  const stale = signedRequest(makeInteraction(), String(Math.floor(NOW / 1000) - 301));
  const malformed = signedRequest(makeInteraction()); malformed.headers['x-signature-ed25519'] = 'not-hex';
  for (const req of [tampered, stale, malformed]) assert.equal((await invoke(db, req)).status, 401);
  assert.equal(db.writes, 0); assert.deepEqual(db.paths, []);
});

test('requests from another Discord application and direct messages are rejected', async () => {
  const db = mockDb();
  const otherApp = { ...makeInteraction(), application_id: 'wrong-app' };
  assert.equal((await invoke(db, signedRequest(otherApp))).status, 403);
  const dm = makeInteraction(); delete dm.guild_id;
  assert.equal((await invoke(db, signedRequest(dm))).status, 400);
  assert.equal(db.writes, 0);
});

test('read-only methods cannot trigger a session mutation', async () => {
  const db = mockDb();
  assert.equal((await invoke(db, { method: 'GET', headers: {} })).status, 405);
  assert.equal(db.writes, 0);
});

test('only the session host may cancel, balance or replace an active session', async () => {
  const db = mockDb(currentSession());
  for (const action of ['cancel_match', 'start_balance', null]) {
    assert.equal((await invoke(db, signedRequest(makeInteraction('101', '2', action)))).status, 403);
  }
  assert.equal(db.writes, 0); assert.equal(db.state.status, 'RECRUITING');
  assert.equal((await invoke(db, signedRequest(makeInteraction('102', '1', 'cancel_match')))).status, 200);
  assert.equal(db.state.status, 'CANCELLED');
});

test('a retried start request does not erase later participants', async () => {
  const db = mockDb(); const start = signedRequest(makeInteraction('100'));
  await invoke(db, start);
  await invoke(db, signedRequest(makeInteraction('101', '2', 'set_pos_rifler_Player')));
  const retried = await invoke(db, start);
  assert.equal(retried.data.code, 'DUPLICATE'); assert.equal(db.state.participants.length, 1);
});

test('transactional concurrent joins preserve both members and derive identity from the signature', async () => {
  const db = mockDb(currentSession());
  await Promise.all([
    invoke(db, signedRequest({ ...makeInteraction('101', '2', 'set_pos_rifler_Alpha'), uid: 'forged-uid', session: { hostId: '2' } })),
    invoke(db, signedRequest(makeInteraction('102', '3', 'set_pos_sniper_Bravo'))),
  ]);
  assert.deepEqual(db.state.participants.map((p) => p.discordId).sort(), ['2', '3']);
  assert.equal(db.state.hostId, '1');
});

test('session transitions enforce participant count, allowed positions and start threshold', () => {
  assert.throws(() => transitionSession(currentSession(), makeInteraction('101', '2', 'set_pos_admin_Player'), NOW), /INVALID_PARTICIPANT/);
  assert.equal(transitionSession(currentSession(), makeInteraction('102', '1', 'start_balance'), NOW).code, 'NOT_READY');
  const full = currentSession(); full.participants = Array.from({ length: 20 }, (_, i) => ({ discordId: String(i + 2), nickname: 'Player', position: 'rifler' }));
  assert.throws(() => transitionSession(full, makeInteraction('103', '50', 'set_pos_rifler_Extra'), NOW), /SESSION_FULL/);
  assert.equal(transitionSession(full, makeInteraction('104', '1', 'start_balance'), NOW).session.status, 'CLOSED');
});

test('a backend failure is surfaced without logging signed bodies or interaction tokens', async () => {
  const errors = [];
  const db = { collection: () => ({ doc: () => ({}) }), runTransaction: async () => { throw Object.assign(new Error('private database details'), { code: 'unavailable' }); } };
  const req = signedRequest({ ...makeInteraction(), token: 'must-never-be-logged' });
  const response = await invoke(db, req, { logError: (...args) => errors.push(args) });
  assert.equal(response.status, 503); assert.equal(response.data.error, 'SESSION_STORAGE_UNAVAILABLE');
  assert.ok(!JSON.stringify(errors).includes('must-never-be-logged'));
  assert.ok(!JSON.stringify(errors).includes('private database details'));
});

test('an already-joined request cannot be replayed to undo a later leave', async () => {
  const db = mockDb(currentSession());
  await invoke(db, signedRequest(makeInteraction('101', '2', 'set_pos_rifler_Player')));
  const repeated = signedRequest(makeInteraction('102', '2', 'set_pos_rifler_Player'));
  assert.equal((await invoke(db, repeated)).data.code, 'ALREADY_JOINED');
  await invoke(db, signedRequest(makeInteraction('103', '2', 'leave_match')));
  assert.equal((await invoke(db, repeated)).data.code, 'DUPLICATE');
  assert.deepEqual(db.state.participants, []);
});
