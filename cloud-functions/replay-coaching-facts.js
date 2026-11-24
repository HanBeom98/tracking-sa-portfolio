const { normalizeCoachingEvidence } = require('./replay-coaching-input.js');
const fail = code => { throw Object.assign(new Error(code), { code, status: 422 }); };
const exact = (v, keys) => v && typeof v === 'object' && !Array.isArray(v)
  && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const freeze = v => { if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v); } return v; };
const time = v => v.toFixed(1);
const QUESTIONS = Object.freeze({
  q_summary: '전체 집계와 라운드 기록을 어떻게 비교할까요?',
  q_opening: '첫 교전 전후 기록에서 무엇이 달라졌나요?',
  q_start: '시작 인원과 이후 인원 변화는 어떻게 달랐나요?',
  q_result: '개인 기록과 라운드 결과는 어떻게 달랐나요?',
  q_death: '사망 직전까지 인원 변화는 어떻게 이어졌나요?',
  q_death_team: '사망 직전 생존 팀원과 대응할 여지가 있었나요?',
  q_solo_before: '혼자 남기 직전 인원이 줄어든 흐름은 어땠나요?',
  q_solo_start: '처음부터 혼자였던 라운드의 기록은 어땠나요?',
  q_solo_after: '혼자 남은 뒤의 생존과 결과는 어땠나요?',
  q_trade_made: '아군 사망에서 본인 후속 처치까지 무엇을 확인할까요?',
  q_trade_gap: '후속 처치까지의 기록상 간격은 얼마였나요?',
  q_trade_received: '본인 사망 뒤 팀원의 후속 처치는 언제였나요?',
  q_posthumous: '처치 중 사망 이후 기록은 어떻게 구분되나요?',
  q_team_alive: '시작할 때 생존 팀원과 합류할 여지가 있었나요?',
});
const PRACTICES = Object.freeze({
  p_summary: '다음 경기에서 킬·사망·생존과 라운드 결과를 함께 확인해 보세요.',
  p_opening: '첫 교전 전후의 기록을 나눠 비교해 보세요.',
  p_start: '라운드 시작 인원과 이후 사건을 구분해 표시해 보세요.',
  p_result: '생존·처치와 팀 승패를 구분해 복기해 보세요.',
  p_death: '사망 전후를 나눠 기록을 확인해 보세요.',
  p_death_team: '사망 직전 장면에서 생존 팀원의 대응 가능 여부를 확인해 보세요.',
  p_solo_before: '혼자 남기 전과 후의 기록을 구분해 복기해 보세요.',
  p_solo_start: '처음부터 혼자인 라운드는 별도로 묶어 생존과 결과를 비교해 보세요.',
  p_solo_after: '혼자 남은 시점부터 종료까지의 기록을 따로 확인해 보세요.',
  p_trade_made: '아군 사망과 본인의 후속 처치를 서로 다른 사건으로 표시해 보세요.',
  p_trade_gap: '후속 처치 시각과 직전 사망 시각을 비교해 보세요.',
  p_trade_received: '본인의 사망과 팀원의 후속 처치 기록을 구분해 복기해 보세요.',
  p_posthumous: '사망 전 처치와 사망 이후 처치를 따로 나눠 기록해 보세요.',
  p_team_alive: '시작할 때 생존 팀원과의 합류 가능 여부를 확인해 보세요.',
});
const GENERAL_LIMIT = '검증된 기록이며 장기 실력이나 승패의 원인을 뜻하지 않습니다.';
const TRADE_LIMIT = '교환킬 후보이며 거리·시야·커버 의도는 확인할 수 없습니다.';
const MAX_FACTS = 24;
const identifier = v => typeof v === 'string' && /^[a-z][a-z0-9_-]{0,47}$/.test(v);

function normalizeCoachingSelection(value) {
  if (!exact(value, ['schemaVersion', 'cards']) || value.schemaVersion !== 2
    || !Array.isArray(value.cards) || value.cards.length < 1 || value.cards.length > 3) fail('INVALID_COACHING_SELECTION');
  const kinds = new Set(), facts = new Set();
  const cards = value.cards.map(c => {
    if (!exact(c, ['kind', 'factId', 'questionId', 'practiceId']) || !['strength', 'review', 'practice'].includes(c.kind)
      || kinds.has(c.kind) || facts.has(c.factId) || ![c.factId, c.questionId, c.practiceId].every(identifier)) fail('INVALID_COACHING_SELECTION');
    kinds.add(c.kind); facts.add(c.factId);
    return { kind: c.kind, factId: c.factId, questionId: c.questionId, practiceId: c.practiceId };
  });
  return { schemaVersion: 2, cards };
}

function createCoachingFactCatalog(rawEvidence) {
  const evidence = normalizeCoachingEvidence(rawEvidence);
  if (!evidence.metrics) fail('INSUFFICIENT_EVIDENCE');
  const make = (id, type, title, observation, refs, questions, practices, kinds = ['review', 'practice'], limitation = GENERAL_LIMIT) => {
    const fact = { id, type, title, observation, limitation, evidenceRefs: refs, questions, practices, kinds };
    if (title.length > 30 || observation.length > 100 || limitation.length > 60) fail('FACT_CATALOG_INVALID');
    for (const q of questions) for (const p of practices) {
      if (!QUESTIONS[q] || !PRACTICES[p] || `${QUESTIONS[q]}\n${PRACTICES[p]}`.length > 80) fail('FACT_CATALOG_INVALID');
    }
    return fact;
  };
  const m = evidence.metrics;
  const aggregate = [make('summary', 'aggregate', '검증 라운드 전체 기록',
    `검증된 ${m.rounds}라운드에서 ${m.kills}킬·${m.deaths}사망, 평균 생존 ${time(m.averageSurvivalSeconds)}초입니다.`,
    ['verified-rounds'], ['q_summary', 'q_result'], ['p_summary', 'p_result'])];
  if (m.openingKills || m.openingDeaths) aggregate.push(make('opening_summary', 'aggregate_opening', '전체 첫 교전 기록',
    `검증된 ${m.rounds}라운드에서 첫 처치 ${m.openingKills}회·첫 사망 ${m.openingDeaths}회입니다.`,
    ['verified-rounds'], ['q_opening', 'q_summary'], ['p_opening', 'p_summary']));
  const groups = evidence.rounds.map(r => {
    const facts = [], prefix = `r${r.round}`, refs = [r.evidenceId], title = text => `${r.round}라운드 ${text}`;
    if (r.alone) {
      const startedAlone = r.initialAlive.own === 1 && r.alone.timeSeconds === 0;
      const before = startedAlone ? 'start' : 'before';
      facts.push(make(`${prefix}_solo`, 'solo', title('단독 상황'),
        `${r.round}라운드 시작 후 ${time(r.alone.timeSeconds)}초부터 본인만 남은 1대${r.alone.opponentsAlive} 상황입니다.`, refs,
        [`q_solo_${before}`, 'q_solo_after'], [`p_solo_${before}`, 'p_solo_after'], ['review', 'practice'],
        '단독 상황만으로 개인 실력이나 패배 책임을 판단할 수 없습니다.'));
    }
    for (const [i, t] of r.tradesReceived.examples.entries()) {
      if (!r.death || Math.abs(t.timeSeconds - t.gapSeconds - r.death.timeSeconds) > 1e-7) fail('FACT_EVIDENCE_CONFLICT');
      facts.push(make(`${prefix}_received${i + 1}`, 'trade_received', title('교환킬 수혜 후보'),
        `${r.round}라운드 시작 후 ${time(r.death.timeSeconds)}초 본인 사망, ${time(t.gapSeconds)}초 뒤 ${time(t.timeSeconds)}초에 팀원이 같은 상대를 처치한 후보입니다.`, refs,
        ['q_trade_received', 'q_trade_gap'], ['p_trade_received', 'p_trade_gap'], ['review', 'practice'], TRADE_LIMIT));
    }
    for (const [i, t] of r.tradesMade.examples.entries()) {
      if (r.death && t.timeSeconds > r.death.timeSeconds) fail('FACT_EVIDENCE_CONFLICT');
      facts.push(make(`${prefix}_made${i + 1}`, 'trade_made', title('교환킬 수행 후보'),
        `${r.round}라운드 시작 후 ${time(t.timeSeconds - t.gapSeconds)}초 아군 사망 ${t.alliedDeathsAtPriorTime}건, ${time(t.gapSeconds)}초 뒤 ${time(t.timeSeconds)}초에 본인이 상대를 처치한 후보입니다.`, refs,
        ['q_trade_made', 'q_trade_gap'], ['p_trade_made', 'p_trade_gap'], ['strength', 'review', 'practice'], TRADE_LIMIT));
    }
    if (r.killsAfterDeath) facts.push(make(`${prefix}_posthumous`, 'posthumous', title('사망 이후 처치'),
      `${r.round}라운드 ${r.kills}킬 중 ${r.killsAfterDeath}킬은 본인 사망 이후의 기록입니다.`, refs,
      ['q_posthumous'], ['p_posthumous']));
    if (r.death) {
      const team = r.death.ownAlive > 1;
      facts.push(make(`${prefix}_death`, 'death', title('사망 직전 인원'),
        `${r.round}라운드 시작 후 ${time(r.death.timeSeconds)}초 사망 직전, 본인 포함 아군 ${r.death.ownAlive}명·상대 ${r.death.enemyAlive}명이 생존했습니다.`, refs,
        ['q_death', ...(team ? ['q_death_team'] : [])], ['p_death', ...(team ? ['p_death_team'] : [])], ['review', 'practice'],
        '사망 직전 인원이며 이후 인원이나 사망 원인을 뜻하지 않습니다.'));
    }
    if (r.opening) {
      const action = r.opening.selectedKill && r.opening.selectedDeath ? '본인의 처치·사망' : r.opening.selectedKill ? '본인의 처치' : '본인의 사망';
      const tie = r.opening.simultaneous ? '동시 첫 사건 시각에 ' : '첫 사건 시각에 ';
      facts.push(make(`${prefix}_opening`, 'opening', title('첫 교전 기록'),
        `${r.round}라운드 시작 후 ${time(r.opening.timeSeconds)}초 ${tie}${action}이 기록됐습니다.`, refs,
        ['q_opening'], ['p_opening'], r.opening.selectedDeath ? ['review', 'practice'] : ['strength', 'review', 'practice'],
        r.opening.simultaneous ? '같은 시각의 사건 사이 선후는 정하지 않으며 교전 의도는 알 수 없습니다.' : GENERAL_LIMIT));
    }
    facts.push(make(`${prefix}_result`, 'round_result', title('개인 기록과 결과'),
      `${r.round}라운드 ${r.kills}킬·${r.death ? 1 : 0}사망, 생존 ${time(r.survivalSeconds)}초, 라운드 결과는 ${r.result === 'win' ? '승리' : '패배'}입니다.`, refs,
      ['q_result'], ['p_result']));
    const hasTeam = r.initialAlive.own > 1;
    facts.push(make(`${prefix}_start`, 'round_start', title('시작 인원'),
      `${r.round}라운드 시작 인원은 본인 포함 아군 ${r.initialAlive.own}명·상대 ${r.initialAlive.enemy}명입니다.`, refs,
      ['q_start', ...(hasTeam ? ['q_team_alive'] : [])], ['p_start', ...(hasTeam ? ['p_team_alive'] : [])], ['review', 'practice'],
      '라운드 시작 시점의 인원이며 이후 생존 인원과 구분해야 합니다.'));
    return facts;
  });
  // Preserve every selected round before adding more facts from any one round.
  const all = [...aggregate];
  for (let i = 0; groups.some(g => i < g.length); i++) for (const group of groups) if (group[i]) all.push(group[i]);
  const facts = all.slice(0, MAX_FACTS);
  const questions = [...new Set(facts.flatMap(f => f.questions))].map(id => ({ id, text: QUESTIONS[id] }));
  const practices = [...new Set(facts.flatMap(f => f.practices))].map(id => ({ id, text: PRACTICES[id] }));
  return freeze({ schemaVersion: 2, coverage: evidence.coverage,
    selection: { method: 'round_robin_priority_v2', maxFacts: MAX_FACTS, includedFacts: facts.length, omittedFacts: all.length - facts.length },
    facts, questions, practices });
}

function coachingSelectionSchema(catalog) {
  const slots = Object.fromEntries(['strength', 'review', 'practice'].map(kind => {
    const eligible = catalog.facts.filter(f => f.kinds.includes(kind));
    if (!eligible.length) return [kind, { type: 'null' }];
    const properties = { factId: { type: 'string', enum: eligible.map(f => f.id) },
      questionId: { type: 'string', enum: [...new Set(eligible.flatMap(f => f.questions))] },
      practiceId: { type: 'string', enum: [...new Set(eligible.flatMap(f => f.practices))] } };
    return [kind, { anyOf: [{ type: 'object', additionalProperties: false,
      required: Object.keys(properties), properties }, { type: 'null' }] }];
  }));
  // A fixed property per kind prevents two review/strength/practice cards at
  // generation time. Null is an explicit omission, never a fabricated card.
  return { type: 'object', additionalProperties: false, required: ['schemaVersion', 'slots'], properties: {
    schemaVersion: { type: 'integer', enum: [3] }, slots: { type: 'object', additionalProperties: false,
      required: Object.keys(slots), properties: slots } } };
}

function normalizeCoachingSlotSelection(value) {
  const kinds = ['strength', 'review', 'practice'];
  if (!exact(value, ['schemaVersion', 'slots']) || value.schemaVersion !== 3 || !exact(value.slots, kinds)) fail('INVALID_COACHING_SELECTION');
  const cards = [];
  for (const kind of kinds) {
    const slot = value.slots[kind];
    if (slot === null) continue;
    if (!exact(slot, ['factId', 'questionId', 'practiceId'])) fail('INVALID_COACHING_SELECTION');
    cards.push({ kind, factId: slot.factId, questionId: slot.questionId, practiceId: slot.practiceId });
  }
  // Keep the canonical stored v2 selection, including distinct fact IDs and
  // all existing shape checks. Context checks still run during rendering.
  return normalizeCoachingSelection({ schemaVersion: 2, cards });
}

function coachingSelectionInput(catalog) {
  return { schemaVersion: 2, coverage: catalog.coverage, selection: catalog.selection,
    facts: catalog.facts.map(({ id, type, observation, kinds, questions, practices }) => ({ id, type, observation, kinds, questions, practices })),
    questions: catalog.questions, practices: catalog.practices };
}

function renderCoachingSelection(rawSelection, rawEvidence) {
  const selection = normalizeCoachingSelection(rawSelection), catalog = createCoachingFactCatalog(rawEvidence);
  return { schemaVersion: 1, cards: selection.cards.map(c => {
    const fact = catalog.facts.find(f => f.id === c.factId);
    if (!fact || !fact.kinds.includes(c.kind) || !fact.questions.includes(c.questionId) || !fact.practices.includes(c.practiceId)) fail('COACHING_SELECTION_NOT_ALLOWED');
    return { kind: c.kind, title: fact.title, observation: fact.observation,
      practice: `${QUESTIONS[c.questionId]}\n${PRACTICES[c.practiceId]}`, limitation: fact.limitation, evidenceRefs: [...fact.evidenceRefs] };
  }) };
}
module.exports = { createCoachingFactCatalog, coachingSelectionSchema, coachingSelectionInput,
  normalizeCoachingSelection, normalizeCoachingSlotSelection, renderCoachingSelection };
