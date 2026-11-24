import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { analyzeReplay, getReplayPlayers, parseReplayText } from '../src/domains/stats/sudden-attack/replay/domain/replay-analyzer.js';
import { validateReplayCoachingResponse } from '../src/domains/stats/sudden-attack/replay/domain/replay-coaching-response.js';
import { auditReplayCoachingQuality, rawRoundFacts } from './replay-coaching-quality.mjs';
const require=createRequire(import.meta.url);
const facts=require('../cloud-functions/replay-coaching-facts.js');
const {buildCoachingRequest}=require('../cloud-functions/replay-coaching-preflight.js');
const {normalizeCoachingResult}=require('../cloud-functions/replay-coaching-result.js');
const decimal=n=>Number(n.toFixed(1));
// Parse only the deterministic observation templates. Expected values come from
// independent raw-event queries, not from re-reading the rendered evidence.
function checkFact(fact, raw, metrics) {
  let expected;
  const round=Number(fact.evidenceRefs[0]?.match(/^round-(\d+)$/)?.[1]);
  const r=raw.get(round);
  if(fact.type==='aggregate')expected=[metrics.rounds,metrics.kills,metrics.deaths,metrics.averageSurvivalSeconds];
  else if(fact.type==='aggregate_opening')expected=[metrics.rounds,metrics.openingKills,metrics.openingDeaths];
  else if(fact.type==='round_start')expected=[round,r.initialAlive.own,r.initialAlive.enemy];
  else if(fact.type==='round_result') {
    expected=[round,r.kills,Number(Boolean(r.death)),decimal(r.survivalSeconds)];
    assert.equal(fact.observation.endsWith(r.result==='win'?'승리입니다.':'패배입니다.'),true);
  } else if(fact.type==='solo')expected=[round,decimal(r.alone.timeSeconds),1,r.alone.opponentsAlive];
  else if(fact.type==='death')expected=[round,decimal(r.death.timeSeconds),r.death.ownAlive,r.death.enemyAlive];
  else if(fact.type==='opening') {
    expected=[round,decimal(r.opening.timeSeconds)];
    assert.equal(fact.observation.includes('동시'),r.opening.simultaneous);
  } else if(fact.type==='posthumous')expected=[round,r.kills,r.killsAfterDeath];
  else if(fact.type==='trade_made') {
    const t=r.tradesMade[Number(fact.id.match(/made(\d+)$/)[1])-1];
    expected=[round,decimal(t.timeSeconds-t.gapSeconds),t.alliedDeathsAtPriorTime,decimal(t.gapSeconds),decimal(t.timeSeconds)];
    assert.match(fact.observation,/본인이 상대를 처치/);
  } else if(fact.type==='trade_received') {
    const t=r.tradesReceived[Number(fact.id.match(/received(\d+)$/)[1])-1];
    expected=[round,decimal(r.death.timeSeconds),decimal(t.gapSeconds),decimal(t.timeSeconds)];
    assert.match(fact.observation,/본인 사망.*팀원이 같은 상대를 처치/);
  } else assert.fail('Unknown server fact');
  assert.deepEqual([...fact.observation.matchAll(/\d+(?:\.\d+)?/g)].map(m=>Number(m[0])),expected);
}

export function auditCoachingFacts(replay) {
  const oracle=auditReplayCoachingQuality(replay),players=getReplayPlayers(replay),reports=[];
  let checkedFacts=0,checkedChoices=0,checkedTriples=0,maxResultBytes=0,maxRequestBytes=0;
  for(const [index,player] of players.entries()) {
    const e=analyzeReplay(replay,player.nexonSN).coachingEvidence;if(!e.metrics)continue;
    const catalog=facts.createCoachingFactCatalog(e),raw=new Map();
    for(const round of replay.replay_info.replayRoundInfo)if(e.rounds.some(r=>r.round===Number(round.no)))raw.set(Number(round.no),rawRoundFacts(round,player.nexonSN));
    const request=buildCoachingRequest(e).request;maxRequestBytes=Math.max(maxRequestBytes,Buffer.byteLength(JSON.stringify(request)));
    const largest={strength:[],review:[],practice:[]};
    for(const fact of catalog.facts) {
      checkFact(fact,raw,oracle.players[index].metrics);checkedFacts++;
      for(const kind of fact.kinds) {
        let best=null;
        for(const questionId of fact.questions)for(const practiceId of fact.practices) {
          const choice={kind,factId:fact.id,questionId,practiceId},selection={schemaVersion:2,cards:[choice]};
          const response=facts.renderCoachingSelection(selection,e);
          assert.deepEqual(validateReplayCoachingResponse(response,e),response);
          const stored=normalizeCoachingResult({providerResponseId:'resp_'+ 'x'.repeat(120),selection,response});
          const bytes=Buffer.byteLength(JSON.stringify(stored));maxResultBytes=Math.max(maxResultBytes,bytes);
          if(!best||bytes>best.bytes)best={choice,bytes};checkedChoices++;
        }
        largest[kind].push(best.choice);
      }
    }
    // The longest option at each fact/kind bounds that fact's stored text. Check
    // all distinct-fact triples, including the maximum provider response-ID size.
    for(const a of largest.strength)for(const b of largest.review)for(const c of largest.practice) {
      if(new Set([a.factId,b.factId,c.factId]).size<3)continue;
      const selection={schemaVersion:2,cards:[a,b,c]},response=facts.renderCoachingSelection(selection,e);
      const stored=normalizeCoachingResult({providerResponseId:'resp_'+ 'x'.repeat(120),selection,response});
      maxResultBytes=Math.max(maxResultBytes,Buffer.byteLength(JSON.stringify(stored)));checkedTriples++;
    }
    reports.push({player:index+1,verifiedRounds:e.coverage.verifiedRounds,selectedRounds:e.rounds.length,
      facts:catalog.facts.length,omittedFacts:catalog.selection.omittedFacts});
  }
  return {schemaVersion:1,mode:'offline_fact_selection_audit',playerCount:players.length,roundCount:replay.replay_info.replayRoundInfo.length,
    checkedFacts,checkedChoices,checkedTriples,maxRequestBytes,maxResultBytes,externalCalls:0,inputTokens:null,players:reports,
    limitations:['One actual file is one match.','Source completeness is selected by the existing analyzer; raw-event queries independently check selected facts.',
      'Checks deterministic facts and eligible text combinations, not real AI prioritization, paid value, actual token count or source authenticity.']};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const args=process.argv.slice(2);assert.equal(args.length,4);assert.equal(args[0],'--replay');assert.equal(args[2],'--report');
    const report=auditCoachingFacts(parseReplayText(await fs.readFile(args[1],'utf8')));
    await fs.writeFile(args[3],JSON.stringify(report,null,2)+'\n',{flag:'wx'});
    const {players,limitations,...summary}=report;console.log(JSON.stringify(summary));
  } catch {console.error('Offline fact audit failed. Check supported input and a new report path; no API called.');process.exitCode=1;}
}
