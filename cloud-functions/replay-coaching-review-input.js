// Versioned boundary for untrusted review-v2 summaries. This checks internal
// consistency, not authenticity against Nexon's original replay or player ID.
const fail = () => { throw Object.assign(new Error('INVALID_EVIDENCE'), { code: 'INVALID_EVIDENCE', status: 400 }); };
const exact = (v, keys) => v && typeof v === 'object' && !Array.isArray(v)
  && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const uint = (v, max = 64) => Number.isSafeInteger(v) && v >= 0 && v <= max;
const time = v => Number.isFinite(v) && v >= 0 && v <= 3600.1;
const bool = v => typeof v === 'boolean';
const pair = v => exact(v, ['own', 'enemy']) && uint(v.own, 16) && uint(v.enemy, 16);
const same = (a, b) => a.own === b.own && a.enemy === b.enemy;
const within = (a, b) => a.own <= b.own && a.enemy <= b.enemy;
const delta = (a, b) => Number((a - b).toFixed(1));
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
const codes = Object.keys(REASONS);
const reasons = v => Array.isArray(v) && v.length > 0 && v.length <= codes.length
  && new Set(v).size === v.length && v.every(c => codes.includes(c))
  && v.every((c, i) => !i || codes.indexOf(v[i - 1]) < codes.indexOf(c));
const LIMITATIONS = Object.freeze([
  'Summary consistency is checked; original replay authenticity is not established.',
  'Same-time eliminations have no internal order. Omitted events are disclosed.',
  'No cause, visibility, intention, blame or successful practice execution is inferred.',
]);

function normalizeFlow(f, primary) {
  if (!exact(f, ['initialAlive', 'anchor', 'events', 'omittedEarlierEvents', 'omittedLaterEvents', 'outcome'])
    || !pair(f.initialAlive) || !f.initialAlive.own || !f.initialAlive.enemy
    || !uint(f.omittedEarlierEvents, 32) || !uint(f.omittedLaterEvents, 32)
    || !Array.isArray(f.events) || f.events.length > 7
    || f.events.length + f.omittedEarlierEvents + f.omittedLaterEvents > 32) fail();
  const a = f.anchor, o = f.outcome;
  if (!exact(a, ['timeSeconds', 'before', 'after', 'simultaneous', 'selectedAliveBefore', 'selectedAliveAfter',
    'beforeStateSinceSeconds', 'sincePreviousEliminationSeconds', 'untilNextEliminationSeconds'])
    || !exact(o, ['result', 'durationSeconds', 'lastRecordedAlive'])
    || !['win', 'loss'].includes(o.result) || !time(o.durationSeconds) || o.durationSeconds <= 0 || !pair(o.lastRecordedAlive)
    || !time(a.timeSeconds) || a.timeSeconds > o.durationSeconds + 0.1 || !pair(a.before) || !pair(a.after)
    || !bool(a.simultaneous) || !bool(a.selectedAliveBefore) || !bool(a.selectedAliveAfter)
    || !time(a.beforeStateSinceSeconds) || a.beforeStateSinceSeconds > a.timeSeconds
    || ![a.sincePreviousEliminationSeconds, a.untilNextEliminationSeconds].every(v => v === null || time(v))) fail();
  let previous = null;
  for (const e of f.events) {
    if (!exact(e, ['timeSeconds', 'before', 'after', 'phase', 'simultaneous', 'selectedDeath', 'selectedKills', 'selectedAliveBefore', 'selectedAliveAfter'])
      || !time(e.timeSeconds) || e.timeSeconds > o.durationSeconds + 0.1 || !pair(e.before) || !pair(e.after)
      || !within(e.before, f.initialAlive) || !within(e.after, e.before)
      || e.before.own + e.before.enemy <= e.after.own + e.after.enemy
      || !bool(e.simultaneous) || e.simultaneous !== (e.before.own + e.before.enemy - e.after.own - e.after.enemy > 1)
      || !bool(e.selectedDeath) || !bool(e.selectedAliveBefore) || !bool(e.selectedAliveAfter)
      || !uint(e.selectedKills, 16) || e.selectedKills > e.before.enemy - e.after.enemy
      || (e.selectedAliveBefore && !e.before.own) || (e.selectedAliveAfter && !e.after.own)
      || (!e.selectedAliveBefore && e.selectedAliveAfter)
      || e.selectedDeath !== (e.selectedAliveBefore && !e.selectedAliveAfter)
      || (e.selectedDeath && e.after.own >= e.before.own)
      || e.phase !== (e.timeSeconds < a.timeSeconds ? 'before' : e.timeSeconds === a.timeSeconds ? 'anchor' : 'after')
      || (previous && (e.timeSeconds <= previous.timeSeconds || !same(e.before, previous.after)
        || e.selectedAliveBefore !== previous.selectedAliveAfter))) fail();
    previous = e;
  }
  const first = f.events[0], last = f.events.at(-1);
  if (first && !f.omittedEarlierEvents && (!same(first.before, f.initialAlive) || !first.selectedAliveBefore)) fail();
  if (first && f.initialAlive.own + f.initialAlive.enemy - first.before.own - first.before.enemy < f.omittedEarlierEvents) fail();
  if (!first && (f.omittedEarlierEvents || f.omittedLaterEvents)) fail();
  if (!within(o.lastRecordedAlive, last?.after ?? f.initialAlive)
    || (!f.omittedLaterEvents && !same(o.lastRecordedAlive, last?.after ?? f.initialAlive))) fail();
  if (last && last.after.own + last.after.enemy - o.lastRecordedAlive.own - o.lastRecordedAlive.enemy < f.omittedLaterEvents) fail();
  const before = f.events.filter(e => e.phase === 'before'), after = f.events.filter(e => e.phase === 'after');
  const anchor = f.events.find(e => e.phase === 'anchor'), prev = before.at(-1), next = after[0];
  if (before.length > 2 || after.length > 4 || (f.omittedEarlierEvents && before.length !== 2)
    || (f.omittedLaterEvents && after.length !== 4)
    || a.beforeStateSinceSeconds !== (prev?.timeSeconds ?? 0)
    || a.sincePreviousEliminationSeconds !== (prev ? delta(a.timeSeconds, prev.timeSeconds) : null)
    || a.untilNextEliminationSeconds !== (next ? delta(next.timeSeconds, a.timeSeconds) : null)) fail();
  if (anchor) {
    for (const key of ['before', 'after']) if (!same(a[key], anchor[key])) fail();
    for (const key of ['simultaneous', 'selectedAliveBefore', 'selectedAliveAfter']) if (a[key] !== anchor[key]) fail();
  } else {
    if (a.simultaneous || !same(a.before, a.after) || !same(a.before, prev?.after ?? f.initialAlive)
      || a.selectedAliveBefore !== a.selectedAliveAfter
      || a.selectedAliveBefore !== (prev?.selectedAliveAfter ?? true)
      || !((primary === 'outnumbered_solo' && a.timeSeconds === 0)
        || (primary === 'round_result' && a.timeSeconds === o.durationSeconds))) fail();
  }
  if (primary === 'advantage_loss' && (!anchor?.selectedDeath || a.before.own <= a.before.enemy || o.result !== 'loss')) fail();
  if (primary === 'advantage_death' && (!anchor?.selectedDeath || a.before.own <= a.before.enemy)) fail();
  if (primary === 'death' && !anchor?.selectedDeath) fail();
  if (['opening_death', 'opening_kill'].includes(primary) && (before.length || f.omittedEarlierEvents
    || !(primary === 'opening_death' ? anchor?.selectedDeath : anchor?.selectedKills && anchor.selectedAliveBefore))) fail();
  if (primary === 'recorded_kill' && (!anchor?.selectedKills || !anchor.selectedAliveBefore)) fail();
  if (primary === 'outnumbered_solo' && (!a.selectedAliveAfter || a.after.own !== 1 || a.after.enemy < 2)) fail();
  // Trade actor/victim links are not present in this compact contract. Never
  // promote a client trade reason into a server claim of a verified trade.
  return JSON.parse(JSON.stringify(f));
}

function normalizeReviewEvidence(v) {
  if (!exact(v, ['schemaVersion', 'scope', 'status', 'coverage', 'selection', 'patterns', 'candidates', 'limitations'])
    || v.schemaVersion !== 2 || v.scope !== 'selected_player_review_candidates') fail();
  const c = v.coverage, s = v.selection;
  if (!exact(c, ['totalRounds', 'verifiedRounds', 'excludedRounds', 'excluded'])
    || ![c.totalRounds, c.verifiedRounds, c.excludedRounds].every(n => uint(n)) || c.totalRounds !== c.verifiedRounds + c.excludedRounds
    || !exact(c.excluded, ['incompleteContext', 'invalidRoundNumber', 'duplicateRoundNumber', 'unsupportedContext'])
    || !Object.values(c.excluded).every(n => uint(n)) || Object.values(c.excluded).reduce((a, b) => a + b, 0) !== c.excludedRounds
    || v.status !== (!c.verifiedRounds ? 'insufficient_data' : c.excludedRounds ? 'partial' : 'ready')
    || !exact(s, ['method', 'maxCandidates', 'includedRounds', 'omittedVerifiedRounds', 'maxEventsPerCandidate'])
    || s.method !== 'priority_then_reason_diversity_v2' || s.maxCandidates !== 6 || s.maxEventsPerCandidate !== 7
    || s.includedRounds !== Math.min(c.verifiedRounds, 6) || s.omittedVerifiedRounds !== c.verifiedRounds - s.includedRounds
    || !Array.isArray(v.candidates) || v.candidates.length !== s.includedRounds
    || !Array.isArray(v.limitations) || v.limitations.length > 8 || v.limitations.some(t => typeof t !== 'string' || t.length > 300)) fail();
  const patterns = v.patterns;
  if (!c.verifiedRounds ? patterns !== null : !Array.isArray(patterns) || !reasons(patterns.map(p => p?.code))
    || patterns.some(p => !exact(p, ['code', 'verifiedRounds']) || !uint(p.verifiedRounds) || !p.verifiedRounds || p.verifiedRounds > c.verifiedRounds)) fail();
  const frequencies = new Map((patterns ?? []).map(p => [p.code, p.verifiedRounds])), rounds = new Set();
  const candidates = v.candidates.map((r, i) => {
    const b = r?.basis;
    if (!exact(r, ['candidateId', 'evidenceId', 'rank', 'round', 'side', 'basis', 'flow'])
      || !uint(r.round) || r.round < 1 || rounds.has(r.round) || r.candidateId !== `review2_r${r.round}`
      || r.evidenceId !== `round-${r.round}` || r.rank !== i + 1 || !['attack', 'defense'].includes(r.side)
      || !exact(b, ['primaryReason', 'explanation', 'matchingVerifiedRounds', 'matchedReasons', 'repeatedReasons'])
      || !reasons(b.matchedReasons) || b.primaryReason !== b.matchedReasons[0]
      || typeof b.explanation !== 'string' || b.explanation.length > 200
      || b.matchingVerifiedRounds !== frequencies.get(b.primaryReason)
      || b.matchedReasons.some(code => !frequencies.has(code))
      || !Array.isArray(b.repeatedReasons) || JSON.stringify(b.repeatedReasons) !== JSON.stringify(b.matchedReasons.filter(code =>
        !['death', 'recorded_kill', 'round_result'].includes(code) && frequencies.get(code) > 1))) fail();
    rounds.add(r.round);
    return { candidateId: r.candidateId, evidenceId: r.evidenceId, rank: r.rank, round: r.round, side: r.side,
      basis: { primaryReason: b.primaryReason, explanation: REASONS[b.primaryReason], matchingVerifiedRounds: b.matchingVerifiedRounds,
        matchedReasons: [...b.matchedReasons], repeatedReasons: [...b.repeatedReasons] }, flow: normalizeFlow(r.flow, b.primaryReason) };
  });
  for (const [code, n] of frequencies) {
    const selected = candidates.filter(r => r.basis.matchedReasons.includes(code)).length;
    if (selected > n || n > selected + s.omittedVerifiedRounds) fail();
  }
  return { schemaVersion: 2, scope: v.scope, status: v.status, coverage: { ...c, excluded: { ...c.excluded } }, selection: { ...s },
    patterns: patterns?.map(p => ({ ...p })) ?? null, candidates, limitations: [...LIMITATIONS] };
}
module.exports = { normalizeReviewEvidence };
