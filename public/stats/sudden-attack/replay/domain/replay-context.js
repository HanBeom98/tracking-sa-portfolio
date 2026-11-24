const rows = value => Array.isArray(value) ? value : [];
const number = value => (typeof value === 'number' || (typeof value === 'string' && value.trim()))
  && Number.isFinite(Number(value)) ? Number(value) : null;
const key = value => value == null ? '' : String(value);
export const TRADE_WINDOW_SECONDS = 5;

// Reconstruct only elimination rounds whose roster, events and summaries agree.
// Unknown event codes, participant changes and incomplete data must not become
// confident alive counts. Coordinates are deliberately not used to infer sight.
export function analyzeRoundContext(round, playerId) {
  const focus = key(playerId);
  const reasons = new Set();
  const roster = rows(round.replayRoundSummaryInfo);
  const teams = new Map();
  const duration = number(round.playTime);
  const validTeam = value => number(value) === 0 || number(value) === 1;
  const time = value => number(value) !== null && number(value) >= 0
    && duration !== null && number(value) <= duration * 10 + 1;
  const partial = () => ({ status: 'partial', reasons: [...reasons], opening: null,
    death: null, tradesMade: [], tradesReceived: [], alone: null, transitions: [] });
  if (duration === null || duration <= 0) reasons.add('invalid-duration');
  if (!Array.isArray(round.replayAttackInfo)) reasons.add('missing-events');
  for (const entry of roster) {
    const id = key(entry.nexonSN);
    if (!id || teams.has(id) || !validTeam(entry.teamNo)) reasons.add('invalid-roster');
    teams.set(id, number(entry.teamNo));
    if (number(entry.kill) === null || !Number.isInteger(number(entry.kill)) || number(entry.kill) < 0
      || ![0, 1].includes(number(entry.death))) reasons.add('missing-summary-counts');
    if (entry.breakType != null && number(entry.breakType) !== 0) reasons.add('participant-change');
    if (entry.reJoin != null && number(entry.reJoin) !== 0) reasons.add('participant-change');
  }
  if (!teams.has(focus) || ![0, 1].every(team => [...teams.values()].includes(team))) reasons.add('invalid-roster');
  if (!validTeam(round.winTeam) || !validTeam(round.offenseTeam)) reasons.add('unknown-result');
  const events = rows(round.replayAttackInfo).map(event => ({
    at: number(event.timeStamp), attacker: key(event.attackerNexonSN), victim: key(event.victimNexonSN), raw: event
  })).sort((a, b) => a.at - b.at);
  const firstEventAt = events[0]?.at ?? (duration ?? 0) * 10;
  const characters = rows(round.replayCharacterInfo);
  const seenCharacters = new Set();
  for (const character of characters) {
    const id = key(character.nexonSN);
    if (!teams.has(id) || seenCharacters.has(id)) reasons.add('invalid-initial-state');
    seenCharacters.add(id);
    const states = [...rows(character.replayCharacterStateInfo)].sort((a, b) => number(a.timeStamp) - number(b.timeStamp));
    if (!states.length || number(states[0].state) !== 1 || !time(states[0].timeStamp)
      || number(states[0].timeStamp) > Math.min(firstEventAt, 5)) reasons.add('invalid-initial-state');
    let dead = false;
    for (const state of states) {
      if (!time(state.timeStamp) || ![1, 2].includes(number(state.state))) reasons.add('unknown-state');
      if (dead && number(state.state) === 1) reasons.add('participant-change');
      if (number(state.state) === 2) dead = true;
    }
    const deathEvent = events.find(event => event.victim === id);
    const deadState = states.find(state => number(state.state) === 2);
    if (Boolean(deathEvent) !== Boolean(deadState)
      || (deathEvent && Math.abs(number(deadState?.timeStamp) - deathEvent.at) > 1)) reasons.add('state-event-mismatch');
  }
  if (seenCharacters.size !== teams.size) reasons.add('invalid-initial-state');
  // Entry records normally occur at the beginning of the first round only.
  const lastInitialAt = Math.max(0, ...characters.map(c => {
    return rows(c.replayCharacterStateInfo).reduce((min, s) => {
      const stamp = number(s.timeStamp);
      return stamp === null ? min : Math.min(min, stamp);
    }, 5);
  }));
  for (const entry of rows(round.replayEnterInfo)) {
    if (!teams.has(key(entry.nexonSN)) || !time(entry.timeStamp)
      || number(entry.timeStamp) > lastInitialAt) reasons.add('participant-change');
  }
  const deaths = new Map();
  const kills = new Map();
  for (const event of events) {
    if (!time(event.at)) reasons.add('invalid-event-time');
    if (number(event.raw.eventType) !== 0) reasons.add('unknown-event-type');
    if (!teams.has(event.attacker) || !teams.has(event.victim)) reasons.add('unknown-event-player');
    if (teams.get(event.attacker) === teams.get(event.victim)) reasons.add('unsupported-team-kill');
    if ((event.raw.attackerTeamNo != null && number(event.raw.attackerTeamNo) !== teams.get(event.attacker))
      || (event.raw.victimTeamNo != null && number(event.raw.victimTeamNo) !== teams.get(event.victim))) reasons.add('event-team-mismatch');
    deaths.set(event.victim, (deaths.get(event.victim) || 0) + 1);
    kills.set(event.attacker, (kills.get(event.attacker) || 0) + 1);
    if (deaths.get(event.victim) > 1) reasons.add('duplicate-death');
  }
  for (const entry of roster) {
    const id = key(entry.nexonSN);
    if ((deaths.get(id) || 0) !== number(entry.death) || (kills.get(id) || 0) !== number(entry.kill)) reasons.add('summary-event-mismatch');
  }
  if (reasons.size) return partial();

  const ownTeam = teams.get(focus);
  const alive = new Set(teams.keys());
  const counts = () => ({ own: [...alive].filter(id => teams.get(id) === ownTeam).length,
    enemy: [...alive].filter(id => teams.get(id) !== ownTeam).length });
  const initial = counts();
  const context = { status: 'complete', reasons: [], initial, opening: null, death: null,
    tradesMade: [], tradesReceived: [], alone: null, transitions: [] };
  const checkAlone = at => {
    const current = counts();
    if (!context.alone && alive.has(focus) && current.own === 1 && current.enemy >= 2) {
      context.alone = { timeSeconds: at / 10, opponentAlive: current.enemy, roundWon: number(round.winTeam) === ownTeam };
    }
  };
  checkAlone(0);
  const groups = new Map();
  for (const event of events) {
    if (!groups.has(event.at)) groups.set(event.at, []);
    groups.get(event.at).push(event);
  }
  const lastKills = new Map();
  for (const [at, group] of groups) {
    const before = counts();
    if (!context.opening) context.opening = { timeSeconds: at / 10, simultaneous: group.length > 1,
      selectedKill: group.some(e => e.attacker === focus), selectedDeath: group.some(e => e.victim === focus) };
    for (const event of group) {
      const prior = lastKills.get(event.victim);
      if (prior && at > prior.at && at - prior.at <= TRADE_WINDOW_SECONDS * 10
        && teams.get(event.attacker) === prior.victimTeam && alive.has(event.attacker)) {
        const candidate = { timeSeconds: at / 10, gapSeconds: (at - prior.at) / 10,
          teammateIds: [...prior.victims], opponentId: event.victim };
        if (event.attacker === focus) context.tradesMade.push(candidate);
        if (prior.victims.includes(focus)) context.tradesReceived.push({ ...candidate, teammateId: event.attacker });
      }
      if (event.victim === focus) context.death = { timeSeconds: at / 10, ...before,
        opening: context.opening.timeSeconds === at / 10, simultaneous: group.length > 1 };
    }
    // No ordering is inferred among deaths with identical timestamps.
    for (const event of group) alive.delete(event.victim);
    const after = counts();
    context.transitions.push({ timeSeconds: at / 10, before, after, simultaneous: group.length > 1 });
    const attackers = new Map();
    for (const event of group) {
      if (!attackers.has(event.attacker)) attackers.set(event.attacker, []);
      attackers.get(event.attacker).push(event.victim);
    }
    for (const [attacker, victims] of attackers) lastKills.set(attacker, { at, victims, victimTeam: teams.get(victims[0]) });
    checkAlone(at);
  }
  return context;
}

export function summarizeReplayContext(rounds) {
  const available = rounds.filter(r => r.context?.status === 'complete');
  const summary = { totalRounds: rounds.length, completeRounds: available.length,
    partialRounds: rounds.length - available.length, tradeWindowSeconds: TRADE_WINDOW_SECONDS,
    openingKills: [], openingDeaths: [], tradesMade: [], tradesReceived: [], aloneSituations: [] };
  for (const round of available) {
    const context = round.context;
    const base = { round: round.round, won: round.won };
    if (context.opening?.selectedKill) summary.openingKills.push({ ...base, ...context.opening });
    if (context.opening?.selectedDeath) summary.openingDeaths.push({ ...base, ...context.opening, ...context.death });
    summary.tradesMade.push(...context.tradesMade.map(trade => ({ ...base, ...trade })));
    summary.tradesReceived.push(...context.tradesReceived.map(trade => ({ ...base, ...trade })));
    if (context.alone) summary.aloneSituations.push({ ...base, ...context.alone });
  }
  return summary;
}

export function getContextInsights(summary) {
  if (!summary?.completeRounds) return [];
  const result = [];
  const coverage = summary.partialRounds ? ` 상황 기록을 확인한 ${summary.completeRounds}/${summary.totalRounds}개 라운드 기준입니다.` : '';
  const opening = summary.openingDeaths[0];
  if (opening) result.push({ tone: 'warn', title: '첫 사망 장면 복기',
    body: `${opening.round}라운드 ${opening.timeSeconds.toFixed(1)}초, ${opening.own}대${opening.enemy}에서 ${opening.simultaneous ? '첫 사망들과 같은 시각에 사망했습니다' : '첫 사망했습니다'}. 해당 장면의 전후 기록을 확인해 보세요.${coverage}` });
  const trade = summary.tradesMade[0];
  if (trade) result.push({ tone: 'good', title: '교환킬 후보',
    body: `${trade.round}라운드에서 팀원을 처치한 상대를 ${trade.gapSeconds.toFixed(1)}초 뒤 처치했습니다. 확인된 후보는 ${summary.tradesMade.length}건이며, 실제 시야나 의도적인 커버를 뜻하지는 않습니다.${coverage}` });
  const alone = [...summary.aloneSituations].sort((a, b) => b.opponentAlive - a.opponentAlive || a.round - b.round)[0];
  if (alone) result.push({ tone: 'neutral', title: '혼자 남은 상황',
    body: `${alone.round}라운드 ${alone.timeSeconds.toFixed(1)}초부터 1대${alone.opponentAlive} 상황에 남았습니다. 라운드 결과는 ${alone.roundWon ? '승리' : '패배'}이며, 혼자 남기 전 인원 변화를 함께 확인해 보세요.${coverage}` });
  if (!opening && summary.openingKills.length) {
    const first = summary.openingKills[0];
    result.push({ tone: 'good', title: '첫 처치 기록', body: `${first.round}라운드 ${first.timeSeconds.toFixed(1)}초에 ${first.simultaneous ? '첫 처치들과 같은 시각에 처치했습니다' : '첫 처치를 기록했습니다'}. 라운드 결과는 ${first.won ? '승리' : '패배'}입니다.${coverage}` });
  }
  return result.slice(0, 3);
}
