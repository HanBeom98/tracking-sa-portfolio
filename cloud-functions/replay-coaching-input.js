const fail = () => { throw Object.assign(new Error('INVALID_EVIDENCE'), { code: 'INVALID_EVIDENCE', status: 400 }); };
function object(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).length !== keys.length || keys.some(k => !Object.hasOwn(value, k))) fail();
}
function number(value, max, min = 0, integer = true) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max
    || (integer && !Number.isSafeInteger(value))) fail();
  return value;
}
function choice(value, choices) { if (!choices.includes(value)) fail(); return value; }
const boolean = value => choice(value, [true, false]);
function trades(value, duration, maxCount) {
  object(value, ['count', 'examples', 'omittedExamples']);
  const count = number(value.count, maxCount);
  if (!Array.isArray(value.examples) || value.examples.length !== Math.min(count, 2)
    || value.omittedExamples !== count - value.examples.length) fail();
  return { count, examples: value.examples.map(t => {
    object(t, ['timeSeconds', 'gapSeconds', 'alliedDeathsAtPriorTime']);
    const timeSeconds = number(t.timeSeconds, duration, 0, false);
    const gapSeconds = number(t.gapSeconds, 5, Number.MIN_VALUE, false);
    if (gapSeconds > timeSeconds) fail();
    return { timeSeconds, gapSeconds, alliedDeathsAtPriorTime: number(t.alliedDeathsAtPriorTime, 16, 1) };
  }), omittedExamples: value.omittedExamples };
}
function round(value) {
  object(value, ['evidenceId', 'round', 'selectionReason', 'side', 'result', 'durationSeconds', 'survivalSeconds',
    'kills', 'killsAfterDeath', 'initialAlive', 'opening', 'death', 'tradesMade', 'tradesReceived', 'alone']);
  const no = number(value.round, 64, 1), duration = number(value.durationSeconds, 3600, 0.1, false);
  if (value.evidenceId !== `round-${no}`) fail();
  object(value.initialAlive, ['own', 'enemy']);
  const initialAlive = { own: number(value.initialAlive.own, 16, 1), enemy: number(value.initialAlive.enemy, 16, 1) };
  const timestamp = time => number(time, duration + 0.1, 0, false);
  const kills = number(value.kills, initialAlive.enemy), killsAfterDeath = number(value.killsAfterDeath, kills);
  let opening = null, death = null, alone = null;
  if (value.opening !== null) {
    object(value.opening, ['timeSeconds', 'selectedKill', 'selectedDeath', 'simultaneous']);
    opening = { timeSeconds: timestamp(value.opening.timeSeconds), selectedKill: boolean(value.opening.selectedKill),
      selectedDeath: boolean(value.opening.selectedDeath), simultaneous: boolean(value.opening.simultaneous) };
    if (!opening.selectedKill && !opening.selectedDeath) fail();
    if (opening.selectedKill && !kills) fail();
  }
  if (value.death !== null) {
    object(value.death, ['timeSeconds', 'ownAlive', 'enemyAlive', 'opening', 'simultaneous']);
    death = { timeSeconds: timestamp(value.death.timeSeconds), ownAlive: number(value.death.ownAlive, initialAlive.own, 1),
      enemyAlive: number(value.death.enemyAlive, initialAlive.enemy), opening: boolean(value.death.opening), simultaneous: boolean(value.death.simultaneous) };
    if (value.survivalSeconds !== death.timeSeconds) fail();
  } else if (killsAfterDeath || value.survivalSeconds !== duration) fail();
  if (Boolean(opening?.selectedDeath) !== Boolean(death?.opening)
    || (death?.opening && opening.timeSeconds !== death.timeSeconds)) fail();
  if (value.alone !== null) {
    object(value.alone, ['timeSeconds', 'opponentsAlive']);
    alone = { timeSeconds: timestamp(value.alone.timeSeconds), opponentsAlive: number(value.alone.opponentsAlive, initialAlive.enemy, 2) };
    if (death && alone.timeSeconds > death.timeSeconds) fail();
  }
  return { evidenceId: value.evidenceId, round: no,
    selectionReason: choice(value.selectionReason, ['opening_death', 'trade_made_candidate', 'trade_received_candidate', 'outnumbered_solo', 'recorded_kills', 'opening_kill', 'coverage']),
    side: choice(value.side, ['attack', 'defense']), result: choice(value.result, ['win', 'loss']),
    durationSeconds: duration, survivalSeconds: timestamp(value.survivalSeconds), kills, killsAfterDeath, initialAlive, opening, death,
    tradesMade: trades(value.tradesMade, duration + 0.1, kills), tradesReceived: trades(value.tradesReceived, duration + 0.1, death ? 1 : 0), alone };
}

// Structural/range consistency only; a summary cannot authenticate the source replay.
function normalizeCoachingEvidence(value) {
  object(value, ['schemaVersion', 'status', 'scope', 'coverage', 'rules', 'metrics', 'detailSelection', 'rounds', 'limitations']);
  if (value.schemaVersion !== 1 || value.scope !== 'selected_player_verified_rounds') fail();
  object(value.coverage, ['totalRounds', 'verifiedRounds', 'excludedRounds', 'excluded']);
  const total = number(value.coverage.totalRounds, 64), verified = number(value.coverage.verifiedRounds, total);
  const excludedRounds = total - verified;
  if (value.coverage.excludedRounds !== excludedRounds || value.status !== (!verified ? 'insufficient_data' : excludedRounds ? 'partial' : 'ready')) fail();
  const excluded = value.coverage.excluded;
  object(excluded, ['incompleteContext', 'invalidRoundNumber', 'duplicateRoundNumber']);
  const safeExcluded = Object.fromEntries(Object.keys(excluded).sort().map(k => [k, number(excluded[k], excludedRounds)]));
  if (Object.values(safeExcluded).reduce((a, b) => a + b, 0) !== excludedRounds) fail();
  object(value.rules, ['tradeWindowSeconds', 'timeUnit', 'aliveCountsIncludeSelectedPlayer', 'simultaneousEventsAreUnordered']);
  if (value.rules.tradeWindowSeconds !== 5 || value.rules.timeUnit !== 'seconds_from_round_start'
    || value.rules.aliveCountsIncludeSelectedPlayer !== true || value.rules.simultaneousEventsAreUnordered !== true) fail();
  const metricKeys = ['evidenceId', 'rounds', 'kills', 'killsAfterDeath', 'deaths', 'survivedRounds', 'wonRounds', 'averageSurvivalSeconds',
    'openingKills', 'openingDeaths', 'tradeCandidatesMade', 'tradeCandidatesReceived', 'outnumberedSoloRounds'];
  let metrics = null;
  if (verified) {
    object(value.metrics, metricKeys);
    const m = value.metrics;
    if (m.evidenceId !== 'verified-rounds' || m.rounds !== verified) fail();
    metrics = { evidenceId: 'verified-rounds', rounds: verified, kills: number(m.kills, verified * 16),
      killsAfterDeath: number(m.killsAfterDeath, m.kills), deaths: number(m.deaths, verified),
      survivedRounds: number(m.survivedRounds, verified), wonRounds: number(m.wonRounds, verified),
      averageSurvivalSeconds: number(m.averageSurvivalSeconds, 3600.1, 0, false),
      openingKills: number(m.openingKills, Math.min(m.kills, verified)), openingDeaths: number(m.openingDeaths, m.deaths),
      tradeCandidatesMade: number(m.tradeCandidatesMade, m.kills), tradeCandidatesReceived: number(m.tradeCandidatesReceived, m.deaths),
      outnumberedSoloRounds: number(m.outnumberedSoloRounds, verified) };
    if (metrics.survivedRounds + metrics.deaths !== verified) fail();
  } else if (value.metrics !== null) fail();
  if (!Array.isArray(value.rounds) || value.rounds.length !== Math.min(verified, 6)) fail();
  const rounds = value.rounds.map(round).sort((a, b) => a.round - b.round);
  if (new Set(rounds.map(r => r.round)).size !== rounds.length) fail();
  object(value.detailSelection, ['method', 'maxRounds', 'includedRounds', 'omittedVerifiedRounds', 'maxTradeExamplesPerDirection']);
  if (value.detailSelection.method !== 'review_diversity_v1' || value.detailSelection.maxRounds !== 6
    || value.detailSelection.includedRounds !== rounds.length || value.detailSelection.omittedVerifiedRounds !== verified - rounds.length
    || value.detailSelection.maxTradeExamplesPerDirection !== 2) fail();
  if (!Array.isArray(value.limitations) || value.limitations.length > 8 || value.limitations.some(s => typeof s !== 'string' || s.length > 200)) fail();
  if (metrics) {
    const sample = { kills: r => r.kills, killsAfterDeath: r => r.killsAfterDeath, deaths: r => Number(Boolean(r.death)),
      survivedRounds: r => Number(!r.death), wonRounds: r => Number(r.result === 'win'), openingKills: r => Number(Boolean(r.opening?.selectedKill)),
      openingDeaths: r => Number(Boolean(r.opening?.selectedDeath)), tradeCandidatesMade: r => r.tradesMade.count,
      tradeCandidatesReceived: r => r.tradesReceived.count, outnumberedSoloRounds: r => Number(Boolean(r.alone)) };
    for (const [key, get] of Object.entries(sample)) {
      const sum = rounds.reduce((n, r) => n + get(r), 0);
      if (sum > metrics[key] || (rounds.length === verified && sum !== metrics[key])) fail();
    }
    if (rounds.length === verified && Math.abs(rounds.reduce((n, r) => n + r.survivalSeconds, 0) / verified - metrics.averageSurvivalSeconds) > 0.051) fail();
  }
  return { schemaVersion: 1, status: value.status, scope: value.scope,
    coverage: { totalRounds: total, verifiedRounds: verified, excludedRounds, excluded: safeExcluded },
    rules: { tradeWindowSeconds: 5, timeUnit: 'seconds_from_round_start', aliveCountsIncludeSelectedPlayer: true, simultaneousEventsAreUnordered: true },
    metrics, detailSelection: { method: 'review_diversity_v1', maxRounds: 6, includedRounds: rounds.length,
      omittedVerifiedRounds: verified - rounds.length, maxTradeExamplesPerDirection: 2 }, rounds,
    // Client prose is never forwarded as instructions.
    limitations: ['Summary consistency is checked, not source replay authenticity.', 'No inference of intent, visibility, blame or long-term skill.'] };
}
module.exports = { normalizeCoachingEvidence };
