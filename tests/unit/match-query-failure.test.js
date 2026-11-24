import test from 'node:test';
import assert from 'node:assert/strict';
import { MatchQueryError } from '../../src/domains/stats/sudden-attack/domain/match-query.js';
import { NexonApiClient } from '../../src/domains/stats/sudden-attack/infra/nexon-api-client.js';
import { SaRepository } from '../../src/domains/stats/sudden-attack/infra/sa-repository.js';
import { SaService } from '../../src/domains/stats/sudden-attack/application/sa-service.js';
import { SaPageUseCases } from '../../src/domains/stats/sudden-attack/application/sa-page-use-cases.js';
import { SaProfileCache } from '../../src/domains/stats/sudden-attack/application/sa-profile-cache.js';
import { ProfileQueryService } from '../../src/domains/stats/sudden-attack/application/profile-query-service.js';
import { resolvePublicSearchError, resolveMatchQueryMessage } from '../../src/domains/stats/sudden-attack/application/search-error-messages.js';
import { loadTeamStrengthProfiles } from '../../src/domains/stats/sudden-attack/replay/domain/team-strength-forecast.js';

const player = {ouid:'fixture', nickname:'Fixture'};
const offline = () => Object.assign(new Error('private provider diagnostic'), {code:'REQUEST_TIMEOUT'});
const row = {match_id:'fixture-match',date_match:'2026-11-06T00:00:00Z',match_result:'3',kill:6,death:4};
function storage(t) {
  const entries = new Map();
  const value = {getItem:key=>entries.get(key),setItem:(key,v)=>entries.set(key,v),removeItem:key=>entries.delete(key)};
  for(const name of ['localStorage','sessionStorage']) {
    const original = Object.getOwnPropertyDescriptor(globalThis,name);
    Object.defineProperty(globalThis,name,{configurable:true,value});
    t.after(()=>original?Object.defineProperty(globalThis,name,original):delete globalThis[name]);
  }
  return {entries,value};
}

for(const operation of ['recent','activity','older']) {
  for(const failure of ['all','partial','malformed']) {
    test(`${operation} distinguishes ${failure} list failure from valid empty history`, async()=>{
      let details=0;
      const repository=new SaRepository({
        async getMatchList(_ouid,type){
          if(failure==='malformed')return {};
          if(failure==='all'||type==='broken')throw offline();
          return {match:[row]};
        },
        async getMatchDetail(){details++;return {};}
      });
      const matchTypes=['good','broken'];
      const pending=operation==='recent'
        ?repository.getRecentMatches('fixture',20,'Fixture',{scope:'public',matchTypes})
        :operation==='activity'?repository.getPlayerActivityMatches('fixture',31,{matchTypes})
        :repository.getOlderPublicMatches('fixture','2026-11-07',20,{matchTypes});
      await assert.rejects(pending,error=>{
        assert.equal(error.code,failure==='partial'?'MATCH_QUERY_PARTIAL':'MATCH_QUERY_FAILED');
        assert.equal(error.failedCount,failure==='partial'?1:2);
        assert.equal(error.totalCount,2);
        assert.doesNotMatch(error.message,/private/);
        return true;
      });
      assert.equal(details,0,'incomplete lists must not trigger a misleading final result');
    });
  }
}

test('a partial activity query never persists; retry fetches only the failed list and then caches completeness',async t=>{
  const {entries}=storage(t);
  t.mock.method(Date,'now',()=>Date.parse('2026-11-07T00:00:00Z'));
  let broken=true,calls=0;
  const client=new NexonApiClient('',{now:()=>0});
  client.fetch=async(_path,{match_type:type})=>{calls++;if(broken&&type==='토너먼트')throw offline();return {match:[row]};};
  const service=new SaService(new SaRepository(client));
  const useCases=new SaPageUseCases({service});
  const first=useCases.loadPlayerActivity(player);
  const joined=useCases.loadPlayerActivity(player);
  await Promise.all([first,joined].map(p=>assert.rejects(p,{code:'MATCH_QUERY_PARTIAL'})));
  assert.equal(calls,5);
  assert.equal(useCases.playerActivityCache.size,0);
  assert.equal(entries.size,0);
  broken=false;
  const result=await useCases.loadPlayerActivity(player);
  assert.equal(result.length,1);assert.equal(result[0].matchResult,'DRAW');
  assert.equal(calls,6);
  assert.ok(entries.has('sa_activity_31:v4:fixture'));
  await new SaPageUseCases({service}).loadPlayerActivity(player);
  assert.equal(calls,6);
});

test('successful empty activity is cached, but a previous v3 incomplete summary is ignored',async t=>{
  const {entries}=storage(t);
  entries.set('sa_activity_31:v3:fixture',JSON.stringify({dateKey:new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date()),matches:[row]}));
  let calls=0;
  const service=new SaService(new SaRepository({async getMatchList(){calls++;return {match:[]};}}));
  assert.deepEqual(await new SaPageUseCases({service}).loadPlayerActivity(player),[]);
  assert.equal(calls,5);
  assert.deepEqual(await new SaPageUseCases({service}).loadPlayerActivity(player),[]);
  assert.equal(calls,5);
  assert.equal(entries.has('sa_activity_31:v3:fixture'),false);
});

test('invalidating activity detaches old work without caching it or dropping a newer pending request',async t=>{
  storage(t);
  const resolve=[];
  const useCases=new SaPageUseCases({service:{getPlayerActivity:()=>new Promise(done=>resolve.push(done))}});
  const old=useCases.loadPlayerActivity(player);
  useCases.invalidatePlayerActivity('fixture');
  const fresh=useCases.loadPlayerActivity(player);
  resolve[0]([]);await old;
  const joined=useCases.loadPlayerActivity(player);assert.equal(resolve.length,2);
  resolve[1]([{matchId:'fresh'}]);await fresh;
  assert.equal((await joined)[0].matchId,'fresh');
  assert.equal((await useCases.loadPlayerActivity(player))[0].matchId,'fresh');
});

for(const partial of [false,true]) {
  test(`day detail ${partial?'partial':'total'} failure stays retryable and is never turned into zero damage`,async()=>{
    let broken=true,calls=0;
    const repository=new SaRepository({async getMatchDetail(id){calls++;if(broken&&(!partial||id==='b'))throw offline();return {match_id:id,match_detail:[{ouid:'fixture',user_name:'Fixture',match_result:'1',kill:3,death:2,damage:900,headshot:1}]};}});
    const useCases=new SaPageUseCases({service:new SaService(repository)});
    const matches=['a','b'].map(matchId=>({matchId,matchDate:'2026-11-06T00:00:00Z',kill:3,death:2,matchResult:'WIN'}));
    await assert.rejects(useCases.loadPlayerActivityDay(player,matches,'2026-11-06'),{code:partial?'MATCH_QUERY_PARTIAL':'MATCH_QUERY_FAILED',queryKind:'detail'});
    assert.equal(useCases.playerActivityDayCache.size,0);
    broken=false;
    assert.equal((await useCases.loadPlayerActivityDay(player,matches,'2026-11-06')).length,2);
    assert.equal(calls,4);
    await useCases.loadPlayerActivityDay(player,matches,'2026-11-06');assert.equal(calls,4);
  });
}

test('profile list failures never populate memory or persistent cache and permit recovery',async()=>{
  let broken=true,calls=0,writes=0;
  const cache={buildKey:()=> 'fixture',get:()=>null,set(){writes++;}};
  const query=new ProfileQueryService({async fetchFreshData(){calls++;if(broken)throw new MatchQueryError([offline()],2);return {matches:[]};}},cache);
  await assert.rejects(query.getFullPlayerProfile('Fixture'),{code:'MATCH_QUERY_PARTIAL'});
  assert.equal(query.memoryCache.size,0);assert.equal(writes,0);
  broken=false;
  assert.deepEqual((await query.getFullPlayerProfile('Fixture')).matches,[]);
  assert.equal(calls,2);assert.equal(writes,1);
});

test('profile migration ignores old successful-looking empty caches and cleans only the queried old key',()=>{
  const entries=new Map([['sa_cache_public:fixture',JSON.stringify({data:{matches:[]},timestamp:Date.now()})],['theme','dark']]);
  const cache=new SaProfileCache({getItem:key=>entries.get(key),removeItem:key=>entries.delete(key)});
  assert.equal(cache.get(cache.buildKey('Fixture','public')),null);
  assert.equal(entries.has('sa_cache_public:fixture'),false);
  assert.equal(entries.get('theme'),'dark');
});

test('replay strength does not score or cache a clan profile from only one successful clan type',async()=>{
  let broken=true,calls=0;
  const api={async getOuid(){return 'fixture';},async getMatchList(_ouid,type){calls++;if(broken&&type==='클랜전')throw offline();return {match:[row]};}};
  const cache=new Map(),players=[{nickName:'Fixture',teamNo:1}];
  assert.equal((await loadTeamStrengthProfiles(players,api,'clan',{cache}))[0].profile,null);
  assert.equal(cache.size,0);
  broken=false;
  assert.ok((await loadTeamStrengthProfiles(players,api,'clan',{cache}))[0].profile);
  assert.equal(calls,4);
});

test('query failure messages distinguish partial, throttled and timeout states without exposing diagnostics',()=>{
  const partial=new MatchQueryError([offline()],2);
  assert.match(resolvePublicSearchError(partial).title,/일부/);
  assert.match(resolveMatchQueryMessage(partial),/일부 경기 유형/);
  assert.match(resolveMatchQueryMessage(partial),/대기 시간/);
  const throttled=new MatchQueryError([{code:'RATE_LIMITED'}],1);
  assert.match(resolveMatchQueryMessage(throttled),/요청이 많아/);
  assert.doesNotMatch(JSON.stringify(resolvePublicSearchError(partial)),/private|PLAYER_NOT_FOUND|기록이 없습니다/);
});

test('replay profile and rendered labels distinguish successful empty history, total failure and partial lookup',async()=>{
  const {buildTeamStrengthForecast}=await import('../../src/domains/stats/sudden-attack/replay/domain/team-strength-forecast.js');
  const {renderReplayForecast}=await import('../../src/domains/stats/sudden-attack/replay/ui/replay-results-view.js');
  const profiles=await loadTeamStrengthProfiles([
    {nickName:'Empty',teamNo:1},{nickName:'Failed',teamNo:2},{nickName:'Partial',teamNo:2}
  ],{
    async getOuid(name){return name;},
    async getMatchList(name,type){
      if(name==='Failed'||name==='Partial'&&type==='클랜전')throw offline();
      return {match:name==='Empty'?[]:[row]};
    }
  },'clan');
  assert.deepEqual(profiles.map(p=>p.lookupStatus),['empty','failed','partial']);
  assert.ok(profiles.every(p=>p.profile===null));
  const html=renderReplayForecast(buildTeamStrengthForecast(profiles,1,'clan'));
  assert.match(html,/경기 직전 조회 범위에 기록 없음/);
  assert.match(html,/조회 실패 · 다시 조회 가능/);
  assert.match(html,/일부 경기 유형 조회 실패/);
});

test('empty or malformed detail responses are unavailable rather than confirmed zero damage',async()=>{
  for(const response of [null,{}, {match_detail:[]}]) {
    const service=new SaService(new SaRepository({async getMatchDetail(){return response;}}));
    await assert.rejects(service.getPlayerActivityDay(player,[{matchId:'x',matchDate:'2026-11-06T00:00:00Z'}],'2026-11-06'),{code:'MATCH_QUERY_FAILED',queryKind:'detail'});
  }
});

test('invalidating selected-day work cannot overwrite a newer result or remove its pending deduplication',async()=>{
  const resolve=[];
  const useCases=new SaPageUseCases({service:{getPlayerActivityDay:()=>new Promise(done=>resolve.push(done))}});
  const old=useCases.loadPlayerActivityDay(player,[],'2026-11-06');
  useCases.invalidatePlayerActivity('fixture');
  const fresh=useCases.loadPlayerActivityDay(player,[],'2026-11-06');
  resolve[0]([{matchId:'old'}]);await old;
  const joined=useCases.loadPlayerActivityDay(player,[],'2026-11-06');assert.equal(resolve.length,2);
  resolve[1]([{matchId:'fresh'}]);await fresh;
  assert.equal((await joined)[0].matchId,'fresh');
  assert.equal((await useCases.loadPlayerActivityDay(player,[],'2026-11-06'))[0].matchId,'fresh');
});
