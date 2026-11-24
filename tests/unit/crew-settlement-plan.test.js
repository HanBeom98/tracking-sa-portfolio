import test from 'node:test';
import assert from 'node:assert/strict';
import { CREW_SETTLEMENT_POLICY, planCrewSettlement, planManualAbandon } from '../../src/domains/stats/sudden-attack/domain/crew-settlement.js';

const member = (extra = {}) => ({ characterName: 'Tracking', mmr: 1200, hsr: 1200, wins: 0, loses: 0, crewKills: 0, crewDeaths: 0, mmrHistory: [], ...extra });
const player = (extra = {}) => ({ ouid: 'p1', nickname: 'Tracking', isCrew: true, result: 'WIN', kill: 4, death: 4, kd: 1, ...extra });
const match = (id = 'a', players = [player()], date = '2026-03-09T13:20:00.000Z') => ({ matchId: id, matchDate: date, mapName: 'map', crewParticipants: players.map(p => p.nickname), allPlayerStats: players });
const input = (extra = {}) => ({ matches: [match()], season: { startDate: '2026-01-01T00:00:00Z' }, members: [{ id: 'p1', data: member() }], ...extra });
const manual = (extra = {}) => ({ memberData: member(), historyData: { matchDate: '2026-03-08T13:20:00Z', map: 'map' }, manualExists: false, resolvedOuid: 'p1', matchId: 'old', reason: ' missing ', appliedBy: { uid: 'staff', email: 'staff@example.test' }, ...extra });

test('settlement preserves every MMR gap threshold and capped win/loss bonuses', () => {
  const cases = [
    [-151, 10, -30], [-150, 10, -30], [-149, 16, -24],
    [-80, 16, -24], [-79, 20, -20], [0, 20, -20],
    [79, 20, -20], [80, 24, -16], [149, 24, -16], [150, 30, -10], [151, 30, -10]
  ];
  for (const [gap, win, loss] of cases) {
    for (const [result, expected] of [['WIN', win], ['LOSE', loss]]) {
      const plan = planCrewSettlement(input({ members: [{ id: 'p1', data: member({ hsr: 1200 + gap }) }], matches: [match('a', [player({ result })])] }));
      assert.equal(plan.reports[0].playerChanges[0].mmrDiff, expected, `${gap}/${result}`);
    }
  }
  for (const [result, expected] of [['WIN', 25], ['LOSE', -15]]) {
    const plan = planCrewSettlement(input({ matches: [match('a', [player({ result, isMvp: true, damage: 2000, headshot: 9 })])] }));
    assert.equal(plan.reports[0].playerChanges[0].mmrDiff, expected);
  }
});

test('settlement preserves HSR KD boundaries and the eight-engagement bonus', () => {
  for (const [result, kd, kill, death, expected] of [
    ['WIN', 0.4, 2, 5, -10], ['WIN', 0.4001, 2, 5, 10],
    ['WIN', 1, 3, 4, 10], ['WIN', 1, 4, 4, 12], ['WIN', 2.5, 10, 4, 27],
    ['LOSE', 1.7, 7, 4, 7], ['LOSE', 1.699, 7, 4, -8],
    ['LOSE', 1, 4, 4, -8], ['LOSE', 0, 0, 10, -25], ['LOSE', 0.8, 4, 5, -11]
  ]) {
    const plan = planCrewSettlement(input({ matches: [match('a', [player({ result, kd, kill, death })])] }));
    assert.equal(plan.reports[0].playerChanges[0].hsrDiff, expected, `${result}/${kd}/${kill + death}`);
  }
});

test('settlement plans can be recalculated from frozen snapshots without mutating trend or inputs', () => {
  const snapshot = input({ members: [{ id: 'p1', data: member({ mmrHistory: [{ mmr: 1200, hsr: 1200, date: 'old' }] }) }] });
  const before = structuredClone(snapshot);
  const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } };
  freeze(snapshot);
  const first = planCrewSettlement(snapshot);
  assert.deepEqual(planCrewSettlement(snapshot), first);
  assert.deepEqual(snapshot, before);
  assert.equal(first.memberUpdates[0].data.mmrHistory.length, 2);
  first.memberUpdates[0].data.mmrHistory.push({ date: 'discarded-attempt' });
  assert.equal(planCrewSettlement(snapshot).memberUpdates[0].data.mmrHistory.length, 2);
});

test('temporary nicknames and a return to the original nickname settle to the same OUID', () => {
  const snapshot = input({
    members: [{ id: 'p1', data: member({ characterName: 'Shadow7days', previousNames: ['Tracking'], migratedFrom: 'legacy-p1' }) }],
    matches: [match('b', [player({ ouid: '', nickname: 'TRACKING' })], '2026-03-10T13:20:00Z'), match('a', [player({ nickname: 'Shadow7days' })])]
  });
  const plan = planCrewSettlement(snapshot);
  assert.deepEqual(plan.reports.map(r => r.match.matchId), ['a', 'b']);
  assert.equal(plan.memberUpdates.length, 1);
  assert.equal(plan.memberUpdates[0].id, 'p1');
  assert.equal(plan.memberUpdates[0].data.wins, 2);
  assert.equal(plan.memberUpdates[0].data.mmr, 1240);
  assert.equal(snapshot.members[0].data.characterName, 'Shadow7days');
  assert.deepEqual(snapshot.members[0].data.previousNames, ['Tracking']);
  assert.equal(snapshot.members[0].data.migratedFrom, 'legacy-p1');
  assert.equal('previousNames' in plan.memberUpdates[0].data, false);
});

test('known OUID takes precedence over a colliding name and duplicate rows do not add wins', () => {
  const p = player({ nickname: 'Collision' });
  const plan = planCrewSettlement(input({ members: [{ id: 'p1', data: member() }, { id: 'p2', data: member({ characterName: 'Collision' }) }], matches: [match('a', [p, p]), match('a', [p])] }));
  assert.deepEqual(plan.memberUpdates.map(w => w.id), ['p1']);
  assert.equal(plan.memberUpdates[0].data.wins, 1);
  assert.equal(plan.reports.length, 1);
});

test('zero-match members and previous-season or settled matches create no member writes', () => {
  const snapshot = input({ matches: [match('before', [player()], '2025-01-01T00:00:00Z'), match('done')], histories: [{ id: 'done', data: { matchDate: '2026-03-09T13:20:00Z' } }] });
  assert.deepEqual(planCrewSettlement(snapshot), { historyWrites: [], sessionUpdates: [], memberUpdates: [], reports: [] });
  assert.equal(snapshot.members[0].data.wins, 0);
  assert.equal(snapshot.members[0].data.loses, 0);
});

test('manual plans retain reasons, staff attribution and fifty-point history without mutating records', () => {
  const args = manual({ memberData: member({ mmrHistory: Array.from({ length: 50 }, (_, i) => ({ date: `old-${i}`, mmr: 1200, hsr: 1200 })) }) });
  const before = structuredClone(args);
  const plan = planManualAbandon(args);
  assert.deepEqual(args, before);
  assert.equal(plan.memberUpdate.mmr, 1170);
  assert.equal(plan.memberUpdate.hsr, 1180);
  assert.equal(plan.memberUpdate.loses, 1);
  assert.equal(plan.memberUpdate.mmrHistory.length, 50);
  assert.equal(plan.memberUpdate.mmrHistory[0].date, 'old-1');
  assert.deepEqual(plan.historyUpdate.manualAbandonOuids, ['p1']);
  assert.deepEqual(plan.historyUpdate.manualAbandonReasons, ['missing']);
  assert.deepEqual(plan.historyUpdate.manualAbandonAppliedByEmails, ['staff@example.test']);
  assert.equal(plan.manualEntry.appliedByUid, 'staff');
  assert.equal('createdAt' in plan.manualEntry, false);
  assert.equal(plan.report.newMmr, 1170);
});

test('manual plans reject each duplicate receipt and invalid reason before producing a write plan', () => {
  assert.throws(() => planManualAbandon(manual({ reason: ' ' })), /사유/);
  assert.throws(() => planManualAbandon(manual({ manualExists: true })), /이미/);
  assert.throws(() => planManualAbandon(manual({ historyData: { matchDate: 'date', manualAbandonOuids: ['p1'] } })), /이미/);
  assert.throws(() => planManualAbandon(manual({ memberData: member({ mmrHistory: [{ date: '2026-03-08T13:20:00Z' }] }) })), /중복/);
  assert.throws(() => planManualAbandon(manual({ historyData: {} })), /날짜/);
});

test('manual recovery plans commit receipts even without a new report and respect explicit policy', () => {
  const entry = { ouid: 'p1', nickname: 'Tracking', matchId: 'old', matchDate: '2026-03-08T13:20:00Z' };
  const snapshot = input({ matches: [match('old')], histories: [{ id: 'old', data: { matchDate: entry.matchDate } }], manualEntries: [{ id: 'p1__old', data: entry }] });
  const policy = { ...CREW_SETTLEMENT_POLICY, abandonMmrPenalty: -40, abandonHsrPenalty: -25, historyLimit: 1 };
  const plan = planCrewSettlement(snapshot, policy);
  assert.equal(plan.reports.length, 0);
  assert.equal(plan.memberUpdates[0].data.mmr, 1160);
  assert.equal(plan.memberUpdates[0].data.hsr, 1175);
  assert.equal(plan.historyWrites[0].merge, true);
  assert.deepEqual(plan.historyWrites[0].data.manualAbandonOuids, ['p1']);
  const manualPlan = planManualAbandon(manual(), policy);
  assert.equal(manualPlan.report.newMmr, 1160);
  assert.equal(manualPlan.report.newHsr, 1175);
});
