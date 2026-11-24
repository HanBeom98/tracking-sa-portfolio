// Ranked rule supplied by the operator: each half is first to three. End
// early when the trailing team cannot even tie the aggregate score; a tied
// second half leads to one golden round. This is NOT a fitted probability.
export const createMatchWinState = () => ({ phase: 'first', score: [0, 0], half: [0, 0], winner: null });

export function advanceMatchWinState(state, winner) {
  if (!state || state.phase === 'finished' || ![0, 1].includes(winner)) return null;
  const next = { ...state, score: [...state.score], half: [...state.half] };
  next.score[winner]++;
  next.half[winner]++;
  const finish = side => ({ ...next, phase: 'finished', winner: side });
  if (state.phase === 'golden') return finish(winner);
  if (state.phase === 'first') {
    if (next.half[winner] === 3) { next.phase = 'second'; next.half = [0, 0]; }
    return next;
  }
  // A side may still reach three wins in this half, irrespective of losses.
  if (next.score[0] > next.score[1] + 3 - next.half[1]) return finish(0);
  if (next.score[1] > next.score[0] + 3 - next.half[0]) return finish(1);
  if (next.half[winner] === 3) {
    if (next.score[0] !== next.score[1]) return finish(next.score[0] > next.score[1] ? 0 : 1);
    next.phase = 'golden'; next.half = [0, 0];
  }
  return next;
}

const fairCache = new Map();
function fairChance(state) {
  if (state.phase === 'finished') return state.winner === 0 ? 1 : 0;
  const key = `${state.phase}:${state.score}:${state.half}`;
  if (!fairCache.has(key)) fairCache.set(key,
    (fairChance(advanceMatchWinState(state, 0)) + fairChance(advanceMatchWinState(state, 1))) / 2);
  return fairCache.get(key);
}

// Only the in-progress round uses the caller's transparent state heuristic.
// All subsequent rounds, including golden round, assume equally strong teams.
export function estimateMatchWinChance(state, currentRoundChance = 0.5) {
  if (!state || !Number.isFinite(currentRoundChance) || currentRoundChance < 0 || currentRoundChance > 1) return null;
  if (state.phase === 'finished') return state.winner === 0 ? 100 : 0;
  return 100 * (currentRoundChance * fairChance(advanceMatchWinState(state, 0))
    + (1 - currentRoundChance) * fairChance(advanceMatchWinState(state, 1)));
}

export function estimateCurrentRoundChance(alive, initial, bomb, offense) {
  if (![alive, initial].every(pair => Array.isArray(pair) && pair.length === 2
    && pair.every(n => Number.isFinite(n) && n >= 0)) || !Math.max(...initial) || ![0, 1].includes(offense)) return null;
  // These weights express a heuristic, not learned odds. Do not interpret a
  // dead attack side as a lost round while its planted C4 can still explode.
  const value = 50 + 40 * (alive[0] - alive[1]) / Math.max(...initial)
    + (bomb === 'planted' ? (offense === 0 ? 10 : -10) : 0);
  return Math.max(5, Math.min(95, value)) / 100;
}
