import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { analyzeReplay, getReplayPlayers, parseReplayText } from '../src/domains/stats/sudden-attack/replay/domain/replay-analyzer.js';
import { createMockReplayCoachingResponse } from '../src/domains/stats/sudden-attack/replay/application/replay-coaching-preview.js';
import { validateReplayCoachingResponse } from '../src/domains/stats/sudden-attack/replay/domain/replay-coaching-response.js';

const { normalizeCoachingEvidence } = createRequire(import.meta.url)('../cloud-functions/replay-coaching-input.js');
const id = value => String(value);
const sum = (rows, get) => rows.reduce((n, row) => n + get(row), 0);

// Offline audit oracle: recompute each query from raw events, independently of
// the production state machine. Only call for rounds it marks complete; rejected
// inputs need separately labelled fixtures, not circular validation here.
export function rawRoundFacts(round, playerId) {
  const focus = id(playerId), entries = round.replayRoundSummaryInfo;
  const teams = new Map(entries.map(p => [id(p.nexonSN), Number(p.teamNo)]));
  const ownTeam = teams.get(focus);
  const events = round.replayAttackInfo.map(e => ({ at: Number(e.timeStamp),
    attacker: id(e.attackerNexonSN), victim: id(e.victimNexonSN) }));
  const before = at => new Set(events.filter(e => e.at < at).map(e => e.victim));
  const counts = dead => ({ own: entries.filter(p => teams.get(id(p.nexonSN)) === ownTeam && !dead.has(id(p.nexonSN))).length,
    enemy: entries.filter(p => teams.get(id(p.nexonSN)) !== ownTeam && !dead.has(id(p.nexonSN))).length });
  const firstAt = Math.min(...events.map(e => e.at));
  const simultaneous = at => events.filter(e => e.at === at).length > 1;
  const selectedKills = events.filter(e => e.attacker === focus);
  const deathEvent = events.find(e => e.victim === focus);
  const death = deathEvent ? { timeSeconds: deathEvent.at / 10, ...counts(before(deathEvent.at)),
    opening: deathEvent.at === firstAt, simultaneous: simultaneous(deathEvent.at) } : null;
  const openingKill = selectedKills.some(e => e.at === firstAt);
  const openingDeath = Boolean(death?.opening);
  const tradesMade = [], tradesReceived = [];
  for (const event of events) {
    // Most recent earlier kill by the opponent; ties retain every allied victim.
    const earlier = events.filter(e => e.attacker === event.victim && e.at < event.at);
    const priorAt = Math.max(...earlier.map(e => e.at));
    const prior = earlier.filter(e => e.at === priorAt);
    if (!prior.length || event.at - priorAt > 50 || before(event.at).has(event.attacker)
      || teams.get(event.attacker) !== teams.get(prior[0].victim)) continue;
    const trade = { timeSeconds: event.at / 10, gapSeconds: (event.at - priorAt) / 10,
      alliedDeathsAtPriorTime: prior.length };
    if (event.attacker === focus) tradesMade.push(trade);
    if (prior.some(e => e.victim === focus)) tradesReceived.push(trade);
  }
  const orderTrades = values => values.sort((a, b) => a.timeSeconds - b.timeSeconds || a.gapSeconds - b.gapSeconds
    || a.alliedDeathsAtPriorTime - b.alliedDeathsAtPriorTime);
  const initial = counts(new Set());
  let alone = initial.own === 1 && initial.enemy >= 2 ? { timeSeconds: 0, opponentsAlive: initial.enemy } : null;
  for (const at of [...new Set([0, ...events.map(e => e.at)])].sort((a, b) => a - b)) {
    if (alone) break;
    const dead = new Set(events.filter(e => e.at <= at).map(e => e.victim)), alive = counts(dead);
    if (!dead.has(focus) && alive.own === 1 && alive.enemy >= 2) {
      alone = { timeSeconds: at / 10, opponentsAlive: alive.enemy }; break;
    }
  }
  return { round: Number(round.no), side: Number(round.offenseTeam) === ownTeam ? 'attack' : 'defense',
    result: Number(round.winTeam) === ownTeam ? 'win' : 'loss', durationSeconds: Number(round.playTime),
    survivalSeconds: death?.timeSeconds ?? Number(round.playTime), kills: selectedKills.length,
    killsAfterDeath: selectedKills.filter(e => death && e.at > deathEvent.at).length,
    initialAlive: counts(new Set()), opening: openingKill || openingDeath ? {
      timeSeconds: firstAt / 10, selectedKill: openingKill, selectedDeath: openingDeath, simultaneous: simultaneous(firstAt) } : null,
    death: death ? { timeSeconds: death.timeSeconds, ownAlive: death.own, enemyAlive: death.enemy,
      opening: death.opening, simultaneous: death.simultaneous } : null,
    tradesMade: orderTrades(tradesMade), tradesReceived: orderTrades(tradesReceived), alone };
}

function aggregate(facts) {
  if (!facts.length) return null;
  return { evidenceId: 'verified-rounds', rounds: facts.length, kills: sum(facts, r => r.kills),
    killsAfterDeath: sum(facts, r => r.killsAfterDeath), deaths: sum(facts, r => Number(Boolean(r.death))),
    survivedRounds: sum(facts, r => Number(!r.death)), wonRounds: sum(facts, r => Number(r.result === 'win')),
    averageSurvivalSeconds: Number((sum(facts, r => r.survivalSeconds) / facts.length).toFixed(1)),
    openingKills: sum(facts, r => Number(Boolean(r.opening?.selectedKill))),
    openingDeaths: sum(facts, r => Number(Boolean(r.opening?.selectedDeath))),
    tradeCandidatesMade: sum(facts, r => r.tradesMade.length), tradeCandidatesReceived: sum(facts, r => r.tradesReceived.length),
    outnumberedSoloRounds: sum(facts, r => Number(Boolean(r.alone))) };
}

// Deliberately limited to the current Korean templates. This is an offline
// regression gate, not a semantic validator for arbitrary future model prose.
export function checkTemplateFacts(response, facts, metrics) {
  for (const card of response.cards) {
    const text = card.observation;
    if (card.evidenceRefs.includes('verified-rounds')) {
      assert.equal(text, `검증된 ${metrics.rounds}개 라운드에서 ${metrics.kills}킬·${metrics.deaths}사망, 평균 생존 ${metrics.averageSurvivalSeconds.toFixed(1)}초를 기록했습니다.`);
      continue;
    }
    assert.equal(card.evidenceRefs.length, 1);
    const r = facts.find(r => `round-${r.round}` === card.evidenceRefs[0]);
    assert.ok(r, 'Observation must cite a verified raw round');
    const allowed = [];
    const death = r.death;
    for (const t of r.tradesMade) allowed.push(`${r.round}라운드에서 팀원을 처치한 상대를 ${t.gapSeconds.toFixed(1)}초 뒤 처치한 기록이 있습니다.`);
    if (r.opening?.selectedKill) allowed.push(`${r.round}라운드 ${r.opening.timeSeconds.toFixed(1)}초에 ${r.opening.simultaneous ? '첫 처치들과 같은 시각의 처치' : '첫 처치'}를 기록했습니다.`);
    if (r.kills) allowed.push(`${r.round}라운드에 ${r.kills}킬을 기록했습니다.${r.killsAfterDeath ? ` 사망 이후 처치 ${r.killsAfterDeath}건이 포함됩니다.` : ''}`);
    if (death) {
      const prefix = `${r.round}라운드 ${death.timeSeconds.toFixed(1)}초`;
      if (death.opening) allowed.push(`${prefix}, 본인 포함 ${death.ownAlive}대${death.enemyAlive}에서 ${death.simultaneous ? '첫 사망들과 같은 시각에 사망했습니다' : '첫 사망했습니다'}.`);
      allowed.push(`${prefix}에 본인 포함 ${death.ownAlive}대${death.enemyAlive}에서 사망했습니다.`);
      for (const t of r.tradesReceived) allowed.push(`${prefix}에 본인 포함 ${death.ownAlive}대${death.enemyAlive}에서 사망했고, ${t.gapSeconds.toFixed(1)}초 뒤 팀원이 같은 상대를 처치했습니다.`);
    }
    if (r.alone) allowed.push(`${r.round}라운드 ${r.alone.timeSeconds.toFixed(1)}초부터 1대${r.alone.opponentsAlive} 상황에 남았고, 라운드 결과는 ${r.result === 'win' ? '승리' : '패배'}였습니다.`);
    assert.ok(allowed.includes(text), 'Observation differs from raw events or adds an unsupported fact');
  }
}

export function auditReplayCoachingQuality(replay) {
  const players = getReplayPlayers(replay), raw = replay.replay_info.replayRoundInfo;
  assert.ok(players.length && raw.length, 'Quality audit requires players and rounds');
  const reports = players.map((player, index) => {
    const analysis = analyzeReplay(replay, player.nexonSN), evidence = analysis.coachingEvidence;
    const verified = analysis.rounds.filter(r => r.context.status === 'complete'
      && Number.isSafeInteger(r.round) && r.round >= 1 && analysis.rounds.filter(other => other.round === r.round).length === 1);
    const facts = verified.map(r => {
      const original = raw.find(row => Number(row.no) === r.round), facts = rawRoundFacts(original, player.nexonSN);
      const summary = original.replayRoundSummaryInfo.find(p => id(p.nexonSN) === player.nexonSN);
      assert.equal(facts.kills, Number(summary.kill), 'Raw event kills differ from round summary');
      assert.equal(Number(Boolean(facts.death)), Number(summary.death), 'Raw event death differs from round summary');
      const c = r.context;
      assert.deepEqual(c.initial, facts.initialAlive);
      assert.deepEqual(c.death && { timeSeconds: c.death.timeSeconds, ownAlive: c.death.own,
        enemyAlive: c.death.enemy, opening: c.death.opening, simultaneous: c.death.simultaneous }, facts.death);
      assert.deepEqual(c.opening && (c.opening.selectedKill || c.opening.selectedDeath) ? c.opening : null, facts.opening);
      assert.deepEqual(c.alone && { timeSeconds: c.alone.timeSeconds, opponentsAlive: c.alone.opponentAlive }, facts.alone);
      const compareTrades = trades => trades.map(t => ({ timeSeconds: t.timeSeconds, gapSeconds: t.gapSeconds,
        alliedDeathsAtPriorTime: t.teammateIds.length })).sort((a, b) => a.timeSeconds - b.timeSeconds
          || a.gapSeconds - b.gapSeconds || a.alliedDeathsAtPriorTime - b.alliedDeathsAtPriorTime);
      assert.deepEqual(compareTrades(c.tradesMade), facts.tradesMade);
      assert.deepEqual(compareTrades(c.tradesReceived), facts.tradesReceived);
      return facts;
    });
    const metrics = aggregate(facts);
    assert.deepEqual(evidence.metrics, metrics, `Player ${index + 1}: aggregate mismatch`);
    for (const detail of evidence.rounds) {
      const expected = facts.find(r => r.round === detail.round);
      const { evidenceId, selectionReason, ...actual } = detail;
      const tradeSummary = trades => ({ count: trades.length, examples: trades.slice(0, 2), omittedExamples: Math.max(0, trades.length - 2) });
      assert.deepEqual(actual, { ...expected, tradesMade: tradeSummary(expected.tradesMade), tradesReceived: tradeSummary(expected.tradesReceived) });
    }
    // Cross the actual server input boundary as well as local template rendering.
    const normalized = normalizeCoachingEvidence(evidence);
    const response = validateReplayCoachingResponse(createMockReplayCoachingResponse(normalized), normalized);
    checkTemplateFacts(response, facts, metrics);
    const local = createMockReplayCoachingResponse(evidence);
    assert.deepEqual(local, response, 'Server normalization changes template facts');
    return { player: index + 1, status: evidence.status, coverage: evidence.coverage, metrics,
      observations: response.cards.map(c => ({ kind: c.kind, text: c.observation, evidenceRefs: c.evidenceRefs })) };
  });
  return { schemaVersion: 1, mode: 'offline_template_audit', playerCount: players.length,
    roundCount: raw.length, verifiedPlayerRounds: sum(reports, r => r.coverage.verifiedRounds),
    excludedPlayerRounds: sum(reports, r => r.coverage.excludedRounds),
    checkedObservations: sum(reports, r => r.observations.length), players: reports,
    limitations: ['One file is one match, regardless of player count.',
      'Complete-round selection is not independently proven; labelled rejection fixtures cover that boundary.',
      'Checks current template observations, not future generated prose, coaching usefulness or long-term skill.',
      'No provider calls, billing, raw replay, nicknames or account IDs are included in the report.'] };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2);
    assert.equal(args.length, 4, 'Use --replay <local.json> --report <new-report.json>');
    assert.equal(args[0], '--replay'); assert.equal(args[2], '--report');
    const report = auditReplayCoachingQuality(parseReplayText(await readFile(args[1], 'utf8')));
    // Refuse overwrite, including accidental use of the input path as output.
    await writeFile(args[3], JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
    console.log(JSON.stringify({ mode: report.mode, players: report.playerCount, rounds: report.roundCount,
      verifiedPlayerRounds: report.verifiedPlayerRounds, excludedPlayerRounds: report.excludedPlayerRounds,
      checkedObservations: report.checkedObservations }));
  } catch {
    // Do not echo assertion diffs: a future input may carry identifying data.
    console.error('Replay quality audit failed. Check arguments, supported input and a new report path.');
    process.exitCode = 1;
  }
}
