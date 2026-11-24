import fs from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {analyzeReplay,getReplayPlayers,parseReplayText} from '../src/domains/stats/sudden-attack/replay/domain/replay-analyzer.js';
import {validateReplayCoachingResponse} from '../src/domains/stats/sudden-attack/replay/domain/replay-coaching-response.js';
import {rawRoundFacts} from './replay-coaching-quality.mjs';
import {auditCoachingFacts} from './replay-coaching-facts-audit.mjs';
const require=createRequire(import.meta.url);
const depth=require('../cloud-functions/replay-coaching-depth.js');
const {buildCoachingRequest}=require('../cloud-functions/replay-coaching-preflight.js');
const {normalizeCoachingResult}=require('../cloud-functions/replay-coaching-result.js');
const decimal=n=>Number(n.toFixed(1));

export function auditCoachingDepth(replay) {
  // Also retain the original independent checks for every legacy candidate.
  const legacy=auditCoachingFacts(replay),players=getReplayPlayers(replay);
  let depthFacts=0,choices=0,triples=0,maxResultBytes=0,maxRequestBytes=0;
  for(const player of players) {
    const e=analyzeReplay(replay,player.nexonSN).coachingEvidence;if(!e.metrics)continue;
    const catalog=depth.createCoachingDepthCatalog(e),largest={strength:[],review:[],practice:[]};
    maxRequestBytes=Math.max(maxRequestBytes,Buffer.byteLength(JSON.stringify(buildCoachingRequest(e).request)));
    for(const f of catalog.facts) {
      if(f.type.startsWith('depth_')) {
        const no=Number(f.evidenceRefs[0].slice(6));
        const r=rawRoundFacts(replay.replay_info.replayRoundInfo.find(r=>Number(r.no)===no),player.nexonSN);
        let expected;
        if(f.type==='depth_death') {
          expected=[no,r.initialAlive.own,r.initialAlive.enemy,decimal(r.death.timeSeconds),r.death.ownAlive,r.death.enemyAlive];
          const delta=(r.death.ownAlive-r.death.enemyAlive)-(r.initialAlive.own-r.initialAlive.enemy);
          assert.match(f.reviewReason,delta<0?/불리해진/:delta>0?/개선된/:/같은/);
          assert.equal(f.observation.includes('동시 사건'),r.death.simultaneous);
        }else if(f.type==='depth_opening') {
          expected=[no,decimal(r.opening.timeSeconds),r.kills,Number(Boolean(r.death))];
          assert.equal(f.observation.includes('동시'),r.opening.simultaneous);
          const action=r.opening.selectedKill&&r.opening.selectedDeath?'본인 처치·사망':r.opening.selectedKill?'본인 처치':'본인 사망';
          assert.ok(f.observation.includes(`${action} 기록`));
        }else if(f.type==='depth_solo')expected=[no,r.initialAlive.own,r.initialAlive.enemy,decimal(r.alone.timeSeconds),1,r.alone.opponentsAlive];
        else if(f.type==='depth_received') {
          const t=r.tradesReceived[Number(f.id.match(/received(\d+)$/)[1])-1];
          expected=[no,decimal(r.death.timeSeconds),decimal(t.gapSeconds),decimal(t.timeSeconds)];
          assert.match(f.observation,/본인 사망.*팀원 후속/);
        }else if(f.type==='depth_made') {
          const t=r.tradesMade[Number(f.id.match(/made(\d+)$/)[1])-1];
          expected=[no,decimal(t.timeSeconds-t.gapSeconds),t.alliedDeathsAtPriorTime,decimal(t.gapSeconds),decimal(t.timeSeconds)];
          assert.match(f.observation,/아군 사망.*본인 후속/);
        }else if(f.type==='depth_result')expected=[no,r.initialAlive.own,r.initialAlive.enemy,r.kills,Number(Boolean(r.death))];
        else assert.fail('Unknown depth fact');
        assert.deepEqual([...f.observation.matchAll(/\d+(?:\.\d+)?/g)].map(m=>Number(m[0])),expected);
        assert.ok(f.observation.includes(`팀 ${r.result==='win'?'승리':'패배'}`));depthFacts++;
      }
      for(const kind of f.kinds) {
        let best;
        for(const questionId of f.questions)for(const practiceId of f.practices) {
          const card={kind,factId:f.id,questionId,practiceId},selection={schemaVersion:2,cards:[card]};
          depth.validateCurrentDepthSelection(selection,e);
          const response=depth.renderCoachingDepthSelection(selection,e);
          assert.deepEqual(validateReplayCoachingResponse(response,e),response);
          const bytes=Buffer.byteLength(JSON.stringify(normalizeCoachingResult({providerResponseId:'resp_'+'x'.repeat(120),selection,response})));
          maxResultBytes=Math.max(maxResultBytes,bytes);choices++;
          if(!best||bytes>best.bytes)best={card,bytes};
        }
        largest[kind].push(best.card);
      }
    }
    for(const a of largest.strength)for(const b of largest.review)for(const c of largest.practice) {
      if(new Set([a,b,c].map(x=>x.factId.replace(/^depth1_/,''))).size!==3)continue;
      const selection={schemaVersion:2,cards:[a,b,c]},response=depth.renderCoachingDepthSelection(selection,e);
      const bytes=Buffer.byteLength(JSON.stringify(normalizeCoachingResult({providerResponseId:'resp_'+'x'.repeat(120),selection,response})));
      maxResultBytes=Math.max(maxResultBytes,bytes);triples++;
    }
  }
  return {schemaVersion:1,mode:'offline_depth_fact_and_storage_audit',playerCount:players.length,
    legacyFactsChecked:legacy.checkedFacts,depthFactsChecked:depthFacts,choicesChecked:choices,triplesChecked:triples,
    maxRequestBytes,maxResultBytes,externalCalls:0,inputTokens:null};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) {
  const arg=name=>process.argv[process.argv.indexOf(name)+1];
  assert.ok(process.argv.includes('--replay')&&process.argv.includes('--report'));
  const report=auditCoachingDepth(parseReplayText(fs.readFileSync(arg('--replay'),'utf8')));
  fs.writeFileSync(arg('--report'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(report));
}
