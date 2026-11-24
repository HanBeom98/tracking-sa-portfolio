import test from 'node:test';
import assert from 'node:assert/strict';
import {createReplaySamples} from '../../src/domains/stats/sudden-attack/replay/domain/replay-samples.js';
import {parseReplayText,analyzeReplay,validateReplayFile} from '../../src/domains/stats/sudden-attack/replay/domain/replay-analyzer.js';
import {buildReplayPlayback} from '../../src/domains/stats/sudden-attack/replay/domain/replay-playback.js';
import {prepareReplayComparison,compareReplayGames} from '../../src/domains/stats/sudden-attack/replay/domain/replay-comparison.js';

test('fictional samples form two different complete matches for the same ten players',async()=>{
  const files=createReplaySamples();
  const entries=[];
  for(const file of files){
    validateReplayFile(file);
    const parsed=parseReplayText(await file.text());
    const analysis=analyzeReplay(parsed,'sample-player');
    assert.equal(analysis.rounds.length,6);
    assert.equal(analysis.contextSummary.completeRounds,6);
    assert.match(analysis.match.mapName,/가상/);
    const playback=buildReplayPlayback(parsed);
    assert.equal(playback.verifiedRounds,6);
    assert.equal(playback.metric,'match-estimate');
    const end=playback.rounds.at(-1).points.at(-1);
    assert.equal(end.phase,'finished');
    assert.equal(end.indexA,parsed.replay_info.replayMatchSummaryInfo.winTeam===0?100:0);
    assert.equal(playback.rounds[4].offense,1);
    assert.equal(playback.rounds[3].offense,0);
    entries.push({name:file.name,parsed});
  }
  const prepared=prepareReplayComparison(entries);
  assert.equal(prepared.players.length,10);
  const report=compareReplayGames(prepared,'sample-player');
  assert.equal(report.games.length,2);
  assert.equal(report.aggregate.rounds,12);
  assert.notEqual(report.games[0].metrics.kills,report.games[1].metrics.kills);
});
