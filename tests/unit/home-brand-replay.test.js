import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createReplaySamples} from '../../src/domains/stats/sudden-attack/replay/domain/replay-samples.js';
import {buildReplayPlayback} from '../../src/domains/stats/sudden-attack/replay/domain/replay-playback.js';
import {getReplayAdvantagePaths} from '../../src/domains/stats/sudden-attack/replay/ui/replay-playback.js';

test('home preview is the same verified fictional match as the working single sample',async()=>{
  const raw=JSON.parse(await createReplaySamples()[0].text());
  const model=buildReplayPlayback(raw),before=structuredClone(model);
  const home=readFileSync('index.html','utf8');
  const preview=[...home.matchAll(/class="home-preview-line"[^>]* d="([^"]+)"/g)].map(m=>m[1]);
  assert.deepEqual(preview,getReplayAdvantagePaths(model));
  assert.equal(preview.length,6);
  assert.equal(model.metric,'match-estimate');
  assert.equal(model.verifiedRounds,6);
  assert.equal(model.rounds.at(-1).points.at(-1).phase,'finished');
  assert.equal(model.rounds.at(-1).points.at(-1).indexA,0);
  for(let i=1;i<model.rounds.length;i++)assert.equal(model.rounds[i-1].points.at(-1).indexA,model.rounds[i].points[0].indexA);
  assert.match(home,/data-home-preview-metric="match-estimate"/);
  assert.match(home,/A팀 기준 경기 승리 추정치 \(%\)/);
  assert.match(home,/동등 전력 가정 · 실측 승률 아님/);
  assert.deepEqual([raw.replay_info.replayMatchSummaryInfo.teamAWinCnt,raw.replay_info.replayMatchSummaryInfo.teamBWinCnt],[1,5]);
  assert.deepEqual(model,before);
  assert.ok(preview.every(path=>!/(NaN|Infinity)/.test(path)));
});
