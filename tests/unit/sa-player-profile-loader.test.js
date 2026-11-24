import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadPlayerProfileContext } from '../../src/domains/stats/sudden-attack/application/player-profile-loader.js';

test('loadPlayerProfileContext reads only crew membership for public searches', async () => {
  let active = 0;
  let maxActive = 0;
  const delayed = async (value) => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    await new Promise((resolve) => setImmediate(resolve));
    active -= 1;
    return value;
  };
  const player = { ouid: 'ouid-1', nickname: 'Tracking' };
  let matchRequest = null;
  const repository = {
    getPlayer: async () => player,
    getRecentMatches: async (_ouid, limit, _nickname, options) => {
      matchRequest = { limit, options };
      return delayed([]);
    },
    apiClient: { getRecentInfo: async () => delayed({ recent_win_rate: 50 }) }
  };
  let memberReads = 0;
  const crewRepository = {
    findMemberByOuid: async () => {
      memberReads += 1;
      return delayed({ id: 'ouid-1', characterName: 'Tracking', mmr: 1600 });
    },
    getLatestSeasonArchiveHistory: async () => assert.fail('public search must not read season archives'),
    getSeasonStartDate: async () => assert.fail('public search must not read season metadata'),
    getHistory: async () => assert.fail('public search must not read crew history'),
    buildMemberAbandonSummary: () => assert.fail('public search must not build crew abandon stats')
  };

  const context = await loadPlayerProfileContext({
    repository,
    crewRepository,
    characterName: 'Tracking',
    scope: 'public'
  });

  assert.ok(maxActive >= 2);
  assert.equal(context.player, player);
  assert.equal(context.player.isCrew, true);
  assert.equal(memberReads, 1);
  assert.deepEqual(context.mergedMatches, []);
  assert.deepEqual(context.rawStats, { recent_win_rate: 50 });
  assert.equal(context.memberData, null);
  assert.deepEqual(context.archivedPreviousTrend, []);
  assert.deepEqual(context.abandonSummary, { current: 0, previous: 0 });
  assert.equal(matchRequest.limit, 40);
  assert.deepEqual(matchRequest.options.matchTypes, [
    '랭크전 솔로',
    '랭크전 파티',
    '퀵매치 클랜전',
    '클랜전',
    '토너먼트'
  ]);
});
