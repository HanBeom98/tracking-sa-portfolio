import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildActivityDayComparison, buildPlayerActivitySummary, filterActivityMatches } from '../../src/domains/stats/sudden-attack/ui/components/player-activity.js';

test('player activity groups match timestamps into Korea time slots', () => {
  const summary = buildPlayerActivitySummary([
    { matchDate: '2026-07-19T03:00:00.000Z' },
    { matchDate: '2026-07-19T04:00:00.000Z' },
    { matchDate: '2026-07-17T16:00:00.000Z' },
    { matchDate: 'invalid' }
  ], { now: '2026-07-19T12:00:00.000Z' });

  assert.equal(summary.total, 3);
  assert.equal(summary.days, 2);
  assert.equal(summary.primary, '오후 12–17시');
  assert.deepEqual(summary.slots.map((slot) => slot.count), [1, 0, 2, 0]);
  assert.deepEqual(summary.slots.map((slot) => slot.percent), [33, 0, 67, 0]);
});

test('player activity returns a clear empty state', () => {
  const summary = buildPlayerActivitySummary([]);

  assert.equal(summary.total, 0);
  assert.equal(summary.days, 0);
  assert.equal(summary.latest, '기록 없음');
  assert.equal(summary.primary, '데이터 부족');
  assert.ok(summary.slots.every((slot) => slot.percent === 0));
  assert.equal(summary.daily.length, 31);
  assert.ok(summary.daily.every((day) => day.level === 0));
});

test('player activity builds a fixed 31-day heatmap with daily win rate and K/D', () => {
  const summary = buildPlayerActivitySummary([
    { matchDate: '2026-07-19T03:00:00.000Z', matchResult: 'WIN', kill: 8, death: 2 },
    { matchDate: '2026-07-19T04:00:00.000Z', matchResult: 'LOSE', kill: 2, death: 8 },
    { matchDate: '2026-07-18T03:00:00.000Z', matchResult: 'WIN', kill: 6, death: 4 }
  ], { now: '2026-07-19T12:00:00.000Z', days: 31 });

  assert.equal(summary.daily.length, 31);
  assert.equal(summary.days, 2);
  assert.equal(summary.total, 3);
  assert.equal(summary.winRate, 67);
  assert.equal(summary.kd, 53);
  const july19 = summary.daily.find((day) => day.date === '2026-07-19');
  assert.equal(july19.count, 2);
  assert.equal(july19.winRate, 50);
  assert.equal(july19.kd, 50);
  assert.ok(july19.level > 0);
});

test('daily activity comparison filters modes and uses Sudden Attack K/D percentage', () => {
  const activityMatches = [
    { matchId: 'solo-1', matchDate: '2026-07-18T03:00:00.000Z', matchTypeName: '랭크전 솔로', matchResult: 'WIN', kill: 6, death: 4 },
    { matchId: 'party-1', matchDate: '2026-07-18T04:00:00.000Z', matchTypeName: '랭크전 파티', matchResult: 'LOSE', kill: 2, death: 8 },
    { matchId: 'clan-1', matchDate: '2026-07-17T04:00:00.000Z', matchTypeName: '클랜전', matchResult: 'WIN', kill: 8, death: 2 }
  ];
  const details = activityMatches.map((match) => ({
    ...match,
    headshot: match.matchId === 'solo-1' ? 3 : 0,
    damage: match.matchId === 'solo-1' ? 1200 : 400
  }));

  assert.deepEqual(filterActivityMatches(activityMatches, { mode: 'party' }).map((match) => match.matchId), ['party-1']);
  const solo = buildActivityDayComparison(activityMatches, details, {
    date: '2026-07-18',
    mode: 'solo'
  });

  assert.equal(solo.count, 1);
  assert.equal(solo.kd, 60);
  assert.equal(solo.winRate, 100);
  assert.equal(solo.headshotRate, 50);
  assert.equal(solo.averageDamage, 1200);
  assert.equal(solo.totalDamage, 1200);
});

test('daily activity comparison excludes matches outside the recent 31-day range', () => {
  const activityMatches = [
    { matchId: 'recent-1', matchDate: '2026-07-18T03:00:00.000Z', matchResult: 'WIN', kill: 6, death: 4 },
    { matchId: 'old-1', matchDate: '2026-05-01T03:00:00.000Z', matchResult: 'LOSE', kill: 1, death: 9 }
  ];

  const comparison = buildActivityDayComparison(activityMatches, activityMatches, {
    date: '2026-07-18',
    now: '2026-07-19T12:00:00.000Z',
    days: 31
  });

  assert.equal(comparison.count, 1);
  assert.equal(comparison.baseline.count, 1);
  assert.equal(comparison.baseline.winRate, 100);
  assert.equal(comparison.baseline.kd, 60);
});

test('daily activity comparison provides a tournament-only mode', () => {
  const matches = [
    { matchId: 'tournament-1', matchDate: '2026-07-18T03:00:00.000Z', matchTypeName: '토너먼트', matchResult: 'WIN', kill: 7, death: 3 },
    { matchId: 'solo-1', matchDate: '2026-07-18T04:00:00.000Z', matchTypeName: '랭크전 솔로', matchResult: 'LOSE', kill: 2, death: 8 }
  ];

  assert.deepEqual(
    filterActivityMatches(matches, { mode: 'tournament' }).map((match) => match.matchId),
    ['tournament-1']
  );

  const tournament = buildActivityDayComparison(matches, matches, {
    date: '2026-07-18',
    mode: 'tournament'
  });
  assert.equal(tournament.count, 1);
  assert.equal(tournament.winRate, 100);
  assert.equal(tournament.kd, 70);
});
