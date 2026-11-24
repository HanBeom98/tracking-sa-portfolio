const { normalizeReviewEvidence } = require('./replay-coaching-review-input.js');
const { normalizeCoachingSelection } = require('./replay-coaching-facts.js');
const fail = () => { throw Object.assign(new Error('COACHING_SELECTION_NOT_ALLOWED'), { code: 'COACHING_SELECTION_NOT_ALLOWED', status: 422 }); };
// Frozen rflow3/rq3/rp3 semantics. Future wording or rules require new IDs so
// previously saved selections can always render their original response.
const QUESTIONS = Object.freeze({
  rq3_advantage: '우세 중 사망 전후 무엇이 달라졌나요?',
  rq3_outnumbered: '열세에서 교전을 이어갈 여지를 어떻게 확인했나요?',
  rq3_death: '사망 직전 인원과 이후 팀 결과는 어떻게 달랐나요?',
  rq3_solo: '혼자 남았을 때 인원과 선택지를 확인했나요?',
  rq3_opening: '첫 사건 전에 확인할 정보는 무엇이었나요?',
  rq3_flow: '기준 사건 전후 인원과 팀 결과는 어떻게 달랐나요?',
});
const PRACTICES = Object.freeze({
  rp3_advantage: '다음 3라운드 우세 교전 전 인원과 합류 여지를 확인하고, 종료 후 실행 횟수를 세세요.',
  rp3_outnumbered: '다음 3라운드 열세 교전 전 이탈·합류 여지를 확인하고, 종료 후 실행 횟수를 세세요.',
  rp3_death: '다음 3라운드 교전 전 양 팀 인원을 확인하세요. 종료 후 실행 횟수를 세어 보세요.',
  rp3_solo: '다음 3라운드 혼자 남으면 상대 인원부터 확인하세요. 해당 상황이 없으면 평가에서 빼세요.',
  rp3_opening: '다음 3라운드 첫 교전 전 인원과 엄폐를 확인하세요. 종료 후 실행 횟수를 세어 보세요.',
  rp3_flow: '다음 3라운드 교전 전 인원을 확인하세요. 종료 후 개인 기록과 팀 결과를 나눠 복기하세요.',
});
const time = v => v.toFixed(1);
const pair = p => `${p.own}대${p.enemy}`;
const freeze = v => { if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v); } return v; };

function factFor(c) {
  const { anchor: a, events, outcome: o } = c.flow;
  const at = events.find(e => e.phase === 'anchor');
  let type = 'flow';
  if (c.basis.primaryReason === 'outnumbered_solo') type = 'solo';
  else if (['opening_death', 'opening_kill'].includes(c.basis.primaryReason)) type = 'opening';
  else if (at?.selectedDeath) type = a.before.own > a.before.enemy ? 'advantage'
    : a.before.own < a.before.enemy ? 'outnumbered' : 'death';
  const label = at?.selectedDeath ? '본인 사망' : at?.selectedKills ? '본인 처치' : at ? '처치·사망 사건' : '기준 시점';
  // Do not describe an unproven trade actor/victim relationship or next-fight
  // gap. Only fields validated by the v2 count/life-state boundary are facts.
  const observation = `${c.round}라운드 ${time(a.timeSeconds)}초 ${label} ${pair(a.before)}→${pair(a.after)}. 마지막 기록 ${pair(o.lastRecordedAlive)}, 팀 ${o.result === 'win' ? '승리' : '패배'}.${a.simultaneous ? ' 동시 순서 미정.' : ''}`;
  const q = `rq3_${type}`, p = `rp3_${type}`;
  if (observation.length > 100 || `${QUESTIONS[q]}\n${PRACTICES[p]}`.length > 80) throw new Error('REVIEW_CATALOG_INVALID');
  return { id: `rflow3_r${c.round}`, type, topic: ['advantage', 'outnumbered', 'death'].includes(type) ? 'survival' : type,
    title: `${c.round}라운드 사건 전후 복기`, observation,
    reviewReason: at?.selectedDeath && a.before.own > a.before.enemy && o.result === 'loss'
      ? '인원 우세 중 사망과 이후 패배를 나눠 확인합니다. 패배 책임 판정이 아닙니다.' : '기준 시점의 인원 변화와 종료 결과를 구분해 확인합니다.',
    kinds: ['review', 'practice'], questions: [q], practices: [p],
    limitation: '동시 사건의 순서·시야·의도·승패 원인은 확정할 수 없습니다.', evidenceRefs: [c.evidenceId], candidateId: c.candidateId };
}

function createReviewCatalog(rawEvidence) {
  const evidence = normalizeReviewEvidence(rawEvidence), facts = evidence.candidates.map(factFor);
  return freeze({ schemaVersion: 3, coverage: evidence.coverage,
    selection: { method: 'candidate_flow_v3', curation: 'distinct_topic_v3', maxFacts: 6, includedFacts: facts.length,
      omittedVerifiedRounds: evidence.selection.omittedVerifiedRounds }, facts,
    questions: [...new Set(facts.flatMap(f => f.questions))].map(id => ({ id, text: QUESTIONS[id] })),
    practices: [...new Set(facts.flatMap(f => f.practices))].map(id => ({ id, text: PRACTICES[id] })) });
}

function reviewSelectionInput(rawEvidence, catalog = createReviewCatalog(rawEvidence)) {
  const evidence = normalizeReviewEvidence(rawEvidence);
  return { schemaVersion: 3, coverage: catalog.coverage, selection: catalog.selection,
    facts: catalog.facts.map(({ id, type, topic, observation, reviewReason, kinds, questions, practices }) => {
      const c = evidence.candidates.find(c => id === `rflow3_r${c.round}`), f = c.flow;
      return { id, type, topic, observation, reviewReason, kinds, questions, practices, rank: c.rank,
        flow: { initialAlive: f.initialAlive, anchor: f.anchor, outcome: f.outcome,
          omittedEarlierEvents: f.omittedEarlierEvents, omittedLaterEvents: f.omittedLaterEvents,
          eventFields: ['seconds', 'ownBefore', 'enemyBefore', 'ownAfter', 'enemyAfter', 'simultaneous', 'selectedDeath', 'selectedKills', 'selectedAliveAfter'],
          events: f.events.map(e => [e.timeSeconds, e.before.own, e.before.enemy, e.after.own, e.after.enemy,
            e.simultaneous, e.selectedDeath, e.selectedKills, e.selectedAliveAfter]) } };
    }), questions: catalog.questions, practices: catalog.practices };
}

function validatedSelection(rawSelection, evidence) {
  const selection = normalizeCoachingSelection(rawSelection), catalog = createReviewCatalog(evidence);
  for (const c of selection.cards) {
    const f = catalog.facts.find(f => f.id === c.factId);
    if (!f || !f.kinds.includes(c.kind) || !f.questions.includes(c.questionId) || !f.practices.includes(c.practiceId)) fail();
  }
  return { selection, catalog };
}
function curateReviewSelection(rawSelection, evidence) {
  const { selection, catalog } = validatedSelection(rawSelection, evidence), topics = new Set(), kept = new Set();
  for (const kind of ['practice', 'review', 'strength']) {
    const c = selection.cards.find(c => c.kind === kind);
    if (!c) continue;
    const topic = catalog.facts.find(f => f.id === c.factId).topic;
    if (!topics.has(topic)) { topics.add(topic); kept.add(kind); }
  }
  return { schemaVersion: 2, cards: selection.cards.filter(c => kept.has(c.kind)) };
}
function renderReviewSelection(rawSelection, evidence) {
  // Recovery validates the saved IDs but never re-curates a historical result.
  const { selection, catalog } = validatedSelection(rawSelection, evidence);
  return { schemaVersion: 1, cards: selection.cards.map(c => {
    const f = catalog.facts.find(f => f.id === c.factId);
    return { kind: c.kind, title: f.title, observation: f.observation,
      practice: `${QUESTIONS[c.questionId]}\n${PRACTICES[c.practiceId]}`, limitation: f.limitation, evidenceRefs: [...f.evidenceRefs] };
  }) };
}
module.exports = { createReviewCatalog, reviewSelectionInput, curateReviewSelection, renderReviewSelection };
