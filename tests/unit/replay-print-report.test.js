import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeReplay } from '../../src/domains/stats/sudden-attack/replay/domain/replay-analyzer.js';
import { createReplaySamples } from '../../src/domains/stats/sudden-attack/replay/domain/replay-samples.js';
import { createReplayPrintReportModel, renderReplayPrintReport } from '../../src/domains/stats/sudden-attack/replay/ui/replay-print-report.js';

const sample = async () => analyzeReplay(JSON.parse(await createReplaySamples()[0].text()), 'sample-player');

test('report matches sample official totals and weighted verified-round metrics', async () => {
  const analysis = await sample();
  const model = createReplayPrintReportModel(analysis);
  assert.equal(model.official.kills, 6);
  assert.equal(model.official.deaths, 6);
  assert.deepEqual(model.verified, { rounds: 6, total: 6, kills: 6, deaths: 6, averageSurvival: 18, survivalRate: 0 });
  assert.equal(model.rounds.length, 6);
  assert.ok(model.moments.length > 0);
});

test('partial rounds remain listed but cannot inflate verified metrics or key moments', async () => {
  const analysis = await sample();
  analysis.rounds[0].context = { status: 'partial' };
  analysis.rounds[0].kills = Array.from({ length: 100 }, () => ({}));
  analysis.rounds[0].survivalSeconds = 99999;
  analysis.contextSummary.openingDeaths = [{ round: analysis.rounds[0].round, timeSeconds: 1, own: 5, enemy: 5 }];
  const model = createReplayPrintReportModel(analysis);
  assert.equal(model.official.kills, 6);
  assert.equal(model.verified.rounds, 5);
  assert.equal(model.verified.kills, analysis.rounds.slice(1).reduce((sum, round) => sum + round.kills.length, 0));
  assert.equal(model.verified.averageSurvival, analysis.rounds.slice(1).reduce((sum, round) => sum + round.survivalSeconds, 0) / 5);
  assert.equal(model.rounds[0].kills, null);
  assert.equal(model.rounds[0].survival, null);
  assert.ok(model.moments.every(moment => moment.round !== analysis.rounds[0].round));
  assert.match(renderReplayPrintReport(model), /검증 보류/);
});

test('all partial or empty rounds show unavailable metrics rather than invented zero rates', async () => {
  const analysis = await sample();
  for (const round of analysis.rounds) round.context = { status: 'partial' };
  for (const rounds of [analysis.rounds, []]) {
    const model = createReplayPrintReportModel({ ...analysis, rounds });
    assert.equal(model.verified.averageSurvival, null);
    assert.equal(model.verified.survivalRate, null);
    assert.equal(model.moments.length, 0);
    const html = renderReplayPrintReport(model);
    assert.match(html, /집계 불가/);
    assert.doesNotMatch(html, /NaN|Infinity/);
  }
});

test('report snapshots omit private identifiers, raw event coordinates, filename, forecast and paid review', async () => {
  const analysis = await sample();
  analysis.match.id = 'private-match-token';
  analysis.player.nexonSN = 'private-player-token';
  analysis.forecast = { secret: 'private-forecast-token' };
  analysis.coachingEvidence = { secret: 'private-review-token' };
  analysis.filename = 'private-filename-token.json';
  analysis.rounds[0].kills[0].distance = 87654321;
  const before = JSON.stringify(analysis);
  const model = createReplayPrintReportModel(analysis);
  const snapshot = JSON.stringify(model);
  assert.doesNotMatch(snapshot, /private-|87654321|nexonSN|forecast|coachingEvidence|filename/);
  assert.equal(JSON.stringify(analysis), before);
  analysis.player.nickName = '다른 선수';
  analysis.rounds[1].kills.push({});
  assert.equal(JSON.stringify(model), snapshot);
});

test('untrusted nickname and match metadata are escaped in report markup', async () => {
  const analysis = await sample();
  analysis.player.nickName = '<img src=x onerror="bad()">';
  analysis.match.mapName = '<script>alert(1)</script>';
  analysis.match.date = '" autofocus onfocus="bad()';
  analysis.match.score = '<svg onload="bad()">';
  const html = renderReplayPrintReport(createReplayPrintReportModel(analysis));
  assert.doesNotMatch(html, /<img|<script|<svg|<[^>]*onerror=/);
  assert.match(html, /&lt;img/);
  assert.match(html, /&lt;script/);
  assert.match(html, /&quot; autofocus/);
});
