import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPublicPlayerCardData } from '../../src/domains/stats/sudden-attack/ui/runtime/public-search-view.js';

test('public player card keeps website crew membership separate from league stats', () => {
  const data = buildPublicPlayerCardData(
    {
      player: { ouid: 'ouid-1', nickname: 'Tracking', isCrew: true }
    },
    {
      stats: { isCrew: false, crewMmr: 1200, kdPercent: 55 },
      matches: [{ matchId: 'match-1' }]
    }
  );

  assert.equal(data.isCrew, true);
  assert.equal(data.kdPercent, 55);
  assert.equal(data.crewMmr, 1200);
  assert.deepEqual(data.recentMatches, [{ matchId: 'match-1' }]);
  assert.equal(data.context, 'public');
});

test('an absent comparison window retains known official summaries without inventing selected-window metrics',()=>{
  const data=buildPublicPlayerCardData({player:{nickname:'Fixture'},stats:{officialRecentKd:65,officialRecentWinRate:70,kdPercent:80}}, {stats:{totalMatchesCount:0},matches:[]});
  assert.equal(data.officialRecentKd,65);assert.equal(data.officialRecentWinRate,70);
  assert.equal(data.kdPercent,undefined);assert.equal(data.totalMatchesCount,0);
});
