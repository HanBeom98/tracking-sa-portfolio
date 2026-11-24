import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getPublicMatchCategory,
  normalizePublicMatchCategory
} from '../../src/domains/stats/sudden-attack/application/public-match-categories.js';
import { SaPageUseCases } from '../../src/domains/stats/sudden-attack/application/sa-page-use-cases.js';
import { SaService } from '../../src/domains/stats/sudden-attack/application/sa-service.js';

test('public match categories map tabs to the intended Nexon match types', () => {
  assert.deepEqual(getPublicMatchCategory('solo').matchTypes, ['랭크전 솔로']);
  assert.deepEqual(getPublicMatchCategory('party').matchTypes, ['랭크전 파티']);
  assert.deepEqual(getPublicMatchCategory('clan').matchTypes, ['퀵매치 클랜전', '클랜전']);
  assert.deepEqual(getPublicMatchCategory('tournament').matchTypes, ['토너먼트']);
  assert.ok(getPublicMatchCategory('all').matchTypes.includes('토너먼트'));
  assert.equal(getPublicMatchCategory('all').matchTypes.includes('개인전'), false);
  assert.equal(normalizePublicMatchCategory('unknown'), 'all');
});

test('SaService builds a 20-match category view with match-based stats', async () => {
  const calls = [];
  const matches = Array.from({ length: 24 }, (_, index) => ({
    matchResult: index % 2 === 0 ? 'WIN' : 'LOSE',
    matchTypeName: '랭크전 솔로',
    matchDate: new Date(2026, 6, 19, 0, 0, 24 - index).toISOString(),
    kill: 10,
    death: 5,
    assist: 2,
    headshot: 1,
    mapName: '프로방스',
    allPlayerStats: []
  }));
  const repository = {
    apiClient: {
      async getRecentInfo() {
        return { recent_kill_death_rate: 40, recent_win_rate: 40, user_name: 'Tracking' };
      }
    },
    async getRecentMatches(_ouid, limit, _nickname, options) {
      calls.push({ limit, options });
      return matches;
    }
  };
  const service = new SaService(repository);

  const result = await service.getPublicMatchCategory({ ouid: 'ouid', nickname: 'Tracking' }, 'solo');

  assert.equal(result.key, 'solo');
  assert.equal(result.matches.length, 20);
  assert.equal(result.stats.totalMatchesCount, 20);
  assert.equal(result.stats.winRate, 50);
  assert.deepEqual(calls[0].options.matchTypes, ['랭크전 솔로']);
});

test('SaPageUseCases deduplicates and caches category requests', async () => {
  let callCount = 0;
  let releaseRequest;
  const service = {
    getPublicMatchCategory() {
      callCount += 1;
      return new Promise((resolve) => {
        releaseRequest = () => resolve({ key: 'party', matches: [] });
      });
    }
  };
  const useCases = new SaPageUseCases({ service });
  const player = { ouid: 'same-ouid', nickname: 'Tracking' };

  const first = useCases.loadPublicMatchCategory(player, 'party');
  const second = useCases.loadPublicMatchCategory(player, 'party');
  assert.equal(callCount, 1);

  releaseRequest();
  const [resolved, duplicateResult] = await Promise.all([first, second]);
  assert.equal(duplicateResult, resolved);
  const cached = await useCases.loadPublicMatchCategory(player, 'party');
  assert.equal(callCount, 1);
  assert.equal(cached, resolved);

  useCases.invalidatePublicMatchCategories(player.ouid);
  const refreshed = useCases.loadPublicMatchCategory(player, 'party');
  assert.equal(callCount, 2);
  releaseRequest();
  await refreshed;
});

test('SaPageUseCases caches 31-day player activity and supports refresh invalidation', async () => {
  let callCount = 0;
  const service = {
    async getPlayerActivity(_player, { onProgress }) {
      callCount += 1;
      onProgress?.({ completed: 1, total: 1, percent: 100 });
      return [{ matchId: `match-${callCount}` }];
    }
  };
  const useCases = new SaPageUseCases({ service });
  const player = { ouid: 'activity-ouid', nickname: 'Tracking' };

  const first = await useCases.loadPlayerActivity(player);
  const cached = await useCases.loadPlayerActivity(player);
  assert.equal(callCount, 1);
  assert.equal(cached, first);

  useCases.invalidatePlayerActivity(player.ouid);
  const refreshed = await useCases.loadPlayerActivity(player);
  assert.equal(callCount, 2);
  assert.notEqual(refreshed, first);
});

test('SaPageUseCases keeps activity in browser storage until the Korea date changes', async () => {
  const values = new Map();
  const previousLocalStorage = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key)
  };

  try {
    let callCount = 0;
    const service = {
      async getPlayerActivity() {
        callCount += 1;
        return [{ matchId: `daily-${callCount}` }];
      }
    };
    const player = { ouid: 'daily-activity-ouid', nickname: 'Tracking' };

    await new SaPageUseCases({ service }).loadPlayerActivity(player);
    const cached = await new SaPageUseCases({ service }).loadPlayerActivity(player);
    assert.equal(callCount, 1);
    assert.equal(cached[0].matchId, 'daily-1');

    const storageKey = `sa_activity_31:v4:${player.ouid}`;
    const expired = JSON.parse(values.get(storageKey));
    expired.dateKey = '2000-01-01';
    values.set(storageKey, JSON.stringify(expired));

    const refreshed = await new SaPageUseCases({ service }).loadPlayerActivity(player);
    assert.equal(callCount, 2);
    assert.equal(refreshed[0].matchId, 'daily-2');
  } finally {
    if (previousLocalStorage === undefined) {
      delete globalThis.localStorage;
    } else {
      globalThis.localStorage = previousLocalStorage;
    }
  }
});

test('SaPageUseCases caches selected activity day details across mode tabs', async () => {
  let callCount = 0;
  const service = {
    async getPlayerActivityDay() {
      callCount += 1;
      return [{ matchId: 'detail-1', damage: 1200 }];
    }
  };
  const useCases = new SaPageUseCases({ service });
  const player = { ouid: 'day-ouid', nickname: 'Tracking' };

  const first = await useCases.loadPlayerActivityDay(player, [], '2026-07-18');
  const cached = await useCases.loadPlayerActivityDay(player, [], '2026-07-18');
  assert.equal(callCount, 1);
  assert.equal(cached, first);

  useCases.invalidatePlayerActivity(player.ouid);
  await useCases.loadPlayerActivityDay(player, [], '2026-07-18');
  assert.equal(callCount, 2);
});

test('category refresh detaches old requests without overwriting cache or losing new deduplication', async () => {
  const requests = [];
  const useCases = new SaPageUseCases({ service: {
    getPublicMatchCategory() {
      return new Promise((resolve) => requests.push(resolve));
    },
  } });
  const player = { ouid: 'refresh-ouid' };
  const other = { ouid: 'other-ouid' };
  const old = useCases.loadPublicMatchCategory(player, 'party');
  const unrelated = useCases.loadPublicMatchCategory(other, 'party');
  requests[1]({ revision: 'other' });
  await unrelated;
  useCases.invalidatePublicMatchCategories(player.ouid);
  const fresh = useCases.loadPublicMatchCategory(player, 'party');
  requests[0]({ revision: 1 });
  await old;
  const duplicate = useCases.loadPublicMatchCategory(player, 'party');
  assert.equal(requests.length, 3);
  requests[2]({ revision: 2 });
  assert.equal((await fresh).revision, 2);
  assert.equal((await duplicate).revision, 2);
  assert.equal((await useCases.loadPublicMatchCategory(player, 'party')).revision, 2);
  assert.equal((await useCases.loadPublicMatchCategory(other, 'party')).revision, 'other');
  assert.equal(requests.length, 3);
});

test('explicit profile refresh invalidates shared match lists for public and league scopes',async()=>{
  let invalidations=0,loads=0;
  const useCases=new SaPageUseCases({
    repository:{invalidateMatchLists(){invalidations++;}},
    profileQueryService:{async getFullPlayerProfile(){loads++;return {};}}
  });
  await useCases.loadPlayerProfile('Tracking');assert.equal(invalidations,0);
  for(const scope of ['public','league'])await useCases.loadPlayerProfile('Tracking',[],null,{scope,forceRefresh:true});
  assert.equal(loads,3);assert.equal(invalidations,2);
});

test('activity ignores the old duplicated-list summary cache after the contract migration',async t=>{
  const values=new Map([['sa_activity_31:v2:legacy',JSON.stringify({
    dateKey:new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date()),matches:[{matchId:'old'}]
  })]]);
  const previous=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)}});
  t.after(()=>previous?Object.defineProperty(globalThis,'localStorage',previous):delete globalThis.localStorage);
  let calls=0;
  const useCases=new SaPageUseCases({service:{async getPlayerActivity(){calls++;return [{matchId:'new'}];}}});
  assert.equal((await useCases.loadPlayerActivity({ouid:'legacy'}))[0].matchId,'new');
  assert.equal(calls,1);assert.ok(values.has('sa_activity_31:v4:legacy'));
});
