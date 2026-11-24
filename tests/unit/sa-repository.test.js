import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { SaRepository } from '../../src/domains/stats/sudden-attack/infra/sa-repository.js';
import { NexonApiClient } from '../../src/domains/stats/sudden-attack/infra/nexon-api-client.js';
import { PUBLIC_MATCH_CATEGORY_CONFIG } from '../../src/domains/stats/sudden-attack/domain/public-match-categories.js';

const originalDateNow = Date.now;
afterEach(() => { Date.now = originalDateNow; });

function createRepository(calls) {
  return new SaRepository({
    async getMatchList(...args) { calls.push(args); return { match: [] }; },
    async getMatchDetail() { return {}; }
  });
}

test('SaRepository public scope requests each ranked type once without a date', async () => {
  const calls = [];
  await createRepository(calls).getRecentMatches('public-ouid',20,'Faker',{scope:'public'});
  assert.deepEqual(calls,[['public-ouid','랭크전 솔로','폭파미션'],['public-ouid','랭크전 파티','폭파미션']]);
});

test('SaRepository league scope preserves both clan types without ranked requests', async () => {
  const calls = [];
  await createRepository(calls).getRecentMatches('league-ouid',20,'heel',{scope:'league'});
  assert.deepEqual(calls,[['league-ouid','퀵매치 클랜전','폭파미션'],['league-ouid','클랜전','폭파미션']]);
});

test('SaRepository loads match details concurrently while preserving newest-first order', async () => {
  let activeDetails = 0;
  let maxActiveDetails = 0;
  const matches = Array.from({ length: 12 }, (_, index) => ({
    match_id: `match-${index}`,
    date_match: new Date(Date.UTC(2026, 6, 19, 0, 0, 12 - index)).toISOString(),
    match_type: '랭크전 솔로',
    match_result: index % 2 ? '2' : '1',
    kill: index + 1,
    death: index
  }));

  const repository = new SaRepository({
    async getMatchList(_ouid, matchType, _matchMode, date) {
      return matchType === '랭크전 솔로' ? { match: matches } : { match: [] };
    },
    async getMatchDetail(matchId) {
      activeDetails += 1;
      maxActiveDetails = Math.max(maxActiveDetails, activeDetails);
      await new Promise((resolve) => setImmediate(resolve));
      activeDetails -= 1;
      const source = matches.find((match) => match.match_id === matchId);
      return {
        match_id: matchId,
        date_match: source.date_match,
        match_map: '프로방스',
        match_detail: [{
          user_name: 'Faker',
          match_result: source.match_result,
          kill: source.kill,
          death: source.death
        }]
      };
    }
  });

  const result = await repository.getRecentMatches('public-ouid', 12, 'Faker', { scope: 'public' });

  assert.ok(maxActiveDetails > 1);
  assert.ok(maxActiveDetails <= 6);
  assert.deepEqual(result.map((match) => match.matchId), matches.map((match) => match.match_id));
});


test('31-day activity uses five lists and filters completed Korea dates, not 150 dated calls', async () => {
  Date.now = () => Date.parse('2026-11-07T00:00:00Z');
  const calls=[],progress=[];
  let details=0;
  const rows=[
    {match_id:'earliest',date_match:'2026-10-07T15:00:00Z',match_result:'3'},
    {match_id:'before-range',date_match:'2026-10-07T14:59:59Z',match_result:'1'},
    {match_id:'yesterday',date_match:'2026-11-06T14:59:59Z',match_result:'1'},
    {match_id:'today',date_match:'2026-11-06T15:00:00Z',match_result:'1'},
    {match_id:'invalid',date_match:'not-a-date',match_result:'1'}
  ];
  const repository=new SaRepository({
    async getMatchList(...args){calls.push(args);return {match:rows};},
    async getMatchDetail(){details++;return {};}
  });
  const result=await repository.getPlayerActivityMatches('activity',31,{
    matchTypes:PUBLIC_MATCH_CATEGORY_CONFIG.all.matchTypes,onProgress:value=>progress.push(value)
  });
  assert.equal(calls.length,5);
  assert.ok(calls.every(args=>args.length===3 && args[2]==='폭파미션'));
  assert.deepEqual(result.map(row=>row.matchId),['yesterday','earliest']);
  assert.equal(result[1].matchResult,'DRAW');
  assert.equal(details,0);
  assert.deepEqual(progress.at(-1),{completed:5,total:5,percent:100});
});

test('activity retires only the selected player legacy caches and writes no per-day copies',async t=>{
  const values=new Map([
    ['sa_activity_days:v2:old:폭파미션','large old cache'],
    ['sa_activity_31:v2:old','old summary'],
    ['sa_activity_31:v2:other','keep other player'],['theme','dark']
  ]);
  const previous=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{
    getItem:key=>values.get(key),removeItem:key=>values.delete(key),setItem(){throw Error('must not write day cache');}
  }});
  t.after(()=>previous?Object.defineProperty(globalThis,'localStorage',previous):delete globalThis.localStorage);
  const mode='폭파미션';
  values.set(`sa_activity_days:v2:old:${encodeURIComponent(mode)}`,'actual encoded day cache');
  await createRepository([]).getPlayerActivityMatches('old',31,{matchTypes:['랭크전 솔로']});
  assert.equal(values.has(`sa_activity_days:v2:old:${encodeURIComponent(mode)}`),false);
  assert.equal(values.has('sa_activity_31:v2:old'),false);
  assert.equal(values.get('sa_activity_31:v2:other'),'keep other player');
  assert.equal(values.get('theme'),'dark');
});

test('a one-day activity request keeps today excluded and does not query the provider',async()=>{
  const calls=[];
  assert.deepEqual(await createRepository(calls).getPlayerActivityMatches('today',1,{matchTypes:['랭크전 솔로']}),[]);
  assert.equal(calls.length,0);
});

test('recent, activity and older pagination reuse the same bounded provider lists',async()=>{
  Date.now=()=>Date.parse('2026-11-07T00:00:00Z');
  const rows=Array.from({length:35},(_,i)=>({match_id:`m${i}`,
    date_match:new Date(Date.parse('2026-11-06T00:00:00Z')-i*3600000).toISOString(),match_result:'1',kill:5,death:2}));
  const calls=[];
  const api=new NexonApiClient('',{now:()=>0});
  api.fetch=async(_endpoint,params)=>{calls.push(params);return {match:rows};};
  api.getMatchDetail=async id=>({match_id:id});
  const repository=new SaRepository(api),matchTypes=['랭크전 솔로','랭크전 파티'];
  const recent=await repository.getRecentMatches('shared',20,'Tracking',{scope:'public',matchTypes});
  const activity=await repository.getPlayerActivityMatches('shared',31,{matchTypes});
  const older=await repository.getOlderPublicMatches('shared',recent.at(-1).matchDate,20,{matchTypes});
  assert.equal(recent.length,20);assert.equal(activity.length,35);
  assert.deepEqual(older.matches.map(row=>row.matchId),rows.slice(20).map(row=>row.match_id));
  assert.equal(older.hasMore,false);assert.equal(calls.length,2);
});

test('older pagination crosses sparse dates once and stops at the supplied list boundary',async()=>{
  const rows=Array.from({length:25},(_,i)=>({match_id:`old${i}`,
    date_match:new Date(Date.UTC(2025,0,30-i)).toISOString(),match_result:'2'}));
  const calls=[];
  const repository=new SaRepository({
    async getMatchList(...args){calls.push(args);return {match:rows};},
    async getMatchDetail(id){return {match_id:id};}
  });
  const options={matchTypes:['클랜전']};
  const first=await repository.getOlderPublicMatches('older','2026-11-07T00:00:00Z',20,options);
  const second=await repository.getOlderPublicMatches('older',first.matches.at(-1).matchDate,20,options);
  const end=await repository.getOlderPublicMatches('older',second.matches.at(-1).matchDate,20,options);
  assert.equal(first.matches.length,20);assert.equal(first.hasMore,true);
  assert.equal(second.matches.length,5);assert.equal(second.hasMore,false);
  assert.deepEqual(end,{matches:[],hasMore:false});
  assert.equal(calls.length,3);assert.ok(calls.every(args=>args.length===3));
});

test('league lookup keeps temporary nickname discovery and MMR/HSR history matching',async()=>{
  const dates=['2026-10-30T00:00:00Z','2026-11-03T00:00:00Z','2026-11-06T00:00:00Z'];
  const names=['Tracking','TemporaryNick','Tracking'];
  const rows=dates.map((date,i)=>({match_id:`league${i}`,date_match:date,match_result:'1',kill:5,death:2}));
  const history=dates.map((date,i)=>({date,mmr:1220+i*10,hsr:1220+i*10}));
  const synced=[];
  const repository=new SaRepository({
    async getMatchList(_ouid,type){return {match:type==='퀵매치 클랜전'?rows:[]};},
    async getMatchDetail(id){const i=rows.findIndex(row=>row.match_id===id);return {
      match_id:id,match_member:[{ouid:'stable',character_name:names[i],match_result:'1',kill:5,death:2}]
    };}
  },{
    async getMemberMmrHistory(){return history;},
    async addNicknameToHistory(ouid,name){synced.push({ouid,name});}
  });
  repository.setCrewMembers(['Tracking'],['stable']);
  const result=await repository.getRecentMatches('stable',20,'Tracking',{scope:'league'});
  assert.equal(result.length,3);
  assert.deepEqual(result.map(row=>row.mmrChange),[10,10,20]);
  assert.deepEqual(result.map(row=>row.hsrChange),[10,10,20]);
  assert.ok(result.every(row=>row.allPlayerStats.some(player=>player.isSubject)));
  assert.deepEqual(synced,[{ouid:'stable',name:'TemporaryNick'}]);
  assert.deepEqual([...repository.discoveredNicknames.stable],['TemporaryNick']);
});
