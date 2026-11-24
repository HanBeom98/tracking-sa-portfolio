import { TRADE_WINDOW_SECONDS } from './replay-context.js';

export const REPLAY_COACHING_SCHEMA_VERSION = 1;
export const REPLAY_COACHING_MAX_ROUNDS = 6;
const MAX_TRADE_EXAMPLES = 2;
const list = value => Array.isArray(value) ? value : [];
const tenth = value => Number(value.toFixed(1));

function tradeEvidence(trades) {
  const examples = trades.map(trade => ({
    timeSeconds: trade.timeSeconds,
    gapSeconds: trade.gapSeconds,
    alliedDeathsAtPriorTime: trade.teammateIds.length,
  })).sort((a, b) => a.timeSeconds - b.timeSeconds || a.gapSeconds - b.gapSeconds
    || a.alliedDeathsAtPriorTime - b.alliedDeathsAtPriorTime);
  return { count: examples.length, examples: examples.slice(0, MAX_TRADE_EXAMPLES),
    omittedExamples: Math.max(0, examples.length - MAX_TRADE_EXAMPLES) };
}

function roundEvidence(round, selectionReason) {
  const c = round.context;
  const opening = c.opening;
  return {
    evidenceId: `round-${round.round}`,
    round: round.round,
    selectionReason,
    side: round.offense ? 'attack' : 'defense',
    result: round.won ? 'win' : 'loss',
    durationSeconds: round.playTimeSeconds,
    survivalSeconds: c.death?.timeSeconds ?? round.playTimeSeconds,
    kills: round.kills.length,
    killsAfterDeath: c.death ? round.kills.filter(k => k.timeSeconds > c.death.timeSeconds).length : 0,
    initialAlive: { own: c.initial.own, enemy: c.initial.enemy },
    opening: opening && (opening.selectedKill || opening.selectedDeath) ? {
      timeSeconds: opening.timeSeconds, selectedKill: opening.selectedKill,
      selectedDeath: opening.selectedDeath, simultaneous: opening.simultaneous,
    } : null,
    death: c.death ? { timeSeconds: c.death.timeSeconds, ownAlive: c.death.own,
      enemyAlive: c.death.enemy, opening: c.death.opening, simultaneous: c.death.simultaneous } : null,
    tradesMade: tradeEvidence(c.tradesMade),
    tradesReceived: tradeEvidence(c.tradesReceived),
    alone: c.alone ? { timeSeconds: c.alone.timeSeconds, opponentsAlive: c.alone.opponentAlive } : null,
  };
}

// Choose diverse review examples, not a representative sample for computing rates.
function selectRounds(rounds) {
  const selected = new Map();
  const pick = (candidates, reason) => {
    const round = candidates.find(r => !selected.has(r.round));
    if (round && selected.size < REPLAY_COACHING_MAX_ROUNDS) selected.set(round.round, { round, reason });
  };
  pick(rounds.filter(r => r.context.opening?.selectedDeath), 'opening_death');
  pick(rounds.filter(r => r.context.tradesMade.length), 'trade_made_candidate');
  pick(rounds.filter(r => r.context.tradesReceived.length), 'trade_received_candidate');
  pick(rounds.filter(r => r.context.alone).sort((a, b) =>
    b.context.alone.opponentAlive - a.context.alone.opponentAlive || a.round - b.round), 'outnumbered_solo');
  pick(rounds.filter(r => r.kills.length).sort((a, b) => b.kills.length - a.kills.length || a.round - b.round), 'recorded_kills');
  pick(rounds.filter(r => r.context.opening?.selectedKill), 'opening_kill');
  for (const round of [...rounds].sort((a, b) => Number(Boolean(b.context.death)) - Number(Boolean(a.context.death))
    || b.kills.length - a.kills.length || a.round - b.round)) pick([round], 'coverage');
  return [...selected.values()].sort((a, b) => a.round.round - b.round.round)
    .map(({ round, reason }) => roundEvidence(round, reason));
}

function aggregate(rounds) {
  if (!rounds.length) return null;
  const sum = get => rounds.reduce((total, round) => total + get(round), 0);
  const averageSurvival = rounds.reduce((mean, r, index) =>
    mean + ((r.context.death?.timeSeconds ?? r.playTimeSeconds) - mean) / (index + 1), 0);
  return {
    evidenceId: 'verified-rounds',
    rounds: rounds.length,
    kills: sum(r => r.kills.length),
    killsAfterDeath: sum(r => r.context.death ? r.kills.filter(k => k.timeSeconds > r.context.death.timeSeconds).length : 0),
    deaths: sum(r => Number(Boolean(r.context.death))),
    survivedRounds: sum(r => Number(!r.context.death)),
    wonRounds: sum(r => Number(r.won)),
    averageSurvivalSeconds: tenth(averageSurvival),
    openingKills: sum(r => Number(Boolean(r.context.opening?.selectedKill))),
    openingDeaths: sum(r => Number(Boolean(r.context.opening?.selectedDeath))),
    tradeCandidatesMade: sum(r => r.context.tradesMade.length),
    tradeCandidatesReceived: sum(r => r.context.tradesReceived.length),
    outnumberedSoloRounds: sum(r => Number(Boolean(r.context.alone))),
  };
}

// Consumes analyzeReplay's validated round contexts. Explicit projection keeps
// names, account/match IDs, free text, positions and raw timelines out of the input.
// This function neither calls a model nor stores/transmits its result.
export function buildReplayCoachingEvidence(analysis) {
  const rounds = list(analysis?.rounds);
  const frequencies = new Map();
  for (const r of rounds) frequencies.set(r.round, (frequencies.get(r.round) || 0) + 1);
  const excluded = { incompleteContext: 0, invalidRoundNumber: 0, duplicateRoundNumber: 0 };
  const verified = rounds.filter(r => {
    if (r.context?.status !== 'complete') { excluded.incompleteContext++; return false; }
    if (!Number.isSafeInteger(r.round) || r.round < 1) { excluded.invalidRoundNumber++; return false; }
    if (frequencies.get(r.round) > 1) { excluded.duplicateRoundNumber++; return false; }
    return true;
  }).sort((a, b) => a.round - b.round);
  const details = selectRounds(verified);
  return {
    schemaVersion: REPLAY_COACHING_SCHEMA_VERSION,
    status: !verified.length ? 'insufficient_data' : verified.length === rounds.length ? 'ready' : 'partial',
    scope: 'selected_player_verified_rounds',
    coverage: { totalRounds: rounds.length, verifiedRounds: verified.length,
      excludedRounds: rounds.length - verified.length, excluded },
    rules: { tradeWindowSeconds: TRADE_WINDOW_SECONDS, timeUnit: 'seconds_from_round_start',
      aliveCountsIncludeSelectedPlayer: true, simultaneousEventsAreUnordered: true },
    metrics: aggregate(verified),
    detailSelection: { method: 'review_diversity_v1', maxRounds: REPLAY_COACHING_MAX_ROUNDS,
      includedRounds: details.length, omittedVerifiedRounds: verified.length - details.length,
      maxTradeExamplesPerDirection: MAX_TRADE_EXAMPLES },
    rounds: details,
    limitations: [
      'Metrics cover all verified rounds; details are a selected subset, not a sample for rates.',
      'Excluded rounds are unknown, not zero. No verified rounds means null metrics.',
      'Trade candidates do not prove line of sight, distance or intentional cover.',
      'No inference about intent, voice communication, map routes, bomb actions or blame.',
      'Kills can include posthumous events. Survival alone does not measure skill.',
      'Only this replay is covered; do not generalize to long-term player skill.',
    ],
  };
}
