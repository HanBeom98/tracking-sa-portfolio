import test, { before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, writeBatch, runTransaction, serverTimestamp } from 'firebase/firestore';

const root = process.env.TRACKING_SA_RULES_ROOT || process.cwd();
const { CrewRepository } = await import(pathToFileURL(resolve(root, 'src/domains/stats/sudden-attack/infra/crew-repository.js')));
let env;
const previousWindow = globalThis.window;
before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-trackingsa-ownership', firestore: {
    host: '127.0.0.1', port: 8085, rules: readFileSync(resolve(root, 'firestore.rules'), 'utf8')
  } });
  globalThis.window = { firebase: { firestore: { FieldValue: { serverTimestamp } } } };
});
beforeEach(async () => { await env.clearFirestore(); });
after(async () => {
  await env?.cleanup();
  if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow;
});

const member = (name = 'one') => ({ characterName: name, mmr: 1200, hsr: 1200, wins: 0, loses: 0, crewKills: 0, crewDeaths: 0, mmrHistory: [] });
const player = (id = 'p1') => ({ ouid: id, nickname: id === 'p1' ? 'one' : id, isCrew: true, result: 'WIN', kill: 10, death: 10, kd: 1 });
const match = (id, players = [player()]) => ({ matchId: id, matchDate: '2026-03-09T13:20:00.000Z', mapName: 'map', crewParticipants: players.map((p) => p.nickname), allPlayerStats: players });

// Production uses Firestore's compat syntax. This adapter changes syntax only;
// reads, optimistic retries, security rules and atomic commits use the real SDK.
const snapshot = (value) => ({ id: value.id, exists: value.exists(), data: () => value.data() });
function compat(db) {
  return {
    collection(name) {
      return { doc: (id) => doc(db, name, id), async get() {
        const result = await getDocs(collection(db, name));
        const docs = result.docs.map(snapshot);
        return { docs, forEach: (fn) => docs.forEach(fn) };
      } };
    },
    runTransaction(update) {
      return runTransaction(db, (tx) => update({
        get: async (ref) => snapshot(await tx.get(ref)),
        set: (...args) => tx.set(...args), update: (...args) => tx.update(...args)
      }));
    }
  };
}
function repo(uid) {
  const result = new CrewRepository(null);
  const db = compat(env.authenticatedContext(uid, { email: 'demo-9249b6f9@example.com' }).firestore());
  Object.defineProperty(result, 'db', { get: () => db });
  return result;
}
async function seed(extra = {}) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore(), batch = writeBatch(db);
    for (const [path, value] of Object.entries({ 'sa_crew_members/p1': member(),
      'sa_crew_settings/season': { startDate: '2026-01-01T00:00:00.000Z' }, ...extra })) batch.set(doc(db, path), value);
    await batch.commit();
  });
}
async function read(path) {
  return (await getDoc(doc(env.authenticatedContext('reader', { email: 'demo-9249b6f9@example.com' }).firestore(), path))).data();
}

test('real transactions preserve both different matches from separate authenticated clients', async () => {
  await seed();
  const reports = await Promise.all([repo('a').settleMatches([match('a')]), repo('b').settleMatches([match('b')])]);
  assert.equal(reports.flat().length, 2);
  const saved = await read('sa_crew_members/p1');
  assert.equal(saved.wins, 2); assert.equal(saved.mmr, 1240);
  assert.equal(saved.hsr, 1224); assert.equal(saved.crewKills, 20);
  assert.equal(saved.mmrHistory.length, 2);
});

test('real concurrent settlement keeps disguised nickname history and untouched zero-match members', async () => {
  await seed({
    'sa_crew_members/p1': { ...member('Shadow7days'), previousNames: ['Tracking'], migratedFrom: 'legacy-p1' },
    'sa_crew_members/idle': member('ZeroMatch')
  });
  const reports = await Promise.all([
    repo('a').settleMatches([match('disguise', [{ ...player(), nickname: 'Shadow7days' }])]),
    repo('b').settleMatches([match('original', [{ ...player(), ouid: '', nickname: 'Tracking' }])])
  ]);
  assert.equal(reports.flat().length, 2);
  const saved = await read('sa_crew_members/p1');
  assert.equal(saved.wins, 2);
  assert.equal(saved.mmr, 1240);
  assert.equal(saved.hsr, 1224);
  assert.equal(saved.characterName, 'Shadow7days');
  assert.deepEqual(saved.previousNames, ['Tracking']);
  assert.equal(saved.migratedFrom, 'legacy-p1');
  assert.equal(saved.mmrHistory.length, 2);
  assert.deepEqual(await read('sa_crew_members/idle'), member('ZeroMatch'));
});

test('real transactions return one committed report for the same match', async () => {
  await seed();
  const reports = await Promise.all([repo('a').settleMatches([match('a')]), repo('b').settleMatches([match('a')])]);
  assert.equal(reports.flat().length, 1);
  assert.equal((await read('sa_crew_members/p1')).wins, 1);
});

test('overlapping match batches retain exactly three wins', async () => {
  await seed();
  const reports = await Promise.all([repo('a').settleMatches([match('a'), match('b')]), repo('b').settleMatches([match('b'), match('c')])]);
  assert.equal(reports.flat().length, 3);
  assert.equal((await read('sa_crew_members/p1')).wins, 3);
  assert.equal((await read('sa_crew_members/p1')).mmr, 1260);
});

test('duplicate manual penalties from separate clients deduct once', async () => {
  await seed({ 'sa_crew_history/old': { matchDate: '2026-03-08T13:20:00.000Z' } });
  const payload = { ouid: 'p1', matchId: 'old', reason: 'missing participant' };
  const results = await Promise.allSettled([repo('a').applyManualAbandonPenalty(payload), repo('b').applyManualAbandonPenalty(payload)]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(results.filter((r) => r.status === 'rejected').length, 1);
  const saved = await read('sa_crew_members/p1');
  assert.equal(saved.loses, 1); assert.equal(saved.mmr, 1170);
  assert.equal((await read('sa_crew_history/old')).abandonCount, 1);
});

test('manual penalty and match settlement retain each other across clients', async () => {
  await seed({ 'sa_crew_history/old': { matchDate: '2026-03-08T13:20:00.000Z' } });
  await Promise.all([repo('a').applyManualAbandonPenalty({ ouid: 'p1', matchId: 'old', reason: 'missing' }), repo('b').settleMatches([match('a')])]);
  const saved = await read('sa_crew_members/p1');
  assert.equal(saved.wins, 1); assert.equal(saved.loses, 1);
  assert.equal(saved.mmr, 1190); assert.equal(saved.hsr, 1192);
});

test('manual repair with zero new reports commits once and keeps its history count stable', async () => {
  await seed({ 'sa_crew_history/old': { matchDate: '2026-03-08T13:20:00.000Z' },
    'sa_crew_manual_abandons/p1__old': { ouid: 'p1', nickname: 'one', matchId: 'old', matchDate: '2026-03-08T13:20:00.000Z' } });
  assert.deepEqual(await repo('a').settleMatches([match('old')]), []);
  assert.deepEqual(await repo('b').settleMatches([match('old')]), []);
  assert.equal((await read('sa_crew_members/p1')).loses, 1);
  assert.equal((await read('sa_crew_members/p1')).mmr, 1170);
  assert.equal((await read('sa_crew_history/old')).abandonCount, 1);
});

test('unauthorized settlement fails atomically without publishing a match or changing scores', async () => {
  await seed();
  const denied = new CrewRepository(null);
  const db = compat(env.unauthenticatedContext().firestore());
  Object.defineProperty(denied, 'db', { get: () => db });
  await assert.rejects(denied.settleMatches([match('a')]));
  assert.equal((await read('sa_crew_members/p1')).wins, 0);
  assert.equal(await read('sa_crew_history/a'), undefined);
});

test('pending-roster consumption and automatic abandon stay atomic for staff clients', async () => {
  const roster = Array.from({ length: 10 }, (_, i) => ({ ouid: `p${i + 1}`, characterName: `p${i + 1}` }));
  const extra = { 'sa_crew_match_sessions/session': { status: 'PENDING', createdAt: '2026-03-09T12:20:00.000Z', participants: roster } };
  for (const p of roster) extra[`sa_crew_members/${p.ouid}`] = member(p.characterName);
  await seed(extra);
  const players = roster.slice(0, 9).map((p) => player(p.ouid));
  await Promise.all([repo('a').settleMatches([match('a', players)]), repo('b').settleMatches([match('b', players)])]);
  const saved = await read('sa_crew_members/p10');
  assert.equal(saved.loses, 1); assert.equal(saved.mmr, 1170);
  assert.equal((await read('sa_crew_match_sessions/session')).status, 'SETTLED');
  assert.equal([await read('sa_crew_history/a'), await read('sa_crew_history/b')].filter((h) => h.matchedSessionId === 'session').length, 1);
  await assert.rejects(getDocs(collection(env.unauthenticatedContext().firestore(), 'sa_crew_match_sessions')));
});

test('rosters remain writable for SA staff and denied for ordinary or anonymous clients', async () => {
  await seed();
  const sa = env.authenticatedContext('sa-staff', { email: 'demo-c9c4b555@example.com' }).firestore();
  const rosterRef = doc(sa, 'sa_crew_match_sessions', 'staff-roster');
  const batch = writeBatch(sa); batch.set(rosterRef, { status: 'PENDING', participants: [] }); await batch.commit();
  assert.equal((await getDoc(rosterRef)).data().status, 'PENDING');
  for (const ctx of [env.unauthenticatedContext(), env.authenticatedContext('ordinary', { email: 'ordinary@example.test' })]) {
    const db = ctx.firestore();
    await assert.rejects(getDocs(collection(db, 'sa_crew_match_sessions')));
    const denied = writeBatch(db); denied.set(doc(db, 'sa_crew_match_sessions', 'forged'), { status: 'PENDING' });
    await assert.rejects(denied.commit());
  }
});
