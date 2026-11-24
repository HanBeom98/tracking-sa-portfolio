import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { analyzeReplay, getDetailAnalysis, getKeyMoments, getReplayPlayers, parseReplayText, validateReplayFile } from '../../src/domains/stats/sudden-attack/replay/domain/replay-analyzer.js';
import { buildReplayPlayback } from '../../src/domains/stats/sudden-attack/replay/domain/replay-playback.js';
import { renderReplayResults } from '../../src/domains/stats/sudden-attack/replay/ui/replay-results-view.js';
const fixture={replay_info:{replayMatchSummaryInfo:{matchID:'260726210036121003',mapName:'팰리스-심플',matchDate:'2026',winTeam:0,teamAWinCnt:1,teamBWinCnt:0},replayCharacterSummaryInfo:[{nexonSN:'me',nickName:'Tracking',teamNo:1,kill:1,death:1,assist:1,damage:245},{nexonSN:'mate',nickName:'Team',teamNo:1},{nexonSN:'dead-mate',nickName:'Dead Team',teamNo:1},{nexonSN:'enemy',nickName:'Enemy',teamNo:0}],replayRoundInfo:[{no:1,offenseTeam:0,winTeam:0,playTime:60,replayRoundSummaryInfo:[{nexonSN:'me',teamNo:0},{nexonSN:'mate',teamNo:0},{nexonSN:'dead-mate',teamNo:0},{nexonSN:'enemy',teamNo:1}],replayCharacterInfo:[{nexonSN:'me',replayCharacterStateInfo:[{timeStamp:200,state:2,posX:10,posY:10}]},{nexonSN:'mate',replayCharacterStateInfo:[{timeStamp:200,state:1,posX:30,posY:30}]},{nexonSN:'dead-mate',replayCharacterStateInfo:[{timeStamp:180,state:2,posX:11,posY:11}]}],replayAttackInfo:[{timeStamp:150,attackerNexonSN:'me',victimNexonSN:'enemy',victimNickName:'Enemy',itemName:'AK-47',attackerPosX:0,attackerPosY:0,victimPosX:300,victimPosY:400},{timeStamp:180,attackerNexonSN:'enemy',victimNexonSN:'dead-mate',victimNickName:'Dead Team',itemName:'AK-47',attackerPosX:100,attackerPosY:100,victimPosX:11,victimPosY:11},{timeStamp:200,attackerNexonSN:'enemy',attackerNickName:'Enemy',victimNexonSN:'me',itemName:'MSR-200',attackerPosX:100,attackerPosY:100,victimPosX:10,victimPosY:10}],replayThrowWeaponEventInfo:[{timeStamp:80,nexonSN:'me',itemName:'G600',firePosX:0,firePosY:0,posX:30,posY:40}]}]}};
test('parses replay and players',()=>{const parsed=parseReplayText(JSON.stringify(fixture));assert.equal(getReplayPlayers(parsed)[0].nickName,'Tracking')});
test('rejects invalid files',()=>{assert.throws(()=>validateReplayFile({name:'x.txt',size:1}),/JSON_ONLY/);assert.throws(()=>parseReplayText('{}'),/UNSUPPORTED_REPLAY/)});
test('rejects replay files without a selectable player',()=>{assert.throws(()=>parseReplayText(JSON.stringify({replay_info:{replayMatchSummaryInfo:{},replayCharacterSummaryInfo:[]}})),/UNSUPPORTED_REPLAY/)});
test('calculates replay facts with round-specific teams and living teammates',()=>{const a=analyzeReplay(fixture,'me');assert.equal(a.match.id,'260726210036121003');assert.equal(a.rounds[0].won,true);assert.equal(a.rounds[0].offense,true);assert.equal(a.rounds[0].kills[0].distance,500);assert.equal(a.rounds[0].throws[0].travelDistance,50);assert.equal(a.rounds[0].death.timeSeconds,20);assert.equal(a.rounds[0].death.nearestTeammateDistance,28)});
test('builds survival comparisons without inventing missing categories',()=>{const a=analyzeReplay(fixture,'me');assert.equal(a.totals.survivalBySide.offense,20);assert.equal(a.totals.survivalBySide.defense,null);assert.equal(a.totals.survivalByResult.won,20);assert.equal(a.totals.survivalByResult.lost,null);assert.ok(Math.abs(a.totals.survivalRateBySide.offense-33.333)<.01);assert.equal(a.totals.survivalRateBySide.defense,null);assert.equal(a.totals.longestSurvivalRound.round,1)});
test('summarizes throw usage without claiming causation',()=>{const a=analyzeReplay(fixture,'me');assert.equal(a.totals.throwUsage.offense,1);assert.equal(a.totals.throwUsage.defense,0);assert.equal(a.totals.throwUsage.first.round,1);assert.equal(a.totals.throwUsage.first.timeSeconds,8);assert.equal(a.totals.throwUsage.killsWithinFiveSeconds,0);assert.equal(a.totals.throwUsage.deathsWithinFiveSeconds,0);assert.deepEqual(a.totals.throwUsage.roundsWithoutThrow,[])});
test('summarizes coordinate-backed combat and teammate distances',()=>{const a=analyzeReplay(fixture,'me');assert.equal(a.totals.combatDistance.averageKill,500);assert.equal(a.totals.combatDistance.averageDeath,127);assert.equal(a.totals.combatDistance.killSampleSize,1);assert.equal(a.totals.combatDistance.deathSampleSize,1);assert.equal(a.totals.combatDistance.longestKill,500);assert.equal(a.totals.combatDistance.byWeapon[0].weapon,'AK-47');assert.equal(a.totals.teammateSpacing.offense,28);assert.equal(a.totals.teammateSpacing.defense,null);assert.match(getDetailAnalysis(a,'COMBAT').items[0],/1회 처치.*약 5m/)});
test('does not invent distances when replay coordinates are missing',()=>{const missing=structuredClone(fixture);delete missing.replay_info.replayRoundInfo[0].replayAttackInfo[0].attackerPosX;const a=analyzeReplay(missing,'me');assert.equal(a.rounds[0].kills[0].distance,null);assert.equal(a.totals.combatDistance.killSampleSize,0)});
test('selects evidence-backed key moments that link to a round',()=>{const a=analyzeReplay(fixture,'me');const moments=getKeyMoments(a);assert.equal(moments[0].round,1);assert.equal(moments[0].tone,'good');assert.equal(moments[1].round,1);assert.equal(moments[1].tone,'review');assert.match(moments[1].body,/5\.0초 뒤/)});
test('limits detail types and labels estimated straight-line distance',()=>{const a=analyzeReplay(fixture,'me');const deaths=getDetailAnalysis(a,'DEATHS');assert.equal(deaths.title,'사망 장면 분석');assert.match(deaths.items[0],/생존 팀원과 1m 미만 거리로 추정/);assert.match(getDetailAnalysis(a,'THROWS').items[0],/직선거리는 1m 미만인 것으로 추정/);assert.equal(getDetailAnalysis(a,'OTHER').title,'지원하지 않는 분석 항목')});
test('round cards do not use the globally fixed header element', () => {
  const markup = renderReplayResults(analyzeReplay(fixture, 'me'), buildReplayPlayback(fixture));
  assert.doesNotMatch(markup, /<header>/);
  assert.match(markup, /class="round-head"/);
  assert.match(markup, /1라운드/);
});
test('match flow links each visual round to its timeline card', () => {
  const markup = renderReplayResults(analyzeReplay(fixture, 'me'), buildReplayPlayback(fixture));
  assert.match(markup, /data-round-jump="1"/);
  assert.match(markup, /id="replayRound-1"/);
  assert.match(markup, /class="metric-bar"/);
});
test('replay visuals use an internal accessible SVG icon system', () => {
  const markup = renderReplayResults(analyzeReplay(fixture, 'me'), buildReplayPlayback(fixture));
  assert.match(markup, /class="icon-sprite" aria-hidden="true"/);
  assert.match(markup, /class="ui-icon" aria-hidden="true"/);
  assert.match(markup, /replay-icon-target/);
  assert.match(markup, /replay-icon-grenade/);
  assert.doesNotMatch(markup, /<img[^>]+icon/i);
});
test('throw metric labels and values remain on separate lines',()=>{const styles=fs.readFileSync('src/domains/stats/sudden-attack/replay/style.css','utf8');assert.match(styles,/\.survival-grid article>span\{display:block/);assert.match(styles,/\.survival-grid strong\{display:block/)});
test('ignores posthumous kills when describing the time before death',()=>{const replay=structuredClone(fixture);replay.replay_info.replayRoundInfo[0].replayAttackInfo.unshift({timeStamp:250,attackerNexonSN:'me',victimNexonSN:'enemy',victimNickName:'Enemy',itemName:'G600'});const a=analyzeReplay(replay,'me');const deathText=getDetailAnalysis(a,'DEATHS').items[0];assert.match(deathText,/마지막 처치 후 5\.0초 뒤/);assert.doesNotMatch(deathText,/-5\.0초/);});
