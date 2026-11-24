// Paid-coaching preparation v2. Only trusted local analyzer output is accepted;
// this is not an HTTP input validator and is not wired to a model or free UI.
export const REVIEW_LIMITS = Object.freeze({ maxCandidates: 6, beforeEvents: 2, afterEvents: 4 });
const REASONS = Object.freeze({
  advantage_loss: '사망 직전 인원 우세와 이후 팀 패배를 나눠 확인할 장면입니다. 패배 원인을 뜻하지 않습니다.',
  opening_death: '첫 처치 사건 시각에 본인 사망이 포함된 장면입니다.',
  outnumbered_solo: '단독 생존이 시작된 시점과 이후 인원 변화를 확인할 장면입니다.',
  trade_received: '본인 사망 뒤 팀원의 후속 처치 후보와 이후 흐름을 확인할 장면입니다.',
  trade_made: '아군 사망 뒤 본인의 후속 처치 후보와 이후 흐름을 확인할 장면입니다.',
  opening_kill: '첫 처치 기록과 이후 개인 생존·팀 결과를 나눠 확인할 장면입니다.',
  advantage_death: '인원 우세 중 본인 사망과 이후 팀 결과를 구분해 확인할 장면입니다.',
  death: '본인 사망 전후의 인원 변화를 확인할 장면입니다.',
  recorded_kill: '본인의 처치 기록 전후를 확인할 장면입니다.',
  round_result: '기록된 인원 변화와 팀 종료 결과를 구분해 확인할 장면입니다.',
});
const order = Object.keys(REASONS);
const list = v => Array.isArray(v) ? v : [];
const count = v => Number.isSafeInteger(v) && v >= 0 && v <= 16;
const pair = v => v && count(v.own) && count(v.enemy);
const copy = v => ({ own: v.own, enemy: v.enemy });
const equal = (a, b) => a.own === b.own && a.enemy === b.enemy;
const tenth = v => Number(v.toFixed(1));
const freeze = v => { if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v); } return v; };

function supported(round) {
  const c = round.context;
  if (!pair(c.initial) || !c.initial.own || !c.initial.enemy || typeof round.won !== 'boolean'
    || typeof round.offense !== 'boolean' || !Number.isFinite(round.playTimeSeconds) || round.playTimeSeconds <= 0
    || !Array.isArray(c.transitions) || !Array.isArray(c.tradesMade) || !Array.isArray(c.tradesReceived)
    || !Array.isArray(round.kills)) return false;
  let before = c.initial, at = -1;
  for (const e of c.transitions) {
    if (!Number.isFinite(e.timeSeconds) || e.timeSeconds < 0 || e.timeSeconds > round.playTimeSeconds + 0.1
      || e.timeSeconds <= at || !pair(e.before) || !pair(e.after) || !equal(e.before, before)
      || e.after.own > e.before.own || e.after.enemy > e.before.enemy
      || e.after.own + e.after.enemy >= e.before.own + e.before.enemy
      || e.simultaneous !== (e.before.own + e.before.enemy - e.after.own - e.after.enemy > 1)) return false;
    before = e.after; at = e.timeSeconds;
  }
  if (c.death) {
    const e = c.transitions.find(e => e.timeSeconds === c.death.timeSeconds);
    if (!e || e.before.own !== c.death.own || e.before.enemy !== c.death.enemy
      || e.after.own >= e.before.own || e.simultaneous !== c.death.simultaneous) return false;
  }
  const eventTime = t => Number.isFinite(t) && t >= 0 && t <= round.playTimeSeconds + 0.1
    && c.transitions.some(e => e.timeSeconds === t);
  if (!round.kills.every(k => eventTime(k.timeSeconds))) return false;
  if (c.opening && (!eventTime(c.opening.timeSeconds) || c.opening.timeSeconds !== c.transitions[0]?.timeSeconds)) return false;
  if (c.alone && !(c.alone.timeSeconds === 0 && c.initial.own === 1 && c.initial.enemy >= 2)
    && !c.transitions.some(e => e.timeSeconds === c.alone.timeSeconds && e.after.own === 1 && e.after.enemy === c.alone.opponentAlive)) return false;
  return [...c.tradesMade, ...c.tradesReceived].every(t => eventTime(t.timeSeconds)
    && Number.isFinite(t.gapSeconds) && t.gapSeconds > 0 && t.gapSeconds <= 5);
}

function signals(round) {
  const c = round.context, found = [];
  const add = (code, timeSeconds) => found.push({ code, timeSeconds });
  if (c.death && c.death.own > c.death.enemy && !round.won) add('advantage_loss', c.death.timeSeconds);
  if (c.opening?.selectedDeath) add('opening_death', c.opening.timeSeconds);
  if (c.alone) add('outnumbered_solo', c.alone.timeSeconds);
  if (c.tradesReceived.length) add('trade_received', c.tradesReceived[0].timeSeconds);
  if (c.tradesMade.length) add('trade_made', c.tradesMade[0].timeSeconds);
  if (c.opening?.selectedKill) add('opening_kill', c.opening.timeSeconds);
  if (c.death && c.death.own > c.death.enemy) add('advantage_death', c.death.timeSeconds);
  if (c.death) add('death', c.death.timeSeconds);
  const livingKills = round.kills.filter(k => !c.death || k.timeSeconds <= c.death.timeSeconds);
  if (livingKills.length) add('recorded_kill', livingKills[0].timeSeconds);
  if (!found.length) add('round_result', round.playTimeSeconds);
  return found;
}

function flow(round, timeSeconds) {
  const c = round.context, events = c.transitions;
  const index = events.findIndex(e => e.timeSeconds >= timeSeconds);
  const exact = index >= 0 && events[index].timeSeconds === timeSeconds;
  const previousIndex = index < 0 ? events.length - 1 : index - 1;
  const previous = events[previousIndex], anchor = exact ? events[index] : null;
  const before = anchor?.before ?? previous?.after ?? c.initial;
  const nextIndex = exact ? index + 1 : previousIndex + 1;
  const next = events[nextIndex];
  const from = Math.max(0, previousIndex - REVIEW_LIMITS.beforeEvents + 1);
  const to = Math.min(events.length, nextIndex + REVIEW_LIMITS.afterEvents);
  const aliveBefore = t => !c.death || t <= c.death.timeSeconds;
  const aliveAfter = t => !c.death || t < c.death.timeSeconds;
  return {
    initialAlive: copy(c.initial),
    anchor: { timeSeconds, before: copy(before), after: copy(anchor?.after ?? before),
      simultaneous: anchor?.simultaneous ?? false, selectedAliveBefore: aliveBefore(timeSeconds), selectedAliveAfter: aliveAfter(timeSeconds),
      beforeStateSinceSeconds: previous?.timeSeconds ?? 0,
      sincePreviousEliminationSeconds: previous ? tenth(timeSeconds - previous.timeSeconds) : null,
      untilNextEliminationSeconds: next ? tenth(next.timeSeconds - timeSeconds) : null },
    events: events.slice(from, to).map(e => ({ timeSeconds: e.timeSeconds, before: copy(e.before), after: copy(e.after),
      phase: e.timeSeconds < timeSeconds ? 'before' : e.timeSeconds === timeSeconds ? 'anchor' : 'after',
      simultaneous: e.simultaneous, selectedDeath: c.death?.timeSeconds === e.timeSeconds,
      selectedKills: round.kills.filter(k => k.timeSeconds === e.timeSeconds).length,
      selectedAliveBefore: aliveBefore(e.timeSeconds), selectedAliveAfter: aliveAfter(e.timeSeconds) })),
    omittedEarlierEvents: from, omittedLaterEvents: events.length - to,
    outcome: { result: round.won ? 'win' : 'loss', durationSeconds: round.playTimeSeconds,
      lastRecordedAlive: copy(events.at(-1)?.after ?? c.initial) },
  };
}

export function buildReplayCoachingReview(analysis) {
  const rounds = list(analysis?.rounds), frequency = new Map();
  for (const r of rounds) frequency.set(r.round, (frequency.get(r.round) ?? 0) + 1);
  const excluded = { incompleteContext: 0, invalidRoundNumber: 0, duplicateRoundNumber: 0, unsupportedContext: 0 };
  const verified = rounds.filter(r => {
    if (r.context?.status !== 'complete') { excluded.incompleteContext++; return false; }
    if (!Number.isSafeInteger(r.round) || r.round < 1) { excluded.invalidRoundNumber++; return false; }
    if (frequency.get(r.round) > 1) { excluded.duplicateRoundNumber++; return false; }
    if (!supported(r)) { excluded.unsupportedContext++; return false; }
    return true;
  });
  const candidates = verified.map(round => ({ round, signals: signals(round) }));
  const patterns = new Map(order.map(code => [code, candidates.filter(c => c.signals.some(s => s.code === code)).length]));
  const repeated = c => c.signals.filter(s => !['death', 'recorded_kill', 'round_result'].includes(s.code) && patterns.get(s.code) > 1).map(s => s.code);
  const compare = (a, b) => order.indexOf(a.signals[0].code) - order.indexOf(b.signals[0].code)
    || repeated(b).length - repeated(a).length
    || Number(Boolean(a.round.context.transitions.find(e => e.timeSeconds === a.signals[0].timeSeconds)?.simultaneous))
      - Number(Boolean(b.round.context.transitions.find(e => e.timeSeconds === b.signals[0].timeSeconds)?.simultaneous))
    || a.round.round - b.round.round;
  candidates.sort(compare);
  const chosen = [], reasons = new Set();
  for (const c of candidates) if (!reasons.has(c.signals[0].code) && chosen.length < REVIEW_LIMITS.maxCandidates) {
    chosen.push(c); reasons.add(c.signals[0].code);
  }
  for (const c of candidates) if (!chosen.includes(c) && chosen.length < REVIEW_LIMITS.maxCandidates) chosen.push(c);
  chosen.sort(compare);
  return freeze({ schemaVersion: 2, scope: 'selected_player_review_candidates',
    status: !verified.length ? 'insufficient_data' : verified.length === rounds.length ? 'ready' : 'partial',
    coverage: { totalRounds: rounds.length, verifiedRounds: verified.length, excludedRounds: rounds.length - verified.length, excluded },
    selection: { method: 'priority_then_reason_diversity_v2', maxCandidates: REVIEW_LIMITS.maxCandidates,
      includedRounds: chosen.length, omittedVerifiedRounds: verified.length - chosen.length,
      maxEventsPerCandidate: REVIEW_LIMITS.beforeEvents + 1 + REVIEW_LIMITS.afterEvents },
    patterns: verified.length ? order.filter(code => patterns.get(code)).map(code => ({ code, verifiedRounds: patterns.get(code) })) : null,
    candidates: chosen.map(({ round, signals: matches }, i) => ({ candidateId: `review2_r${round.round}`, evidenceId: `round-${round.round}`,
      rank: i + 1, round: round.round, side: round.offense ? 'attack' : 'defense',
      basis: { primaryReason: matches[0].code, explanation: REASONS[matches[0].code],
        matchingVerifiedRounds: patterns.get(matches[0].code), matchedReasons: matches.map(s => s.code),
        repeatedReasons: repeated({ signals: matches }) },
      flow: flow(round, matches[0].timeSeconds) })),
    limitations: ['Priority is a review rule, not a skill score, win probability or proof of a mistake.',
      'Same-time events are grouped without internal ordering. Windows may omit events; counts include the selected player only while alive.',
      'Team result is recorded separately; no cause, line of sight, intention, bomb action or blame is inferred.',
      'Only verified rounds of this replay are counted. Excluded rounds are unknown, not zero.',
      'Local preparation only: not accepted by the current AI API, not a user entitlement or a stored AI result.'],
  });
}
