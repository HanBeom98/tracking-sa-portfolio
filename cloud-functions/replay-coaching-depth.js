const legacy = require('./replay-coaching-facts.js');
const { normalizeCoachingEvidence } = require('./replay-coaching-input.js');
const fail = code => { throw Object.assign(new Error(code), { code, status: 422 }); };
const freeze = v => { if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v); } return v; };
const time = v => v.toFixed(1);
// Versioned IDs keep saved legacy cards reproducible. These are paid-analysis
// candidates only; the free analyzer, mock explanation and UI stay unchanged.
const QUESTIONS = Object.freeze({
  dq1_team: '복기: 생존 팀원과 대응할 여지는?',
  dq1_death: '복기: 시작부터 사망까지 인원 변화는?',
  dq1_solo: '복기: 혼자였던 구간과 종료 결과는?',
  dq1_opening: '복기: 첫 사건 이후 개인 기록과 팀 결과는?',
  dq1_received: '복기: 본인 사망 뒤 팀원의 후속 처치는?',
  dq1_made: '복기: 아군 사망 뒤 본인 처치까지 간격은?',
  dq1_gap: '복기: 후속 처치 간격과 팀 결과는?',
  dq1_result: '복기: 개인 기록과 팀 승패는 어떻게 달랐나요?',
});
const PRACTICES = Object.freeze({
  dp1_team: '다음 3라운드 교전 전 팀원 수 확인을 목표로, 경기 후 실행 횟수를 직접 세어 보세요.',
  dp1_death: '다음 3라운드 종료 뒤 처치·사망·팀 승패를 구분해 기록했는지 직접 확인하세요.',
  dp1_solo: '다음 3라운드 마지막 생존 시 교전 전 선택을 점검하고, 경기 후 점검 여부를 직접 세세요.',
  dp1_opening: '다음 3라운드 첫 교전 직후 생존 여부와 팀 승패를 나눠 기록하는 것을 목표로 하세요.',
  dp1_received: '다음 3라운드 교전 전 팀원 수 확인을 목표로, 경기 후 본인 사망·후속 처치를 구분하세요.',
  dp1_made: '다음 3라운드 아군 사망·본인 처치 시각을 구분해 적는 것을 목표로 하세요.',
  dp1_result: '다음 3라운드 자신의 생존·처치와 팀 승패를 따로 기록하고, 경기 후 기록 여부를 확인하세요.',
});
// Never edit saved dp1 text. New generations offer only these versioned action
// goals; they are suggestions to check manually, not inferred tactical mistakes.
const ACTION_PRACTICES = Object.freeze({
  dp2_team: '다음 3라운드 교전 전 생존 팀원 수를 확인하세요. 경기 후 확인 여부를 직접 세세요.',
  dp2_death: '다음 3라운드 교전 전 생존 인원을 확인하고, 불리하면 교전 지속 여부를 다시 판단하세요.',
  dp2_solo: '다음 3라운드 혼자 남으면 교전 전 생존 인원을 확인하세요. 해당 상황이 없으면 제외하세요.',
  dp2_opening: '다음 3라운드 첫 교전 전 엄폐·생존 인원을 확인하고, 교전 뒤 재교전 여부를 판단하세요.',
  dp2_received: '다음 3라운드 첫 교전 전 팀원과 합류할 여지를 확인하세요. 경기 후 확인 여부를 직접 세세요.',
  dp2_made: '다음 3라운드 아군 사망 시 엄폐·합류 여지를 먼저 확인하세요. 해당 상황이 없으면 제외하세요.',
  dp2_result: '다음 3라운드 첫 교전 전 생존 인원과 엄폐를 확인하세요. 경기 후 실행 여부를 직접 세세요.',
});
const TOPICS = Object.freeze({
  aggregate: 'summary', aggregate_opening: 'opening', round_start: 'survival', round_result: 'result',
  death: 'survival', solo: 'solo', opening: 'opening', posthumous: 'posthumous',
  trade_made: 'trade', trade_received: 'trade',
  depth_death: 'survival', depth_solo: 'solo', depth_opening: 'opening', depth_result: 'result',
  depth_made: 'trade', depth_received: 'trade',
});
const LIMIT = '연결된 기록이며 원인은 확정할 수 없습니다. 목표 실행 여부는 직접 확인해야 합니다.';
const TRADE_LIMIT = '교환킬 후보입니다. 거리·시야·커버 의도와 목표 실행 여부는 기록만으로 알 수 없습니다.';

function depthFacts(evidence) {
  const groups = evidence.rounds.map(r => {
    const list = [], prefix = `depth1_r${r.round}`, refs = [r.evidenceId];
    const result = r.result === 'win' ? '승리' : '패배';
    const add = (suffix, type, title, observation, reviewReason, questions, practices, kinds = ['review', 'practice'], limitation = LIMIT) => {
      const f = { id: `${prefix}_${suffix}`, type: `depth_${type}`, title: `${r.round}라운드 ${title}`,
        observation, reviewReason, questions, practices, kinds, limitation, evidenceRefs: refs };
      if (f.title.length > 30 || observation.length > 100 || limitation.length > 60 || reviewReason.length > 100) fail('DEPTH_CATALOG_INVALID');
      for (const q of questions) for (const p of practices) {
        if (!QUESTIONS[q] || !PRACTICES[p] || `${QUESTIONS[q]}\n${PRACTICES[p]}`.length > 80) fail('DEPTH_CATALOG_INVALID');
      }
      list.push(f);
    };
    if (r.alone) add('solo', 'solo', '단독 구간과 종료 결과',
      `${r.round}라운드 시작 ${r.initialAlive.own}대${r.initialAlive.enemy} → ${time(r.alone.timeSeconds)}초부터 본인만 남은 1대${r.alone.opponentsAlive} → 팀 ${result}.`,
      r.initialAlive.own === 1 && r.alone.timeSeconds === 0 ? '처음부터 혼자인 구간과 팀 결과를 구분해 확인할 장면입니다.' : '단독 상황에 도달한 시점과 팀 결과를 나눠 확인할 장면입니다.',
      ['dq1_solo'], ['dp1_solo']);
    for (const [i, t] of r.tradesReceived.examples.entries()) add(`received${i + 1}`, 'received', '사망·후속 처치와 결과',
      `${r.round}라운드 ${time(r.death.timeSeconds)}초 본인 사망 → ${time(t.gapSeconds)}초 뒤 ${time(t.timeSeconds)}초 팀원 후속 처치 후보 → 팀 ${result}.`,
      '본인 사망과 팀원의 후속 처치 간격을 팀 결과와 함께 확인할 장면입니다.',
      ['dq1_received', 'dq1_gap'], ['dp1_received'], ['review', 'practice'], TRADE_LIMIT);
    for (const [i, t] of r.tradesMade.examples.entries()) add(`made${i + 1}`, 'made', '아군 사망·본인 처치와 결과',
      `${r.round}라운드 ${time(t.timeSeconds - t.gapSeconds)}초 아군 사망 ${t.alliedDeathsAtPriorTime}건 → ${time(t.gapSeconds)}초 뒤 ${time(t.timeSeconds)}초 본인 후속 처치 후보 → 팀 ${result}.`,
      '아군 사망 이후 본인의 후속 처치 간격과 팀 결과를 구분해 확인할 장면입니다.',
      ['dq1_made', 'dq1_gap'], ['dp1_made'], ['strength', 'review', 'practice'], TRADE_LIMIT);
    if (r.death) {
      const delta = (r.death.ownAlive - r.death.enemyAlive) - (r.initialAlive.own - r.initialAlive.enemy);
      const reason = delta < 0 ? '사망 직전 인원차가 시작보다 불리해진 장면입니다.'
        : delta > 0 ? '사망 직전 인원차가 시작보다 개선된 장면입니다.' : '시작과 인원차가 같은 시점의 사망 장면입니다.';
      const team = r.death.ownAlive > 1;
      const title = delta < 0 ? '불리해진 인원차와 사망' : delta > 0 ? '개선된 인원차와 사망' : '사망 시 인원차와 결과';
      add('death', 'death', title,
        `${r.round}라운드 시작 ${r.initialAlive.own}대${r.initialAlive.enemy} → ${time(r.death.timeSeconds)}초 사망 직전 본인 포함 ${r.death.ownAlive}대${r.death.enemyAlive} → 팀 ${result}.${r.death.simultaneous ? ' 동시 사건 내부 순서 미정.' : ''}`,
        reason, ['dq1_death', ...(team ? ['dq1_team'] : [])], ['dp1_death', ...(team ? ['dp1_team'] : [])]);
    }
    if (r.opening) {
      const action = r.opening.selectedKill && r.opening.selectedDeath ? '본인 처치·사망' : r.opening.selectedKill ? '본인 처치' : '본인 사망';
      add('opening', 'opening', '첫 사건과 개인·팀 결과',
        `${r.round}라운드 ${time(r.opening.timeSeconds)}초 ${r.opening.simultaneous ? '동시 ' : ''}첫 사건에 ${action} 기록 → 개인 종료 ${r.kills}킬·${Number(Boolean(r.death))}사망 → 팀 ${result}.`,
        '첫 사건의 개인 기록과 라운드 전체 기록·팀 결과를 구분해 확인할 장면입니다.',
        ['dq1_opening'], ['dp1_opening'], r.opening.selectedDeath ? ['review', 'practice'] : ['strength', 'review', 'practice'],
        r.opening.simultaneous ? '동시 사건 내부 순서는 미정입니다. 첫 사건만으로 승패 원인이나 개인 기여를 확정할 수 없습니다.' : LIMIT);
    }
    add('result', 'result', '시작 인원과 개인·팀 결과',
      `${r.round}라운드 시작 ${r.initialAlive.own}대${r.initialAlive.enemy} / 개인 종료 ${r.kills}킬·${Number(Boolean(r.death))}사망 / 팀 ${result}.`,
      '개인의 처치·사망과 팀 결과가 서로 다른 지표임을 확인할 장면입니다.', ['dq1_result'], ['dp1_result']);
    return list;
  });
  return groups;
}

function createCoachingDepthCatalog(rawEvidence) {
  const evidence = normalizeCoachingEvidence(rawEvidence), base = legacy.createCoachingFactCatalog(evidence);
  // New practice cards always carry an explicit next-three-round goal. Legacy
  // IDs remain available for strength/review and exact historical recovery.
  const offeredLegacy = base.facts.map(f => ({ ...f, kinds: f.kinds.filter(k => k !== 'practice') }));
  const groups = depthFacts(evidence).map((group, i) => [...group.map(actionFact), ...offeredLegacy.filter(f => f.evidenceRefs[0] === evidence.rounds[i].evidenceId)]);
  const all = offeredLegacy.filter(f => f.evidenceRefs[0] === 'verified-rounds');
  for (let i = 0; groups.some(g => i < g.length); i++) for (const group of groups) if (group[i]) all.push(group[i]);
  const facts = all.slice(0, 24).map(f => ({ ...f, topic: TOPICS[f.type] })), questionMap = new Map(base.questions.map(q => [q.id, q.text])), practiceMap = new Map(base.practices.map(p => [p.id, p.text]));
  for (const [id, text] of Object.entries(QUESTIONS)) questionMap.set(id, text);
  for (const [id, text] of Object.entries(PRACTICES)) practiceMap.set(id, text);
  for (const [id, text] of Object.entries(ACTION_PRACTICES)) practiceMap.set(id, text);
  return freeze({ schemaVersion: 2, coverage: evidence.coverage,
    selection: { method: 'round_robin_depth_v1', curation: 'distinct_topic_action_v2', maxFacts: 24, includedFacts: facts.length, omittedFacts: all.length - facts.length + base.selection.omittedFacts },
    facts, questions: [...new Set(facts.flatMap(f => f.questions))].map(id => ({ id, text: questionMap.get(id) })),
    practices: [...new Set(facts.flatMap(f => f.practices))].map(id => ({ id, text: practiceMap.get(id) })) });
}

function actionFact(fact) {
  const practices = fact.practices.map(id => id.replace(/^dp1_/, 'dp2_'));
  for (const q of fact.questions) for (const p of practices) {
    if (!ACTION_PRACTICES[p] || `${QUESTIONS[q]}\n${ACTION_PRACTICES[p]}`.length > 80) fail('DEPTH_CATALOG_INVALID');
  }
  return { ...fact, practices };
}

function coachingDepthInput(catalog) {
  const input = legacy.coachingSelectionInput(catalog);
  input.facts = input.facts.map(f => {
    const full = catalog.facts.find(c => c.id === f.id);
    return { ...f, topic: full.topic, ...(full.reviewReason ? { reviewReason: full.reviewReason } : {}) };
  });
  return input;
}

function validateCurrentDepthSelection(rawSelection, rawEvidence) {
  const selection = legacy.normalizeCoachingSelection(rawSelection), catalog = createCoachingDepthCatalog(rawEvidence);
  if (new Set(selection.cards.map(c => c.factId.replace(/^depth1_/, ''))).size !== selection.cards.length) fail('COACHING_SELECTION_NOT_ALLOWED');
  for (const card of selection.cards) {
    const fact = catalog.facts.find(f => f.id === card.factId);
    if (!fact || !fact.kinds.includes(card.kind) || !fact.questions.includes(card.questionId) || !fact.practices.includes(card.practiceId)) fail('COACHING_SELECTION_NOT_ALLOWED');
  }
  return selection;
}

function curateCurrentDepthSelection(rawSelection, rawEvidence) {
  // Validate EVERY offered pair before dropping any duplicate topic. Invalid
  // model output must not be laundered into a success by the curation step.
  const selection = validateCurrentDepthSelection(rawSelection, rawEvidence);
  const catalog = createCoachingDepthCatalog(rawEvidence), topics = new Set(), kept = new Set();
  // Prefer the next action, then a review scene, then a strength. Keep only
  // model-selected cards; do not invent a replacement or buy another response.
  for (const kind of ['practice', 'review', 'strength']) {
    const card = selection.cards.find(c => c.kind === kind);
    if (!card) continue;
    const topic = catalog.facts.find(f => f.id === card.factId).topic;
    if (!topic) fail('DEPTH_CATALOG_INVALID');
    if (!topics.has(topic)) { topics.add(topic); kept.add(card.kind); }
  }
  return { schemaVersion: 2, cards: selection.cards.filter(c => kept.has(c.kind)) };
}

function renderCoachingDepthSelection(rawSelection, rawEvidence) {
  const selection = legacy.normalizeCoachingSelection(rawSelection), evidence = normalizeCoachingEvidence(rawEvidence);
  // Retain the original semantic trade-time checks on stored-result recovery.
  legacy.createCoachingFactCatalog(evidence);
  if (new Set(selection.cards.map(c => c.factId.replace(/^depth1_/, ''))).size !== selection.cards.length) fail('COACHING_SELECTION_NOT_ALLOWED');
  const available = depthFacts(evidence).flat();
  return { schemaVersion: 1, cards: selection.cards.map(c => {
    // Saved old IDs use the frozen original catalog even when they are not in
    // the new offered top 24. Only decoding a NEW generation uses current IDs.
    if (!c.factId.startsWith('depth1_')) return legacy.renderCoachingSelection({ schemaVersion: 2, cards: [c] }, evidence).cards[0];
    const f = available.find(f => f.id === c.factId);
    if (!f || !f.kinds.includes(c.kind) || !f.questions.includes(c.questionId)) fail('COACHING_SELECTION_NOT_ALLOWED');
    const practices = c.practiceId.startsWith('dp2_') ? actionFact(f).practices : f.practices;
    if (!practices.includes(c.practiceId)) fail('COACHING_SELECTION_NOT_ALLOWED');
    return { kind: c.kind, title: f.title, observation: f.observation,
      practice: `${QUESTIONS[c.questionId]}\n${PRACTICES[c.practiceId] ?? ACTION_PRACTICES[c.practiceId]}`, limitation: f.limitation, evidenceRefs: [...f.evidenceRefs] };
  }) };
}

module.exports = { createCoachingDepthCatalog, coachingDepthInput, validateCurrentDepthSelection, curateCurrentDepthSelection, renderCoachingDepthSelection };
