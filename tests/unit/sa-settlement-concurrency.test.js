import test from 'node:test';
import assert from 'node:assert/strict';
import { CrewRepository } from '../../src/domains/stats/sudden-attack/infra/crew-repository.js';
import { createTransactionalFirestore } from '../helpers/transactional-firestore.js';

const member = (name = 'one') => ({ characterName: name, mmr: 1200, hsr: 1200, wins: 0, loses: 0, crewKills: 0, crewDeaths: 0, mmrHistory: [] });
const player = (id = 'p1', extra = {}) => ({ ouid: id, nickname: id === 'p1' ? 'one' : id, isCrew: true, result: 'WIN', kill: 10, death: 10, kd: 1, ...extra });
const match = (id, players = [player()], date = '2026-03-09T13:20:00.000Z') => ({ matchId: id, matchDate: date, mapName: 'map', crewParticipants: players.map((p) => p.nickname), allPlayerStats: players });
const seed = (extra = {}) => ({ 'sa_crew_members/p1': member(), 'sa_crew_settings/season': { startDate: '2026-01-01T00:00:00.000Z' }, ...extra });
const manualEntry = (id = 'old', ouid = 'p1', date = '2026-03-08T13:20:00.000Z') => ({ ouid, nickname: ouid === 'p1' ? 'one' : ouid, matchId: id, matchDate: date });

async function withStore(initial, run) {
  const previous = globalThis.window;
  const db = createTransactionalFirestore(initial);
  globalThis.window = { db, firebase: { firestore: { FieldValue: { serverTimestamp: () => 'server-time' } } } };
  try { await run(db, () => new CrewRepository(null)); }
  finally { if (previous === undefined) delete globalThis.window; else globalThis.window = previous; }
}

test('concurrent different matches retain both wins, scores, kills and trend entries', async () => {
  await withStore(seed(), async (db, repo) => {
    const reports = await Promise.all([repo().settleMatches([match('a')]), repo().settleMatches([match('b')])]);
    assert.equal(reports.flat().length, 2);
    assert.ok(db.retries >= 1);
    assert.equal(db.read('sa_crew_members/p1').wins, 2);
    assert.equal(db.read('sa_crew_members/p1').mmr, 1240);
    assert.equal(db.read('sa_crew_members/p1').hsr, 1224);
    assert.equal(db.read('sa_crew_members/p1').crewKills, 20);
    assert.equal(db.read('sa_crew_members/p1').crewDeaths, 20);
    assert.equal(db.read('sa_crew_members/p1').mmrHistory.length, 2);
    assert.equal(reports.flat().map((r) => r.playerChanges[0].newMmr).sort().join(','), '1220,1240');
  });
});

test('concurrent same-match requests return exactly one committed report', async () => {
  await withStore(seed(), async (db, repo) => {
    const reports = await Promise.all([repo().settleMatches([match('a')]), repo().settleMatches([match('a')])]);
    assert.equal(reports.flat().length, 1);
    assert.equal(db.read('sa_crew_members/p1').wins, 1);
    assert.equal(db.read('sa_crew_members/p1').mmr, 1220);
    assert.equal(db.paths().filter((path) => path.startsWith('sa_crew_history/')).length, 1);
  });
});

test('overlapping batches settle each match once', async () => {
  await withStore(seed(), async (db, repo) => {
    const reports = await Promise.all([repo().settleMatches([match('a'), match('b')]), repo().settleMatches([match('b'), match('c')])]);
    assert.equal(reports.flat().length, 3);
    assert.equal(db.read('sa_crew_members/p1').wins, 3);
    assert.equal(db.read('sa_crew_members/p1').mmr, 1260);
  });
});

test('rejected commit leaves all members/history unchanged and produces no report', async () => {
  await withStore(seed({ 'sa_crew_members/p2': member('p2') }), async (db, repo) => {
    db.failNextCommit = true;
    await assert.rejects(repo().settleMatches([match('a', [player(), player('p2')])]), /commit rejected/);
    assert.deepEqual(db.read('sa_crew_members/p1'), member());
    assert.deepEqual(db.read('sa_crew_members/p2'), member('p2'));
    assert.equal(db.read('sa_crew_history/a'), undefined);
    const reports = await repo().settleMatches([match('a')]);
    assert.equal(reports.length, 1);
    assert.equal(db.read('sa_crew_members/p1').wins, 1);
  });
});

test('a season change during an attempt forces a retry with the new cutoff', async () => {
  await withStore(seed(), async (db, repo) => {
    db.beforeCommit = () => { db.beforeCommit = null; db.write('sa_crew_settings/season', { startDate: '2026-04-01T00:00:00.000Z' }); };
    assert.deepEqual(await repo().settleMatches([match('a')]), []);
    assert.equal(db.read('sa_crew_members/p1').wins, 0);
    assert.equal(db.read('sa_crew_history/a'), undefined);
    assert.equal(db.retries, 1);
  });
});

test('duplicate match/player input is only counted once and rating bonuses are preserved', async () => {
  await withStore(seed(), async (db, repo) => {
    const p = player('p1', { kill: 20, kd: 2, damage: 2000, headshot: 8, isMvp: true });
    const m = match('a', [p, p]);
    assert.equal((await repo().settleMatches([m, m])).length, 1);
    const saved = db.read('sa_crew_members/p1');
    assert.equal(saved.wins, 1);
    assert.equal(saved.mmr, 1225);
    assert.equal(saved.hsr, 1222);
    assert.equal(saved.crewKills, 20);
  });
});

test('one pending roster is consumed once even by concurrent different matches', async () => {
  const roster = Array.from({ length: 10 }, (_, i) => ({ ouid: `p${i + 1}`, characterName: `p${i + 1}` }));
  const initial = seed({ 'sa_crew_match_sessions/session': { status: 'PENDING', createdAt: '2026-03-09T12:20:00.000Z', participants: roster } });
  for (const p of roster) initial[`sa_crew_members/${p.ouid}`] = member(p.characterName);
  await withStore(initial, async (db, repo) => {
    const players = roster.slice(0, 9).map((p) => player(p.ouid));
    await Promise.all([repo().settleMatches([match('a', players)]), repo().settleMatches([match('b', players)])]);
    assert.equal(db.read('sa_crew_members/p10').loses, 1);
    assert.equal(db.read('sa_crew_members/p10').mmr, 1170);
    assert.equal(db.read('sa_crew_match_sessions/session').status, 'SETTLED');
    assert.equal([db.read('sa_crew_history/a'), db.read('sa_crew_history/b')].filter((h) => h.matchedSessionId === 'session').length, 1);
  });
});

test('concurrent duplicate manual penalties deduct once and reject the duplicate', async () => {
  await withStore(seed({ 'sa_crew_history/old': { matchDate: '2026-03-08T13:20:00.000Z' } }), async (db, repo) => {
    const apply = () => repo().applyManualAbandonPenalty({ ouid: 'p1', matchId: 'old', reason: 'missing participant' });
    const results = await Promise.allSettled([apply(), apply()]);
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    assert.match(results.find((r) => r.status === 'rejected').reason.message, /이미/);
    assert.equal(db.read('sa_crew_members/p1').loses, 1);
    assert.equal(db.read('sa_crew_members/p1').mmr, 1170);
    assert.equal(db.read('sa_crew_history/old').abandonCount, 1);
  });
});

test('manual penalty and normal settlement cannot overwrite each other', async () => {
  await withStore(seed({ 'sa_crew_history/old': { matchDate: '2026-03-08T13:20:00.000Z' } }), async (db, repo) => {
    await Promise.all([repo().applyManualAbandonPenalty({ ouid: 'p1', matchId: 'old', reason: 'missing' }), repo().settleMatches([match('a')])]);
    const saved = db.read('sa_crew_members/p1');
    assert.equal(saved.wins, 1); assert.equal(saved.loses, 1);
    assert.equal(saved.mmr, 1190); assert.equal(saved.hsr, 1192);
  });
});

test('manual repair commits even without a new match report and is repeatable without extra deductions', async () => {
  const entry = manualEntry();
  await withStore(seed({ 'sa_crew_history/old': { matchDate: entry.matchDate }, 'sa_crew_manual_abandons/p1__old': entry }), async (db, repo) => {
    assert.deepEqual(await repo().settleMatches([match('old')]), []);
    assert.equal(db.read('sa_crew_members/p1').loses, 1);
    assert.equal(db.read('sa_crew_members/p1').mmr, 1170);
    assert.equal(db.read('sa_crew_history/old').abandonCount, 1);
    assert.deepEqual(await repo().settleMatches([match('old')]), []);
    assert.equal(db.read('sa_crew_members/p1').loses, 1);
    assert.equal(db.read('sa_crew_history/old').abandonCount, 1);
  });
});

test('persistent history receipts prevent reapplying penalties after the rolling trend is gone', async () => {
  const entry = manualEntry();
  await withStore(seed({ 'sa_crew_members/p1': { ...member(), mmr: 1170, hsr: 1180, loses: 1 },
    'sa_crew_history/old': { matchDate: entry.matchDate, abandonCount: 1, manualAbandonOuids: ['p1'], manualAbandonNicknames: ['one'] },
    'sa_crew_manual_abandons/p1__old': entry }), async (db, repo) => {
    await repo().settleMatches([match('old')]);
    assert.equal(db.read('sa_crew_members/p1').loses, 1);
    assert.equal(db.read('sa_crew_members/p1').mmr, 1170);
    assert.equal(db.read('sa_crew_history/old').abandonCount, 1);
  });
});

test('old-season and orphaned manual records do not alter the current zero-match season', async () => {
  const entry = manualEntry('old', 'p1', '2025-03-09T13:20:00.000Z');
  await withStore(seed({ 'sa_crew_history/old': { matchDate: entry.matchDate },
    'sa_crew_history/existing': { matchDate: '2026-03-09T13:20:00.000Z' },
    'sa_crew_manual_abandons/p1__old': entry,
    'sa_crew_manual_abandons/p1__orphan': manualEntry('orphan') }), async (db, repo) => {
    await repo().settleMatches([match('old'), match('existing')]);
    assert.deepEqual(db.read('sa_crew_members/p1'), member());
    assert.equal(db.read('sa_crew_history/orphan'), undefined);
  });
});

test('manual patch counts new participants only and can enrich legacy nickname receipts', () => {
  const repo = new CrewRepository(null);
  const base = { abandonCount: 2, manualAbandonNicknames: ['one', 'two'] };
  const entries = [{ ouid: 'p1', nickname: 'one' }, { ouid: 'p2', nickname: 'two' }];
  const first = repo.buildManualAbandonHistoryPatch(entries, base);
  assert.equal(first.abandonCount, 2);
  assert.deepEqual(first.manualAbandonOuids, ['p1', 'p2']);
  assert.deepEqual(repo.buildManualAbandonHistoryPatch(entries, first), first);
  assert.equal(repo.buildManualAbandonHistoryPatch([{ ouid: 'p3', nickname: 'three' }], first).abandonCount, 3);
  assert.equal(repo.buildManualAbandonHistoryPatch([{ ouid: 'p3', nickname: 'three' }], { abandonCount: 1, abandonOuids: ['p3'] }).abandonCount, 1);
});

test('automatic and persisted manual records for the same missing player are not counted twice', async () => {
  const roster = Array.from({ length: 10 }, (_, i) => ({ ouid: `p${i + 1}`, characterName: `p${i + 1}` }));
  const initial = seed({ 'sa_crew_match_sessions/session': { status: 'PENDING', createdAt: '2026-03-09T12:20:00.000Z', participants: roster },
    'sa_crew_manual_abandons/p10__a': manualEntry('a', 'p10', '2026-03-09T13:20:00.000Z') });
  for (const p of roster) initial[`sa_crew_members/${p.ouid}`] = member(p.characterName);
  await withStore(initial, async (db, repo) => {
    const m = match('a', roster.slice(0, 9).map((p) => player(p.ouid)));
    await repo().settleMatches([m]);
    await repo().settleMatches([m]);
    assert.equal(db.read('sa_crew_members/p10').loses, 1);
    assert.equal(db.read('sa_crew_members/p10').mmr, 1170);
    assert.equal(db.read('sa_crew_history/a').abandonCount, 1);
    assert.deepEqual(db.read('sa_crew_history/a').manualAbandonOuids, ['p10']);
  });
});
