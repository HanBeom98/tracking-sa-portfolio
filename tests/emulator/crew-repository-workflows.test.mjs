import test, { before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, query, where, limit, orderBy,
  setDoc, updateDoc, deleteDoc, addDoc, writeBatch, runTransaction, serverTimestamp, Timestamp } from 'firebase/firestore';

const root = process.env.TRACKING_SA_RULES_ROOT || process.cwd();
const { CrewRepository } = await import(pathToFileURL(resolve(root, 'src/domains/stats/sudden-attack/infra/crew-repository.js')));
let env;
const previousWindow = globalThis.window;
before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-trackingsa-ownership', firestore: {
    host: '127.0.0.1', port: 8085, rules: readFileSync(resolve(root, 'firestore.rules'), 'utf8'),
  } });
  globalThis.window = { firebase: { firestore: { FieldValue: { serverTimestamp }, Timestamp } } };
});
beforeEach(async () => { await env.clearFirestore(); });
after(async () => {
  await env?.cleanup();
  if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow;
});

// Compat syntax only; every query, write and permission check uses the real local SDK.
function compat(db, queries) {
  const wrapDoc = raw => ({ raw, id: raw.id,
    get: async () => wrapSnapshot(await getDoc(raw)),
    set: (data, options) => options ? setDoc(raw, data, options) : setDoc(raw, data),
    update: data => updateDoc(raw, data), delete: () => deleteDoc(raw) });
  const wrapSnapshot = value => ({ id: value.id, exists: value.exists(), data: () => value.data(), ref: wrapDoc(value.ref) });
  const wrapQuery = (name, constraints = [], filters = []) => ({
    doc: id => wrapDoc(doc(db, name, id)),
    where: (...args) => wrapQuery(name, [...constraints, where(...args)], [...filters, args]),
    limit: value => wrapQuery(name, [...constraints, limit(value)], filters),
    orderBy: (...args) => wrapQuery(name, [...constraints, orderBy(...args)], filters),
    add: async data => wrapDoc(await addDoc(collection(db, name), data)),
    async get() {
      queries.push({ name, filters });
      const result = await getDocs(query(collection(db, name), ...constraints));
      const docs = result.docs.map(wrapSnapshot);
      return { docs, empty: result.empty, forEach: fn => docs.forEach(fn) };
    },
  });
  return { collection: name => wrapQuery(name), runTransaction: update => runTransaction(db, transaction => update({
    get: async ref => wrapSnapshot(await transaction.get(ref.raw)),
    set: (ref, ...args) => transaction.set(ref.raw, ...args),
    update: (ref, data) => transaction.update(ref.raw, data),
  })), batch() {
    const batch = writeBatch(db);
    return { set: (ref, ...args) => batch.set(ref.raw, ...args),
      update: (ref, data) => batch.update(ref.raw, data), delete: ref => batch.delete(ref.raw), commit: () => batch.commit() };
  } };
}
function repository(uid = 'staff', email = 'demo-9249b6f9@example.com') {
  const queries = [], repo = new CrewRepository(null);
  const db = compat(env.authenticatedContext(uid, { email }).firestore(), queries);
  Object.defineProperty(repo, 'db', { get: () => db });
  return { repo, queries };
}
const member = (characterName = 'Tracking', extra = {}) => ({ characterName, mmr: 1200, hsr: 1200,
  wins: 0, loses: 0, crewKills: 0, crewDeaths: 0, mmrHistory: [], ...extra });
async function seed(values) {
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore(), batch = writeBatch(db);
    for (const [path, value] of Object.entries(values)) batch.set(doc(db, path), value);
    await batch.commit();
  });
}
async function read(path) {
  return (await getDoc(doc(env.authenticatedContext('reader', { email: 'demo-9249b6f9@example.com' }).firestore(), path))).data();
}

test('temporary nickname and seven-day-style reversion retain one OUID, all aliases and zero-match scores', async () => {
  await seed({ 'sa_crew_members/stable-ouid': member('Tracking', { previousNames: ['EarlierName'] }) });
  const { repo, queries } = repository();
  await repo.updateNickname('stable-ouid', 'Shadow7days');
  assert.equal(await repo.findOuidByNickname('Shadow7days'), 'stable-ouid');
  assert.deepEqual(queries.at(-1).filters, [['characterName', '==', 'Shadow7days']]);
  queries.length = 0;
  assert.equal(await repo.findOuidByNickname('Tracking'), 'stable-ouid');
  assert.deepEqual(queries.map(q => q.filters), [
    [['characterName', '==', 'Tracking']], [['previousNames', 'array-contains', 'Tracking']],
  ]);
  queries.length = 0;
  assert.equal(await repo.findOuidByNickname('tRaCkInG'), 'stable-ouid');
  assert.equal(queries.length, 3); assert.deepEqual(queries[2].filters, []);
  await repo.updateNickname('stable-ouid', 'Tracking');
  await repo.updateNickname('stable-ouid', 'Shadow7days');
  await repo.updateNickname('stable-ouid', 'Tracking');
  const saved = await read('sa_crew_members/stable-ouid');
  assert.equal(saved.characterName, 'Tracking');
  assert.deepEqual(saved.previousNames, ['EarlierName', 'Tracking', 'Shadow7days']);
  assert.equal(await repo.findOuidByNickname('Shadow7days'), 'stable-ouid');
  assert.equal((await repo.findMemberByOuid('stable-ouid')).id, 'stable-ouid');
  assert.equal(saved.wins, 0); assert.equal(saved.loses, 0); assert.equal(saved.mmr, 1200); assert.equal(saved.hsr, 1200);
});

test('historical discoveries deduplicate names and ranking prioritizes played members without changing idle records', async () => {
  const idle = member('Tracking', { mmr: 1600, previousNames: ['Original'] });
  await seed({ 'sa_crew_members/idle': idle,
    'sa_crew_members/active': member('Active', { wins: 1, mmr: 1100, mmrHistory: [{ mmr: 1100, date: '2026-01-01' }] }) });
  const { repo } = repository();
  await repo.syncHistoricalNicknames({ idle: new Set(['Tracking', 'Original', 'Discovered']) });
  await repo.addNicknameToHistory('idle', 'Discovered');
  await repo.addNicknameToHistory('missing-ouid', 'Unknown');
  assert.deepEqual((await read('sa_crew_members/idle')).previousNames, ['Original', 'Discovered']);
  assert.equal(await read('sa_crew_members/missing-ouid'), undefined);
  const rankings = await repo.getRankings();
  assert.deepEqual(rankings.map(m => m.id), ['active', 'idle']);
  assert.equal(rankings[1].totalMatches, 0);
  assert.deepEqual(await repo.getMemberMmrHistory('active'), [{ mmr: 1100, date: '2026-01-01' }]);
  assert.equal((await read('sa_crew_members/idle')).mmr, 1600);
});

test('legacy OUID migration merges metadata, manual rename retains existing aliases and batch removal uses both identifiers', async () => {
  await seed({ 'sa_crew_members/LegacyName': member('Shadow7days', { previousNames: ['Tracking'], wins: 2, mmr: 1300 }),
    'sa_crew_members/stable-ouid': { retainedField: 'keep' } });
  const { repo } = repository();
  await repo.migrateToOuid('LegacyName', 'stable-ouid');
  assert.equal(await read('sa_crew_members/LegacyName'), undefined);
  let saved = await read('sa_crew_members/stable-ouid');
  assert.equal(saved.migratedFrom, 'LegacyName'); assert.equal(saved.retainedField, 'keep');
  assert.equal(saved.wins, 2); assert.equal(saved.mmr, 1300);
  await repo.updateNicknameManually('stable-ouid', 'ManualName');
  saved = await read('sa_crew_members/stable-ouid');
  assert.equal(saved.characterName, 'ManualName'); assert.deepEqual(saved.previousNames, ['Tracking']);
  assert.equal(await repo.findOuidByNickname('Tracking'), 'stable-ouid');
  await seed({ 'sa_crew_members/LegacyName': member('DuplicateLegacy') });
  await repo.deleteMember('stable-ouid', 'LegacyName');
  assert.equal(await read('sa_crew_members/stable-ouid'), undefined);
  assert.equal(await read('sa_crew_members/LegacyName'), undefined);
});

test('applications retain UID ownership, staff approval/rejection and atomic denial for ordinary clients', async () => {
  const staff = repository().repo, applicant = repository('applicant', 'ordinary@example.test').repo;
  await assert.rejects(applicant.applyForCrew('Applicant', 'new-ouid', ''), /로그인/);
  await applicant.applyForCrew('Applicant', 'new-ouid', 'applicant');
  await assert.rejects(applicant.applyForCrew('Applicant', 'new-ouid', 'applicant'), /이미 제출/);
  assert.equal((await staff.getPendingApplications()).length, 1);
  await assert.rejects(applicant.approveApplication('applicant', 'Applicant', 'new-ouid'));
  assert.equal((await read('sa_crew_applications/applicant')).status, 'PENDING');
  assert.equal(await read('sa_crew_members/new-ouid'), undefined);
  await staff.approveApplication('applicant', 'Applicant', 'new-ouid');
  assert.equal((await read('sa_crew_applications/applicant')).status, 'APPROVED');
  const saved = await read('sa_crew_members/new-ouid');
  assert.equal(saved.wins, 0); assert.equal(saved.loses, 0); assert.equal(saved.mmr, 1200); assert.equal(saved.hsr, 1200);
  await assert.rejects(applicant.applyForCrew('Applicant', 'new-ouid', 'applicant'), /이미 등록/);
  await repository('second', 'ordinary@example.test').repo.applyForCrew('Second', 'second-ouid', 'second');
  await staff.rejectApplication('second');
  assert.equal((await read('sa_crew_applications/second')).status, 'REJECTED');
  assert.deepEqual(await staff.getPendingApplications(), []);
});

test('history backfill resolves nickname-only aliases once and pending rosters retain filtering and ordering', async () => {
  await seed({ 'sa_crew_members/stable-ouid': member('Shadow7days', { previousNames: ['Tracking'] }),
    'sa_crew_history/old': { matchDate: '2026-01-01T00:00:00Z', map: 'local-map', manualAbandonNicknames: ['Tracking'] },
    'sa_crew_history/latest': { matchDate: '2026-01-02T00:00:00Z', map: 'latest-map' },
    'sa_crew_match_sessions/settled': { status: 'SETTLED', createdAt: Timestamp.fromMillis(1) } });
  const { repo } = repository();
  assert.deepEqual(await repo.backfillManualAbandonEntries(), { createdCount: 1, skippedCount: 0 });
  assert.deepEqual(await repo.backfillManualAbandonEntries(), { createdCount: 0, skippedCount: 1 });
  const entries = await repo.getManualAbandonEntries();
  assert.equal(entries.length, 1); assert.equal(entries[0].ouid, 'stable-ouid'); assert.equal(entries[0].nickname, 'Tracking');
  assert.deepEqual((await repo.getHistory(1)).map(item => item.matchId), ['latest']);
  await assert.rejects(repo.createPendingMatchSession({ red: [], blue: [] }), /참가자/);
  const session = await repo.createPendingMatchSession({ red: [{ ouid: 'p1', characterName: 'One' }, {}], blue: [{ ouid: 'p2', characterName: 'Two' }] });
  const sessions = await repo.getPendingMatchSessions();
  assert.equal(sessions.length, 1); assert.equal(sessions[0].id, session.id);
  assert.deepEqual(sessions[0].participants, [
    { ouid: 'p1', characterName: 'One', team: 'RED' }, { ouid: 'p2', characterName: 'Two', team: 'BLUE' },
  ]);
  assert.equal((await read('sa_crew_members/stable-ouid')).wins, 0);
});

test('season reset archives scores while keeping identity, and repair deletes only current-season history', async () => {
  await seed({ 'sa_crew_members/stable-ouid': member('Shadow7days', {
    previousNames: ['Tracking'], migratedFrom: 'LegacyName', wins: 2, mmr: 1340, hsr: 1400 }),
    'sa_crew_settings/season': { startDate: Timestamp.fromDate(new Date('2020-01-01')) } });
  const { repo } = repository();
  await repo.resetSeason();
  let saved = await read('sa_crew_members/stable-ouid');
  assert.equal(saved.characterName, 'Shadow7days'); assert.deepEqual(saved.previousNames, ['Tracking']);
  assert.equal(saved.migratedFrom, 'LegacyName'); assert.equal(saved.wins, 0); assert.equal(saved.loses, 0); assert.equal(saved.mmr, 1200);
  assert.equal((await read('sa_crew_settings/season_archive_latest')).members['stable-ouid'].finalMmr, 1340);
  await repo.reseedCurrentSeasonHsr();
  assert.equal((await read('sa_crew_members/stable-ouid')).mmr, 1200);
  await seed({ 'sa_crew_settings/season': { startDate: Timestamp.fromDate(new Date('2026-01-01')) },
    'sa_crew_history/previous': { matchDate: '2025-12-31T00:00:00Z' },
    'sa_crew_history/current': { matchDate: '2026-01-02T00:00:00Z' } });
  await repo.repairSeasonData();
  saved = await read('sa_crew_members/stable-ouid');
  assert.equal(saved.hsr, 1200); assert.equal(saved.wins, 0); assert.equal(saved.loses, 0);
  assert.deepEqual(saved.previousNames, ['Tracking']); assert.equal(saved.migratedFrom, 'LegacyName');
  assert.ok(await read('sa_crew_history/previous')); assert.equal(await read('sa_crew_history/current'), undefined);
});


test('concurrent staff decisions preserve existing member scores and apply only one pending decision', async () => {
  const existing=member('DisguiseName',{wins:17,loses:8,mmr:1640,previousNames:['OriginalName']});
  await seed({'sa_crew_members/same-ouid':existing,'sa_crew_applications/pending':{applicantUid:'pending',characterName:'OriginalName',ouid:'same-ouid',status:'PENDING',appliedAt:Timestamp.now()}});
  const results=await Promise.allSettled([repository().repo.approveApplication('pending','wrong','wrong-ouid'),repository('staff2').repo.rejectApplication('pending')]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.deepEqual(await read('sa_crew_members/same-ouid'),existing);
  assert.ok(['APPROVED','REJECTED'].includes((await read('sa_crew_applications/pending')).status));
  assert.equal(await read('sa_crew_members/wrong-ouid'),undefined);
});
