import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import depth from '../../cloud-functions/replay-coaching-depth.js';
import { analyzeReplay } from '../../src/domains/stats/sudden-attack/replay/domain/replay-analyzer.js';
import { createReplaySamples } from '../../src/domains/stats/sudden-attack/replay/domain/replay-samples.js';
import { createReplayProductExample, renderReplayProductExample, replaceReplayProductExample, EXAMPLE_SELECTION, EXAMPLE_START, EXAMPLE_END } from '../../scripts/replay-product-example.mjs';

test('public sample uses the same fictional replay and current validated coaching facts and goals', async () => {
  const analysis = analyzeReplay(JSON.parse(await createReplaySamples()[0].text()), 'sample-player');
  const evidence = analysis.coachingEvidence;
  const response = depth.renderCoachingDepthSelection(depth.curateCurrentDepthSelection(EXAMPLE_SELECTION, evidence), evidence);
  const example = await createReplayProductExample();
  assert.equal(example.nickname, analysis.player.nickName);
  assert.equal(example.mapName, analysis.match.mapName);
  assert.equal(example.rounds, 6);
  assert.equal(example.verifiedRounds, 6);
  assert.equal(example.cards.length, 3);
  for (const [index, card] of example.cards.entries()) {
    const actual = response.cards[index];
    assert.equal(card.observation, actual.observation);
    assert.equal(card.title, actual.title);
    assert.equal(`복기: ${card.question}\n${card.goal}`, actual.practice);
    assert.equal(card.limitation, actual.limitation);
    assert.ok(evidence.rounds.some(round => round.round === card.round && actual.evidenceRefs.includes(round.evidenceId)));
  }
  assert.match(example.cards[0].observation, /8\.0초.*팀 패배/);
  assert.match(example.cards[1].observation, /시작 5대5.*18\.0초.*본인 포함 5대4.*팀 승리/);
  const catalog = depth.createCoachingDepthCatalog(evidence);
  assert.equal(new Set(EXAMPLE_SELECTION.cards.map(card => catalog.facts.find(fact => fact.id === card.factId).topic)).size, 3);
  assert.doesNotMatch(JSON.stringify(example), /sample-player|sample-enemy|nexonSN|matchID|apiKey/);
});

test('checked-in public example reproduces current facts and clearly discloses its manual fictional origin', async () => {
  const html = (await readFile('src/domains/ai-replay-pass/index.html', 'utf8')).replaceAll('\r\n', '\n');
  const fragment = renderReplayProductExample(await createReplayProductExample());
  assert.equal(replaceReplayProductExample(html, fragment), html);
  assert.match(fragment, /수동 선택한 구성 예시이며, 실제 AI 생성 결과가 아닙니다/);
  assert.match(fragment, /항상 예시처럼 3장을 제공하는 것은 아니며/);
  assert.match(fragment, /무료 체험에는 유료 AI 선택이 포함되지 않습니다/);
  assert.doesNotMatch(fragment, /<script|<iframe|<button|data-purchase-mode/);
});

test('example renderer escapes text instead of interpreting markup as sample content', async () => {
  const example = await createReplayProductExample();
  example.nickname = '<img src=x onerror="bad()">';
  example.cards[0].goal = '<script>bad()</script>';
  example.cards[1].question = '" onfocus="bad()';
  const html = renderReplayProductExample(example);
  assert.doesNotMatch(html, /<img|<script/);
  assert.match(html, /&lt;img/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /&quot; onfocus=&quot;/);
});

test('content regeneration is limited to one explicit example marker pair', () => {
  const before = '<section id="purchase">existing checkout</section>';
  const after = '<section id="refund-title">existing terms</section>';
  const html = `${before}${EXAMPLE_START}old${EXAMPLE_END}${after}`;
  const updated = replaceReplayProductExample(html, 'new');
  assert.ok(updated.startsWith(before + EXAMPLE_START));
  assert.ok(updated.endsWith(EXAMPLE_END + after));
  assert.throws(() => replaceReplayProductExample(before + after, 'new'));
  assert.throws(() => replaceReplayProductExample(html + EXAMPLE_START, 'new'));
  assert.throws(() => replaceReplayProductExample(html + EXAMPLE_END, 'new'));
});
