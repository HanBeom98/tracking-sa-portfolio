import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  buildTeamStrengthForecast,
  detectReplayCategory,
  getReplayForecastWindow,
  loadTeamStrengthProfiles,
  resolveReplayCategory,
  scorePlayerStrength
} from '../../src/domains/stats/sudden-attack/replay/domain/team-strength-forecast.js';

test('allows strength forecasts only during the first seven days after a replay', () => {
  const replay = { replay_info: { replayMatchSummaryInfo: { matchDate: '2026-07-20 PM 14:35' } } };
  const boundary = getReplayForecastWindow(replay, new Date('2026-07-27T05:35:00.000Z'));
  const expired = getReplayForecastWindow(replay, new Date('2026-07-27T05:35:00.001Z'));
  assert.equal(boundary.matchDate.toISOString(), '2026-07-20T05:35:00.000Z');
  assert.equal(boundary.eligible, true);
  assert.equal(expired.eligible, false);
  assert.equal(expired.reason, 'expired');
  assert.equal(getReplayForecastWindow({}, new Date()).reason, 'invalid-date');
  assert.equal(getReplayForecastWindow({
    replay_info: { replayMatchSummaryInfo: { matchDate: '2026-02-31 PM 14:35' } }
  }, new Date()).reason, 'invalid-date');
});

test('scores mode-specific player strength from recent match summaries and tier', () => {
  const result = scorePlayerStrength({
    matches: Array.from({ length: 10 }, (_, index) => ({ matchResult: index < 6 ? 'WIN' : 'LOSE', kill: 7, death: 3 })),
    tier: { solo_rank_match_tier: 'MASTER I', party_rank_match_tier: 'BRONZE I' },
    category: 'solo'
  });
  assert.equal(result.metricCount, 3);
  assert.equal(result.sampleSize, 10);
  assert.equal(result.winRate, 60);
  assert.equal(result.tier, 'MASTER I');
  assert.ok(result.score > 50);
});

test('detects supported replay categories from match summary metadata', () => {
  assert.equal(detectReplayCategory({ replay_info: { replayMatchSummaryInfo: { matchType: '랭크전 솔로' } } }), 'solo');
  assert.equal(detectReplayCategory({ replay_info: { replayMatchSummaryInfo: { game_mode: '랭크전 파티' } } }), 'party');
  assert.equal(detectReplayCategory({ replay_info: { replayMatchSummaryInfo: { match_type: '퀵매치 클랜전' } } }), 'clan');
  assert.equal(detectReplayCategory({ replay_info: { replayMatchSummaryInfo: { match_type: '토너먼트' } } }), 'tournament');
  assert.equal(detectReplayCategory({ replay_info: { replayMatchSummaryInfo: { mapName: '프로방스' } } }), '');
});

test('resolves coded replay types from the exact match id in the replay filename', async () => {
  const requestedIds = [];
  const category = await resolveReplayCategory({
    replay_info: { replayMatchSummaryInfo: { matchID: 260616143444007000, matchType: 'R' } }
  }, {
    async getMatchDetail(matchId) {
      requestedIds.push(matchId);
      return { match_type: '랭크전 파티' };
    }
  }, '260616143444007001.json');
  assert.equal(category, 'party');
  assert.deepEqual(requestedIds, ['260616143444007001']);
});

test('uses manual fallback only when automatic replay type resolution fails', async () => {
  const category = await resolveReplayCategory({
    replay_info: { replayMatchSummaryInfo: { matchType: 'R' } }
  }, { async getMatchDetail() { throw new Error('unavailable'); } }, 'renamed.json');
  assert.equal(category, '');
});

test('resolves tournament replays from Nexon match detail', async () => {
  const category = await resolveReplayCategory({
    replay_info: { replayMatchSummaryInfo: { matchType: 'R' } }
  }, {
    async getMatchDetail() { return { match_type: '토너먼트' }; }
  }, '260728143444007001.json');
  assert.equal(category, 'tournament');
});

test('describes a win by the statistically weaker team as an upset', () => {
  const players = [
    ...Array.from({ length: 5 }, (_, index) => ({ nickName: `A${index}`, teamNo: 1, profile: { score: 38 } })),
    ...Array.from({ length: 5 }, (_, index) => ({ nickName: `B${index}`, teamNo: 2, profile: { score: 70 } }))
  ];
  const result = buildTeamStrengthForecast(players, 1);
  assert.equal(result.winner.probability, 25);
  assert.equal(result.tone, 'upset');
  assert.match(result.verdict, /질 경기였는데 뒤집었습니다/);
});

test('reuses successful memory entries and allows failed lookups to retry', async () => {
  let ouidCalls = 0;
  const api = {
    async getOuid(name) { ouidCalls += 1; if (name === 'Missing') throw new Error('PLAYER_NOT_FOUND'); return name; },
    async getMatchList() { return { match: [{ match_id: 'm1', date_match: '2026-01-01', match_result: '1', kill: 5, death: 5 }] }; },
    async getPlayerTier() { return { solo_rank_match_tier: 'GOLD I' }; }
  };
  const cache = new Map();
  const players = [{ nickName: 'Found', teamNo: 1 }, { nickName: 'Missing', teamNo: 2 }];
  const first = await loadTeamStrengthProfiles(players, api, 'solo', { cache });
  const second = await loadTeamStrengthProfiles(players, api, 'solo', { cache });
  assert.equal(first[0].profile.metricCount, 2);
  assert.equal(first[1].profile, null);
  assert.equal(second[0].profile.metricCount, 2);
  assert.equal(ouidCalls, 3);
});

test('does not count an empty match history as an available neutral player', async () => {
  const api = {
    async getOuid() { return 'empty-ouid'; },
    async getMatchList() { return { match: [] }; },
    async getPlayerTier() { return { solo_rank_match_tier: 'MASTER I' }; }
  };
  const [player] = await loadTeamStrengthProfiles([{ nickName: 'Empty', teamNo: 1 }], api, 'solo');
  assert.equal(player.profile, null);
});

test('does not request current tier for a historical replay forecast', async () => {
  let tierCalls = 0;
  const api = {
    async getOuid() { return 'ranked-ouid'; },
    async getMatchList() {
      return { match: [{ match_id: 'm1', date_match: '2026-01-01', match_result: '1', kill: 7, death: 3 }] };
    },
    async getPlayerTier() { tierCalls += 1; return { solo_rank_match_tier: 'LEGEND' }; }
  };
  const [player] = await loadTeamStrengthProfiles([{ nickName: 'Ranked', teamNo: 1 }], api, 'solo');
  assert.equal(player.profile.sampleSize, 1);
  assert.equal(player.profile.metricCount, 2);
  assert.equal(player.profile.tier, '티어 정보 없음');
  assert.equal(tierCalls, 0);
});

test('uses only matches played before the replay cutoff', async () => {
  const requestedDates = [];
  const api = {
    async getOuid() { return 'historical-ouid'; },
    async getMatchList(ouid, matchType, gameMode, date) {
      requestedDates.push(date);
      return {
        match: [
          { match_id: `before-${date}`, date_match: '2026-07-20T04:00:00.000Z', match_result: '1', kill: 9, death: 3 },
          { match_id: `after-${date}`, date_match: '2026-07-20T06:00:00.000Z', match_result: '0', kill: 1, death: 9 }
        ]
      };
    },
    async getPlayerTier() { return {}; }
  };
  const cutoff = new Date('2026-07-20T05:35:00.000Z');
  const [player] = await loadTeamStrengthProfiles(
    [{ nickName: 'Historical', teamNo: 1 }], api, 'solo', { cache: new Map(), cutoffDate: cutoff }
  );
  assert.ok(player.profile.sampleSize > 0);
  assert.equal(player.profile.winRate, 100);
  assert.deepEqual(requestedDates,[undefined]);
  assert.equal(player.profile.sampleSize,1);
});

test('loads only the ten most recent tournament matches before the replay', async () => {
  const requestedTypes = [];
  const api = {
    async getOuid() { return 'tournament-ouid'; },
    async getMatchList(ouid, matchType) {
      requestedTypes.push(matchType);
      return {
        match: Array.from({ length: 15 }, (_, index) => ({
          match_id: `tournament-${index}`,
          date_match: `2026-07-20T0${Math.floor(index / 6)}:${String(index % 6).padStart(2, '0')}:00.000Z`,
          match_result: index % 2 ? '1' : '0',
          kill: 5,
          death: 5
        }))
      };
    }
  };
  const [player] = await loadTeamStrengthProfiles(
    [{ nickName: 'CupPlayer', teamNo: 1 }],
    api,
    'tournament',
    { cutoffDate: new Date('2026-07-20T05:35:00.000Z') }
  );
  assert.equal(player.profile.sampleSize, 10);
  assert.deepEqual([...new Set(requestedTypes)], ['토너먼트']);
  const forecast = buildTeamStrengthForecast([
    { nickName: 'A', teamNo: 1, profile: player.profile },
    { nickName: 'B', teamNo: 2, profile: player.profile }
  ], 1, 'tournament');
  assert.equal(forecast.category, 'tournament');
  assert.match(forecast.basis, /최대 10경기/);
});

test('reports player lookup progress and successful profile counts', async () => {
  const progress = [];
  const api = {
    async getOuid(name) {
      if (name === 'Missing') throw new Error('PLAYER_NOT_FOUND');
      return `${name}-ouid`;
    },
    async getMatchList(ouid) {
      return {
        match: [{
          match_id: `${ouid}-match`,
          date_match: '2026-07-20T01:00:00.000Z',
          match_result: '1',
          kill: 5,
          death: 5
        }]
      };
    }
  };
  await loadTeamStrengthProfiles([
    { nickName: 'One', teamNo: 1 },
    { nickName: 'Missing', teamNo: 1 },
    { nickName: 'Two', teamNo: 2 }
  ], api, 'solo', {
    concurrency: 2,
    onProgress: (value) => progress.push({ ...value })
  });
  assert.deepEqual(progress[0], { completed: 0, total: 3, successful: 0 });
  assert.deepEqual(progress.at(-1), { completed: 3, total: 3, successful: 2 });
  assert.deepEqual(progress.map((value) => value.completed), [0, 1, 2, 3]);
});

test('stale forecast work stops before further lookups, match fetches and progress', async () => {
  let current = true;
  let release;
  const lookups = [], progress = [];
  const client = {
    getOuid(name) { lookups.push(name); return new Promise(resolve => { release = resolve; }); },
    getMatches() { assert.fail('cancelled forecast must not start a match request'); },
  };
  const pending = loadTeamStrengthProfiles([
    { nickName: 'first' }, { nickName: 'second' }, { nickName: 'third' },
  ], client, 'solo', { concurrency: 1, isCurrent: () => current, onProgress: value => progress.push(value.completed) });
  assert.deepEqual(lookups, ['first']);
  current = false;
  release('test-ouid');
  assert.deepEqual(await pending, []);
  assert.deepEqual(lookups, ['first']);
  assert.deepEqual(progress, [0]);
});

test('replay selector includes tournament forecasts', () => {
  const html = fs.readFileSync('src/domains/stats/sudden-attack/replay/index.html', 'utf8');
  assert.match(html, /<option value="tournament">토너먼트<\/option>/);
});
