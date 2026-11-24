import { analyzeRoundContext } from './replay-context.js';
import { trackReplayParticipants } from './replay-participants.js';
import { createMatchWinState, advanceMatchWinState, estimateMatchWinChance, estimateCurrentRoundChance } from './replay-match-probability.js';

const rows = value => Array.isArray(value) ? value : [];
const number = value => (typeof value === 'number' || typeof value === 'string' && value.trim()) && Number.isFinite(Number(value)) ? Number(value) : null;
const name = value => String(value ?? '이름 없음').slice(0, 80);
const team = value => number(value) === 0 || number(value) === 1;
const unavailable = reason => ({ status: 'unavailable', reason, rounds: [], durationMs: 0 });

// A transparent state index, NOT an empirically calibrated win probability.
// Only current survivors, recorded bomb state, and already completed rounds enter.
export function calculateSituationIndex(alive, initial, score, bomb, offense) {
  if (![alive, initial, score].every(a => Array.isArray(a) && a.length === 2 && a.every(n => Number.isFinite(n) && n >= 0)) || !Math.max(...initial)) return null;
  const scale = Math.max(...initial);
  const played = score[0] + score[1];
  const value = 50 + 40 * (alive[0] - alive[1]) / scale
    + 10 * (score[0] - score[1]) / Math.max(1, played)
    + (bomb === 'planted' ? (offense === 0 ? 10 : -10) : 0);
  return Math.round(Math.max(5, Math.min(95, value)) * 10) / 10;
}

export function buildReplayPlayback(parsed) {
  const rawRounds = rows(parsed?.replay_info?.replayRoundInfo);
  if (!rawRounds.length) return unavailable('MISSING_ROUNDS');
  if (rawRounds.some(r => !r || typeof r !== 'object' || Array.isArray(r))) return unavailable('INVALID_ROUND_ORDER');
  if (rawRounds.length > 100 || rawRounds.reduce((n, r) => n + rows(r.replayAttackInfo).length + rows(r.replayBombInfo).length, 0) > 5000) return unavailable('TOO_MANY_EVENTS');
  const sorted = [...rawRounds].sort((a, b) => number(a.no) - number(b.no));
  const ids = sorted.map(r => number(r.no));
  if (ids.some(id => !Number.isInteger(id) || id < 1) || new Set(ids).size !== ids.length) return unavailable('INVALID_ROUND_ORDER');
  if (sorted.some(r => number(r.playTime) === null || Math.round(number(r.playTime) * 1000) <= 0 || number(r.playTime) > 3600)) return unavailable('INVALID_ROUND_DURATION');
  const matchEstimate = parsed?.replay_info?.replayMatchSummaryInfo?.matchType === 'R';
  let matchState = createMatchWinState(), ruleKnown = ids[0] === 1;
  const firstOffense = number(sorted[0].offenseTeam);
  let offset = 0, score = [0, 0], scoreKnown = ids[0] === 1;
  const rounds = sorted.map((raw, index) => {
    if (index && ids[index] !== ids[index - 1] + 1) scoreKnown = false;
    const durationMs = Math.round(number(raw.playTime) * 1000), offense = number(raw.offenseTeam), winner = number(raw.winTeam);
    if (matchEstimate && (!scoreKnown || matchState?.phase === 'finished'
      || (matchState?.phase !== 'golden' && offense !== (matchState?.phase === 'first' ? firstOffense : 1 - firstOffense)))) ruleKnown = false;
    const roundMatchState = ruleKnown ? matchState : null;
    const roster = rows(raw.replayRoundSummaryInfo).slice(0, 64).map(p => ({ id: String(p.nexonSN ?? ''), name: name(p.nickName), team: number(p.teamNo) }));
    const byId = new Map(roster.map(p => [p.id, p]));
    const context = analyzeRoundContext(raw, roster[0]?.id ?? '');
    const tracking = context.status==='complete'?null:trackReplayParticipants(raw);
    const recovered = tracking?.status==='complete';
    const reasons = new Set(recovered?[]:context.reasons);
    if(tracking&&!recovered)reasons.add(tracking.reason);
    let aliveVerified = (context.status === 'complete'||recovered) && rows(raw.replayRoundSummaryInfo).length <= 64;
    if (rows(raw.replayRoundSummaryInfo).length > 64) reasons.add('too-many-players');
    let bombVerified = Array.isArray(raw.replayBombInfo);
    if (!bombVerified) reasons.add('missing-bomb-records');
    const at = value => {
      const t = number(value);
      return t !== null && t >= 0 && t * 100 <= durationMs + 100 ? Math.min(durationMs, Math.round(t * 100)) : null;
    };
    const events = [];
    const bombDeathIndexes=new Set(recovered?tracking.bombDeaths.map(e=>e.index):[]);
    for (const [attackIndex,e] of rows(raw.replayAttackInfo).entries()) {
      const timeMs = at(e.timeStamp), attacker = byId.get(String(e.attackerNexonSN)), victim = byId.get(String(e.victimNexonSN));
      if(bombDeathIndexes.has(attackIndex)){
        events.push({timeMs,type:'bomb-death',victimId:victim.id,victim:victim.name,side:victim.team});continue;
      }
      if (timeMs === null || number(e.eventType) !== 0 || !attacker || !victim || !team(attacker.team) || !team(victim.team)) continue;
      events.push({ timeMs, type: 'kill', attackerId: attacker.id, victimId: victim.id,
        attacker: attacker.name, victim: victim.name, side: attacker.team, weapon: name(e.itemName || '무기 정보 없음') });
    }
    for (const e of rows(raw.replayBombInfo)) {
      const timeMs = at(e.timeStamp), type = number(e.bombEventType), side = number(e.teamNo);
      if (timeMs === null || ![0, 1, 2, 3].includes(type) || (type === 0 && (!team(side) || side !== offense)) || (type === 2 && (!team(side) || side === offense))) {
        bombVerified = false; reasons.add('invalid-bomb-event'); continue;
      }
      const actor = byId.get(String(e.nexonSN ?? ''));
      events.push({ timeMs, type: ['plant', 'explode', 'defuse', 'drop'][type], actor: name(e.nickName),
        actorId: actor && (!team(side) || actor.team === side) ? actor.id : null, side: team(side) ? side : null });
    }
    if(recovered)for(const e of tracking.events)events.push({...e,actor:byId.get(e.actorId).name});
    events.sort((a, b) => a.timeMs - b.timeMs || a.type.localeCompare(b.type) || String(a.victimId ?? '').localeCompare(String(b.victimId ?? '')));
    const groups = new Map();
    for (const e of events) { if (!groups.has(e.timeMs)) groups.set(e.timeMs, []); groups.get(e.timeMs).push(e); }
    const alive = new Set(recovered?tracking.initialAliveIds:roster.map(p => p.id)), initial = [0, 1].map(t => roster.filter(p => p.team === t).length);
    let leftIds=recovered?[...tracking.initialLeftIds]:[];
    let pendingIds=recovered?[...tracking.initialPendingIds]:[];
    const trackedStates=new Map(recovered?tracking.transitions.map(t=>[t.timeMs,t]):[]);
    let bomb = 'none';
    const initialScore = [...score], scoreAvailable = scoreKnown;
    const snapshots = [{ timeMs: 0, aliveIds: [...alive], leftIds:[...leftIds], pendingIds:[...pendingIds], bomb, score: [...score] }];
    for (const [timeMs, group] of groups) {
      const kills = group.filter(e => e.type === 'kill'), bombs = group.filter(e => ['plant','explode','defuse','drop'].includes(e.type));
      // Grenades and delayed hit records can credit a dead attacker. Only the
      // victim's recorded death changes survivors; do not infer firing time.
      if(recovered){
        const tracked=trackedStates.get(timeMs);
        if(tracked){alive.clear();for(const id of tracked.aliveIds)alive.add(id);leftIds=[...tracked.leftIds];pendingIds=[...tracked.pendingIds];}
      }else{
        if (kills.some(e => !alive.has(e.victimId))) { aliveVerified = false; reasons.add('invalid-alive-order'); }
        // Equal-time eliminations are one simultaneous batch, never a made-up order.
        for (const e of kills) alive.delete(e.victimId);
      }
      if (bombs.length > 1) { bombVerified = false; reasons.add('ambiguous-bomb-order'); }
      for (const e of bombs) {
        if (e.type === 'plant') { if (!['none', 'dropped'].includes(bomb)) { bombVerified = false; reasons.add('invalid-bomb-order'); } bomb = 'planted'; }
        if (e.type === 'defuse' || e.type === 'explode') { if (bomb !== 'planted') { bombVerified = false; reasons.add('invalid-bomb-order'); } bomb = e.type === 'defuse' ? 'defused' : 'exploded'; }
        if (e.type === 'drop') { if (['none', 'dropped'].includes(bomb)) bomb = 'dropped'; else { bombVerified = false; reasons.add('invalid-bomb-order'); } }
      }
      snapshots.push({ timeMs, aliveIds: [...alive], leftIds:[...leftIds], pendingIds:[...pendingIds], bomb, score: [...score] });
    }
    if (team(winner)) score[winner] += 1; else scoreKnown = false;
    const endMatchState = roundMatchState ? advanceMatchWinState(roundMatchState, winner) : null;
    if (matchEstimate) { matchState = endMatchState; if (!matchState) ruleKnown = false; }
    snapshots.push({ timeMs: durationMs, aliveIds: [...alive], leftIds:[...leftIds], pendingIds:[...pendingIds], bomb, score: [...score] });
    const indexVerified = aliveVerified && bombVerified && scoreAvailable && team(offense) && initial.every(n => n > 0)
      && (!matchEstimate || !!roundMatchState && !!endMatchState);
    if (matchEstimate && !roundMatchState) reasons.add('unknown-match-rule-state');
    const points = snapshots.map((s, pointIndex) => {
      const survivors = [0, 1].map(t => s.aliveIds.filter(id => byId.get(id)?.team === t).length);
      const ended = pointIndex === snapshots.length - 1;
      const state = ended ? endMatchState : roundMatchState;
      let indexA = null;
      if (indexVerified) {
        indexA = matchEstimate
          ? estimateMatchWinChance(state, ended ? 0.5 : estimateCurrentRoundChance(survivors, initial, s.bomb, offense))
          : calculateSituationIndex(survivors, initial, s.score, s.bomb, offense);
        if (indexA !== null) indexA = Math.round((matchEstimate && state.phase !== 'finished'
          ? Math.max(0.1, Math.min(99.9, indexA)) : indexA) * 10) / 10;
      }
      return { ...s, indexA, phase: matchEstimate ? state?.phase ?? 'unknown' : null };
    });
    const round = { index, no: ids[index], startMs: offset, endMs: offset + durationMs, durationMs, offense, winner,
      roster, initial, initialScore, scoreKnown: scoreAvailable, aliveVerified, bombVerified, indexVerified,
      participantTracking:recovered?'recorded':'standard',
      status: indexVerified ? 'complete' : 'partial', reasons: [...reasons], events, points };
    offset += durationMs;
    return round;
  });
  return { status: 'ready', metric: matchEstimate ? 'match-estimate' : 'situation', durationMs: offset, rounds, verifiedRounds: rounds.filter(r => r.indexVerified).length };
}

export function getPlaybackFrame(model, elapsedMs, preferredRoundNo = null) {
  if (model.status !== 'ready' || !Number.isFinite(elapsedMs)) return null;
  const timeMs = Math.max(0, Math.min(model.durationMs, elapsedMs));
  // Evidence can refer to an exact round end. Keep that round at the shared
  // boundary; ordinary seeking and subsequent playback still enter the next.
  const round = model.rounds.find(r => r.no === preferredRoundNo && timeMs >= r.startMs && timeMs <= r.endMs)
    || model.rounds.find(r => timeMs < r.endMs) || model.rounds.at(-1);
  const localMs = timeMs - round.startMs;
  let state = round.points[0]; for (const point of round.points) { if (point.timeMs > localMs) break; state = point; }
  const visibleEvents = getPlaybackEventWindow(round, localMs);
  return { timeMs, localMs, round, score: round.scoreKnown ? state.score : null,
    alive: round.aliveVerified ? [0, 1].map(t => round.roster.filter(p => p.team === t && state.aliveIds.includes(p.id)).length) : null,
    aliveIds: round.aliveVerified ? state.aliveIds : null, leftIds:round.aliveVerified?state.leftIds:[], bomb: round.bombVerified ? state.bomb : 'unknown',
    pendingIds:round.aliveVerified?state.pendingIds:[],
    phase: state.phase, indexA: state.indexA, events: visibleEvents.events, eventCount: visibleEvents.count,
    finished: timeMs === model.durationMs };
}

// Match local key-moment anchors to recorded events, never to display text.
// Missing survivor verification does not prevent reading a recorded kill/death;
// playback continues to withhold any unverified survivor counts or graph values.
export function resolvePlaybackMomentTarget(model, moment, playerId) {
  if (model?.status !== 'ready' || !Number.isSafeInteger(moment?.round)) return null;
  const round = model.rounds.find(r => r.no === moment.round);
  const anchor = moment.playbackAnchor;
  if (!round || typeof anchor?.timeSeconds !== 'number' || !Number.isFinite(anchor.timeSeconds)
    || anchor.timeSeconds < 0 || anchor.timeSeconds * 1000 > round.durationMs
    || round.roster.filter(p => p.id === playerId).length !== 1) return null;
  const anchorMs = Math.round(anchor.timeSeconds * 1000);
  const events = round.events.filter(event => event.timeMs === anchorMs);
  let matches = false;
  if (anchor.type === 'kill') matches = events.some(event => event.type === 'kill' && event.attackerId === playerId);
  if (anchor.type === 'death') matches = events.some(event => ['kill', 'bomb-death'].includes(event.type) && event.victimId === playerId);
  if (anchor.type === 'round-end') matches = anchorMs === round.durationMs;
  if (anchor.type === 'alone' && events.length && round.aliveVerified) {
    const frame = getPlaybackFrame(model, round.startMs + anchorMs, round.no);
    const side = round.roster.find(p => p.id === playerId).team;
    matches = team(side) && frame.aliveIds?.includes(playerId) && frame.alive[side] === 1 && frame.alive[1 - side] > 0;
  }
  if (!matches) return null;
  return { roundNo: round.no, localMs: Math.max(0, anchorMs - 5000), anchorMs };
}

// Resolve trusted local review evidence against this file's playback. No AI
// prose, imported timestamp or nickname supplies a navigation target.
export function resolvePlaybackReviewTarget(model, candidate, playerId) {
  if (model?.status !== 'ready' || !Number.isSafeInteger(candidate?.round)
    || candidate.evidenceId !== `round-${candidate.round}`) return null;
  const round = model.rounds.find(r => r.no === candidate.round);
  const seconds = candidate.flow?.anchor?.timeSeconds;
  if (!round?.aliveVerified || typeof seconds !== 'number' || !Number.isFinite(seconds)
    || seconds < 0 || seconds * 1000 > round.durationMs) return null;
  const players = round.roster.filter(p => p.id === playerId);
  if (players.length !== 1 || !team(players[0].team)) return null;
  const side = players[0].team, localMs = Math.round(seconds * 1000);
  let before = round.points[0], after = before;
  for (const point of round.points) {
    if (point.timeMs < localMs) before = point;
    if (point.timeMs <= localMs) after = point;
  }
  const matches = (ids, expected) => expected && [side, 1-side].every((t,i) =>
    round.roster.filter(p => p.team === t && ids.includes(p.id)).length === expected[i === 0 ? 'own' : 'enemy']);
  if (!matches(round.roster.map(p => p.id), candidate.flow.initialAlive)
    || !matches(before.aliveIds, candidate.flow.anchor.before)
    || !matches(after.aliveIds, candidate.flow.anchor.after)) return null;
  return { roundNo: round.no, localMs };
}

// A detached display projection only: never copy player IDs, positions, raw
// timelines or file metadata into the image/share model.
export function createReplayPlaybackShare(model, elapsedMs, preferredRoundNo = null) {
  const frame=getPlaybackFrame(model,elapsedMs,preferredRoundNo);if(!frame)return null;
  return {metric:model.metric,durationMs:model.durationMs,rounds:model.rounds.map(r=>({no:r.no,startMs:r.startMs,endMs:r.endMs,
    verified:r.indexVerified,points:r.indexVerified?r.points.map(p=>({timeMs:r.startMs+p.timeMs,indexA:p.indexA})):[]})),
    scene:{roundNo:frame.round.no,localMs:frame.localMs,timeMs:frame.timeMs,
      phase:frame.phase,score:frame.score?[...frame.score]:null,alive:frame.alive?[...frame.alive]:null,indexA:frame.indexA,bomb:frame.bomb,
      events:frame.events.slice(0,2).map(e=>e.type==='kill'?{type:e.type,timeMs:e.timeMs,attacker:e.attacker,victim:e.victim,weapon:e.weapon}
        :e.type==='bomb-death'?{type:e.type,timeMs:e.timeMs,victim:e.victim}
        :{type:e.type,timeMs:e.timeMs,actor:e.actor})}};
}

// Use stable IDs, never a nickname match: disguises and duplicate names are
// allowed. Filter before truncation so unrelated recent events hide no matches.
export function getPlaybackEventWindow(round, localMs, playerId = null) {
  const matching = round.events.filter(e => playerId === null || (e.type === 'kill'
    ? e.attackerId === playerId || e.victimId === playerId : e.type==='bomb-death'?e.victimId===playerId:e.actorId === playerId));
  const occurred = matching.filter(e => e.timeMs <= localMs);
  return { events: occurred.slice(-12).reverse(), count: occurred.length, total: matching.length };
}

// Retrospective bookmarks, not live predictions or a causal assessment.
// Keep one event batch per round so a busy round cannot fill every slot.
export function findPlaybackTurningPoints(model) {
  if (model?.status !== 'ready') return [];
  const candidates = [];
  for (const round of model.rounds) {
    if (!round.indexVerified) continue;
    let best = null;
    // The last snapshot applies the recorded winner: never label that score
    // update (or a round reset) as an event-driven swing.
    for (let i = 1; i < round.points.length - 1; i++) {
      const point = round.points[i], before = round.points[i - 1];
      if (point.timeMs <= 0 || point.timeMs >= round.durationMs || point.indexA === null || before.indexA === null) continue;
      const deltaA = Math.round((point.indexA - before.indexA) * 10) / 10;
      const magnitude = Math.abs(deltaA);
      if (magnitude < 8 || best && best.magnitude >= magnitude) continue;
      best = { roundNo: round.no, localMs: point.timeMs, timeMs: round.startMs + point.timeMs,
        seekMs: round.startMs + Math.max(0, point.timeMs - 5000), deltaA, magnitude,
        events: round.events.filter(e => e.timeMs === point.timeMs) };
    }
    if (best) candidates.push(best);
  }
  return candidates.sort((a, b) => b.magnitude - a.magnitude || a.timeMs - b.timeMs)
    .slice(0, 3).sort((a, b) => a.timeMs - b.timeMs);
}
