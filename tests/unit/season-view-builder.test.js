import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSeasonViews } from '../../src/domains/stats/sudden-attack/application/season-view-builder.js';

function createMatch(index) {
  return {
    matchDate: `2026-03-${String(30 - index).padStart(2, '0')}T10:00:00.000Z`,
    kill: 10,
    death: 8,
    assist: 2,
    headshot: 3,
    mapName: `Map-${index}`,
    matchResult: index % 2 === 0 ? 'WIN' : 'LOSE',
    matchTypeName: '??겕???붾줈',
    allPlayerStats: []
  };
}

test('buildSeasonViews public scope ignores league season cutoff and keeps recent matches', () => {
  const allMatches = Array.from({ length: 25 }, (_, index) => createMatch(index));
  const seasonStart = new Date('2026-03-25T00:00:00.000Z');
  const rawStats = {
    recent_kill_death_rate: 55,
    recent_win_rate: 52,
    recent_assault_rate: 48,
    user_name: 'ranker'
  };

  const result = buildSeasonViews(allMatches, seasonStart, rawStats, null, [], { current: 0, previous: 0 }, { scope: 'public' });

  assert.equal(result.current.label, '전체 최근 20경기');
  assert.equal(result.previous.label, '전체 이전 20경기');
  assert.equal(result.current.matches.length, 20);
  assert.equal(result.previous.matches.length, 5);
  assert.equal(result.current.matches[0].mapName, 'Map-0');
  assert.equal(result.current.matches[19].mapName, 'Map-19');
  assert.equal(result.previous.matches[0].mapName, 'Map-20');
  assert.equal(result.current.stats.kdPercent, 56);
  assert.equal(result.previous.stats.kdPercent, 56);
  assert.ok(
    Math.abs(result.previous.stats.radar.combat - 50)
      < Math.abs(result.current.stats.radar.combat - 50)
  );
  assert.ok(
    Math.abs(result.previous.stats.radar.precision - 50)
      < Math.abs(result.current.stats.radar.precision - 50)
  );
  assert.equal(result.current.stats.radar.victory, 52);
  assert.equal(result.previous.stats.radar.victory, 53.6);
});
