import test from 'node:test';
import assert from 'node:assert/strict';
import {MatchRecord,normalizeMatchResult,toNexonMatchResult,getMatchTeamPlayers} from '../../src/domains/stats/sudden-attack/domain/match.js';
import {RecentStats,calculateMatchContributionRadar} from '../../src/domains/stats/sudden-attack/domain/stats.js';
import {SaRepository} from '../../src/domains/stats/sudden-attack/infra/sa-repository.js';
import {planCrewSettlement} from '../../src/domains/stats/sudden-attack/domain/crew-settlement.js';
import {SaProfileCache} from '../../src/domains/stats/sudden-attack/application/sa-profile-cache.js';
import {createDrawDetail,createDrawListRow} from '../fixtures/sa-draw-match.js';

const subject={ouid:'local-subject',kill:16,death:13,assist:6,result:'3'};
const createRecord=detail=>new MatchRecord(detail||createDrawDetail(),'퀵매치 클랜전','Subject',{names:[],ouids:[]},subject);

test('Nexon result 3 stays DRAW, while unsupported values never become a loss',()=>{
  for(const [raw,result] of [[1,'WIN'],['2','LOSE'],[3,'DRAW'],['DRAW','DRAW'],[undefined,'UNKNOWN'],['4','UNKNOWN']]) {
    assert.equal(normalizeMatchResult(raw),result);
  }
  assert.equal(toNexonMatchResult('DRAW'),'3');
  const match=createRecord();
  assert.equal(match.matchResult,'DRAW');
  assert.deepEqual([match.kill,match.death,match.assist],[16,13,6]);
  assert.equal(match.allPlayerStats.length,12);
  assert.ok(match.allPlayerStats.every(p=>p.result==='DRAW'));
  assert.equal(match.subjectTeamId,'1');
  assert.equal(getMatchTeamPlayers(match).length,6);
  assert.equal(getMatchTeamPlayers(match,{opponents:true}).length,6);
  assert.ok(getMatchTeamPlayers(match,{opponents:true}).every(p=>p.teamId==='0'));
  assert.equal(match.laundryInfo.isWashed,false);
});

test('missing team IDs cannot classify all draw participants as the same side',()=>{
  const detail=createDrawDetail();
  detail.match_detail.forEach(p=>delete p.team_id);
  const match=createRecord(detail);
  assert.deepEqual(getMatchTeamPlayers(match),[]);
  assert.deepEqual(getMatchTeamPlayers(match,{opponents:true}),[]);
  assert.equal(match.allPlayerStats.length,12);
});

test('draws do not become a losing streak or map loss, and radar uses the actual side',()=>{
  const match=createRecord();
  match.isCustomMatch=true;
  const stats=new RecentStats({user_name:'Subject'},[match],null,{forceMatchMetrics:true});
  assert.equal(stats.streakType,'NONE');
  assert.equal(stats.streakCount,0);
  assert.equal(stats.mapStats[0].draws,1);
  assert.equal(stats.mapStats[0].loses,0);
  const radar=calculateMatchContributionRadar(match);
  const ownOnly={...match,allPlayerStats:getMatchTeamPlayers(match)};
  assert.deepEqual(radar,calculateMatchContributionRadar(ownOnly));
  assert.ok(Object.values(radar).every(value=>Number.isFinite(value)&&value>=0&&value<=100));
});

test('recent, activity and older-match detail routes preserve a draw',async t=>{
  const row=createDrawListRow();
  t.mock.method(Date,'now',()=>Date.parse(row.date_match)+24*60*60*1000);
  const repository=new SaRepository({
    async getMatchList(){return {match:[row]};},
    async getMatchDetail(){return createDrawDetail();},
  });
  const recent=await repository.getRecentMatches(subject.ouid,20,'Subject',{scope:'public',matchTypes:['퀵매치 클랜전']});
  assert.equal(recent.length,1);
  assert.equal(recent[0].matchResult,'DRAW');
  const activity=await repository.getPlayerActivityMatches(subject.ouid,2,{matchTypes:['퀵매치 클랜전']});
  assert.equal(activity[0].matchResult,'DRAW');
  const details=await repository.getActivityMatchDetails(activity,{ouid:subject.ouid,nickname:'Subject'});
  assert.equal(details[0].matchResult,'DRAW');
  assert.equal(details[0].allPlayerStats.length,12);
  const older=await repository.getOlderPublicMatches(subject.ouid,'2026-11-07T00:00:00Z',20,{maxDays:7,matchTypes:['퀵매치 클랜전'],player:{ouid:subject.ouid,nickname:'Subject'}});
  assert.equal(older.matches[0].matchResult,'DRAW');
});

test('draw list results survive empty or unavailable detail responses',async()=>{
  for(const detailResponse of ['empty','unavailable']) {
    const repository=new SaRepository({
      async getMatchList(){return {match:[createDrawListRow()]};},
      async getMatchDetail(){if(detailResponse==='unavailable')throw Error('offline');return {match_detail:[]};},
    });
    const matches=await repository.getRecentMatches(subject.ouid,20,'Subject',{scope:'public',matchTypes:['퀵매치 클랜전']});
    assert.equal(matches[0].matchResult,'DRAW');
    assert.equal(matches[0].matchId,createDrawListRow().match_id);
    assert.deepEqual([matches[0].kill,matches[0].death,matches[0].assist],[16,13,6]);
    const details=await repository.getActivityMatchDetails([{matchResult:'DRAW',matchId:'draw',kill:16,death:13,assist:6}],{nickname:'Subject',ouid:subject.ouid});
    assert.equal(details[0].matchResult,'DRAW');
    assert.equal(details[0].assist,6);
  }
});

test('a crew draw cannot debit MMR or consume a pending match session',()=>{
  const match=createRecord();
  match.allPlayerStats.forEach(p=>p.isCrew=true);
  const plan=planCrewSettlement({
    matches:[match],members:[{id:subject.ouid,data:{characterName:'Subject',mmr:1200,hsr:1200}}],
    sessions:[{id:'pending',data:{status:'PENDING'}}],
  });
  assert.deepEqual(plan.memberUpdates,[]);
  assert.deepEqual(plan.historyWrites,[]);
  assert.deepEqual(plan.sessionUpdates,[]);
  assert.deepEqual(plan.reports,[]);
});

test('legacy cached draws are refetched without discarding normal profile entries',()=>{
  const values=new Map();
  const cache=new SaProfileCache({getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)});
  const match=createRecord();
  const legacy={...match,matchResult:'LOSE',allPlayerStats:match.allPlayerStats.map(p=>({...p,result:'UNKNOWN'}))};
  cache.set('legacy-root',{matches:[legacy]});
  cache.set('legacy-view',{matches:[],seasonViews:{current:{matches:[legacy]}}});
  assert.equal(cache.get('legacy-root'),null);
  assert.equal(cache.get('legacy-view'),null);
  cache.set('current',{matches:[match]});
  assert.equal(cache.get('current').data.matches[0].matchResult,'DRAW');
  cache.set('normal',{matches:[{matchResult:'LOSE',allPlayerStats:[{result:'WIN'},{result:'LOSE'}]}]});
  assert.equal(cache.get('normal').data.matches[0].matchResult,'LOSE');
});
