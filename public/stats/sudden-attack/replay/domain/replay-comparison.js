import { analyzeRoundContext } from './replay-context.js?v=bc005cf0b46f';

export const MAX_COMPARISON_FILES = 5;
const rows = v => Array.isArray(v) ? v : [];
const text = (v, size=80) => typeof v === 'string' ? v.slice(0,size) : '';
const id = v => typeof v === 'string' && v.trim() && v.length <= 80 ? v
  : Number.isSafeInteger(v) && v >= 0 ? String(v) : null;
const object = v => v && typeof v === 'object' && !Array.isArray(v);
const number = v => (typeof v==='number'||typeof v==='string'&&v.trim())&&Number.isFinite(Number(v))?Number(v):null;
const tuple = (...values) => values.map(v=>typeof v==='string'?v.slice(0,160):typeof v==='number'&&Number.isFinite(v)?v:null);
const sorted = values => values.sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
const invalid = () => { throw new Error('COMPARISON_UNSUPPORTED'); };

function prepare(entry) {
  const info=entry.parsed?.replay_info, rounds=info?.replayRoundInfo, roster=info?.replayCharacterSummaryInfo;
  if(!object(info?.replayMatchSummaryInfo)||!Array.isArray(rounds)||!rounds.length||rounds.length>100
    ||!Array.isArray(roster)||!roster.length||roster.length>64)invalid();
  const players=roster.map(p=>{if(!object(p)||id(p.nexonSN)===null)invalid();return {id:id(p.nexonSN),name:text(p.nickName)||'이름 없음'};});
  if(new Set(players.map(p=>p.id)).size!==players.length)invalid();
  let events=0,states=0;const numbers=new Set();
  for(const r of rounds){
    if(!object(r)||!Number.isSafeInteger(number(r.no))||number(r.no)<1||numbers.has(number(r.no))
      ||number(r.playTime)===null||number(r.playTime)<=0||number(r.playTime)>3600)invalid();
    numbers.add(Number(r.no));
    for(const key of ['replayRoundSummaryInfo','replayAttackInfo','replayCharacterInfo','replayEnterInfo','replayThrowWeaponEventInfo','replayBombInfo']){
      if(r[key]!=null&&!Array.isArray(r[key]))invalid();
      if(rows(r[key]).some(v=>!object(v)))invalid();
      for(const v of rows(r[key]))for(const field of ['nexonSN','attackerNexonSN','victimNexonSN'])
        if(v[field]!=null&&!['number','string'].includes(typeof v[field]))invalid();
    }
    if(rows(r.replayRoundSummaryInfo).length>64||rows(r.replayCharacterInfo).length>64)invalid();
    events+=rows(r.replayAttackInfo).length+rows(r.replayEnterInfo).length+rows(r.replayThrowWeaponEventInfo).length+rows(r.replayBombInfo).length;
    for(const c of rows(r.replayCharacterInfo)){
      if(c.replayCharacterStateInfo!=null&&!Array.isArray(c.replayCharacterStateInfo))invalid();
      if(rows(c.replayCharacterStateInfo).some(s=>!object(s)))invalid();
      states+=rows(c.replayCharacterStateInfo).length;
    }
    if(events>5000||states>25000)invalid();
  }
  const summary=info.replayMatchSummaryInfo;
  // Fixed scalar projection: no recursive traversal of arbitrary JSON. Ignore
  // names, file names and rounded numeric match IDs when detecting duplicates.
  const signature=JSON.stringify([text(summary.mapName,160),text(summary.matchDate,160),
    sorted(roster.map(p=>tuple(id(p.nexonSN),number(p.teamNo)))),
    [...rounds].sort((a,b)=>Number(a.no)-Number(b.no)).map(r=>[tuple(number(r.no),number(r.playTime),number(r.offenseTeam),number(r.winTeam)),
      sorted(rows(r.replayRoundSummaryInfo).map(p=>tuple(id(p.nexonSN),number(p.teamNo),number(p.kill),number(p.death),number(p.reJoin),number(p.breakType)))),
      sorted(rows(r.replayAttackInfo).map(e=>tuple(number(e.timeStamp),number(e.eventType),id(e.attackerNexonSN),id(e.victimNexonSN)))),
      sorted(rows(r.replayCharacterInfo).map(c=>[tuple(id(c.nexonSN)),sorted(rows(c.replayCharacterStateInfo).map(s=>tuple(number(s.timeStamp),number(s.state))))])),
      sorted(rows(r.replayEnterInfo).map(e=>tuple(number(e.timeStamp),id(e.nexonSN))))])]);
  return {parsed:entry.parsed,name:text(entry.name,160)||'리플레이 JSON',players,signature,identity:id(summary.matchID),
    map:text(summary.mapName)||'맵 정보 없음',date:text(summary.matchDate,160)||'일시 정보 없음'};
}

export function prepareReplayComparison(entries) {
  if(!Array.isArray(entries)||entries.length>MAX_COMPARISON_FILES)throw new Error('COMPARISON_FILE_LIMIT');
  const games=[],issues=[];
  for(const entry of entries){
    const name=text(entry?.name,160)||'리플레이 JSON';
    try{
      const game=prepare(entry);
      const sameId=game.identity===null?null:games.find(g=>g.identity===game.identity);
      if(sameId){issues.push({name,code:sameId.signature===game.signature?'duplicate':'conflict'});continue;}
      if(games.some(g=>g.signature===game.signature&&(g.identity===null||game.identity===null))){issues.push({name,code:'duplicate'});continue;}
      games.push(game);
    }catch{issues.push({name,code:'unsupported'});}
  }
  const byId=new Map();
  for(const game of games)for(const p of game.players){
    if(!byId.has(p.id))byId.set(p.id,{id:p.id,names:[],games:0});
    const player=byId.get(p.id);player.games++;if(!player.names.includes(p.name))player.names.push(p.name);
  }
  return {games,issues,players:[...byId.values()].filter(p=>p.games>=2)};
}

function metrics(rounds) {
  const result={rounds:0,kills:0,deaths:0,survived:0,openingDeaths:0,survivalSeconds:0};
  for(const {kills,playTime,context} of rounds){
    result.rounds++;result.kills+=kills;result.deaths+=Number(Boolean(context.death));
    result.survived+=Number(!context.death);result.openingDeaths+=Number(Boolean(context.opening?.selectedDeath));
    result.survivalSeconds+=context.death?.timeSeconds??Number(playTime);
  }
  return result;
}
const rates = m => !m.rounds ? null : {...m,killsPerRound:m.kills/m.rounds,survivedPercent:m.survived/m.rounds*100,
  averageSurvivalSeconds:m.survivalSeconds/m.rounds};

export function compareReplayGames(prepared, playerId) {
  const player=prepared.players.find(p=>p.id===playerId);if(!player)return null;
  const games=prepared.games.map(game=>{
    const member=game.players.find(p=>p.id===playerId);
    const base={name:game.name,map:game.map,date:game.date,alias:member?.name??null,totalRounds:game.parsed.replay_info.replayRoundInfo.length};
    if(!member)return {...base,status:'absent',metrics:null};
    const verified=game.parsed.replay_info.replayRoundInfo.flatMap(raw=>{
      const context=analyzeRoundContext(raw,playerId);if(context.status!=='complete')return [];
      const kills=rows(raw.replayAttackInfo).filter(e=>String(e.attackerNexonSN)===playerId).length;
      return [{playTime:raw.playTime,kills,context}];
    });
    return {...base,status:verified.length?'verified':'unverified',metrics:rates(metrics(verified))};
  });
  return {player,games,...aggregateReplayComparisonGames(games)};
}

export function aggregateReplayComparisonGames(games) {
  const included=games.filter(g=>g.metrics),total={rounds:0,kills:0,deaths:0,survived:0,openingDeaths:0,survivalSeconds:0};
  for(const game of included)for(const key of Object.keys(total))total[key]+=game.metrics[key];
  return {comparedGames:included.length,presentGames:games.filter(g=>g.status!=='absent').length,
    totalRounds:games.filter(g=>g.status!=='absent').reduce((n,g)=>n+g.totalRounds,0),aggregate:rates(total)};
}
