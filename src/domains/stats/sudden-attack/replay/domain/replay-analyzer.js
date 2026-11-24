import { analyzeRoundContext, summarizeReplayContext, getContextInsights } from './replay-context.js';
import { buildReplayCoachingEvidence } from './replay-coaching-evidence.js';

const MAX_BYTES = 2 * 1024 * 1024;

// Explicit opt-in keeps free analysis and its v1 evidence byte-for-byte stable.
// Loading the paid review preparer does not call an API or grant access.
export async function analyzeReplayForCoaching(parsed, playerId) {
  const { buildReplayCoachingReview } = await import('./replay-coaching-review.js');
  return buildReplayCoachingReview(analyzeReplay(parsed, playerId));
}
const list = (value) => Array.isArray(value) ? value : [];
const num = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const same = (a, b) => String(a) === String(b);
const seconds = (timestamp) => num(timestamp) / 10;
const estimatedDistanceLabel = (coordinateDistance) => {
  const meters = num(coordinateDistance) / 100;
  if (meters < 1) return '1m 미만';
  return `약 ${Math.round(meters).toLocaleString('ko-KR')}m`;
};

function distance(a, b) {
  if (!a || !b) return null;
  const coordinates = [a.posX, a.posY, b.posX, b.posY];
  if (coordinates.some((value) => value === null || value === '' || !Number.isFinite(Number(value)))) return null;
  return Math.round(Math.hypot(Number(a.posX) - Number(b.posX), Number(a.posY) - Number(b.posY)));
}

function stateAt(character, timestamp) {
  let result = list(character?.replayCharacterStateInfo)[0] || null;
  for (const state of list(character?.replayCharacterStateInfo)) {
    if (num(state.timeStamp) > timestamp) break;
    result = state;
  }
  return result;
}

export function validateReplayFile(file) {
  if (!file) throw new Error('FILE_REQUIRED');
  if (!String(file.name || '').toLowerCase().endsWith('.json')) throw new Error('JSON_ONLY');
  if (num(file.size) > MAX_BYTES) throw new Error('FILE_TOO_LARGE');
}

export function parseReplayText(text) {
  if (typeof text !== 'string' || !text.trim()) throw new Error('EMPTY_FILE');
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw new Error('INVALID_JSON'); }
  const replay = parsed?.replay_info;
  if (!replay?.replayMatchSummaryInfo || !Array.isArray(replay.replayCharacterSummaryInfo)
    || !replay.replayCharacterSummaryInfo.some((player) => player?.nexonSN != null)) {
    throw new Error('UNSUPPORTED_REPLAY');
  }
  return parsed;
}

export function getReplayPlayers(parsed) {
  return list(parsed?.replay_info?.replayCharacterSummaryInfo)
    .filter((p) => p?.nexonSN != null)
    .map((p) => ({
    nexonSN: String(p.nexonSN), nickName: p.nickName || '이름 없음',
    clanName: p.clanName || '', teamNo: num(p.teamNo), kill: num(p.kill),
    death: num(p.death), assist: num(p.assist), damage: num(p.damage)
    }));
}

function analyzeRound(round, player, players) {
  const attacks = list(round.replayAttackInfo);
  const byTimestamp = (a, b) => num(a.timeStamp) - num(b.timeStamp);
  const kills = attacks.filter((e) => same(e.attackerNexonSN, player.nexonSN)).sort(byTimestamp);
  const death = attacks.filter((e) => same(e.victimNexonSN, player.nexonSN)).sort(byTimestamp)[0] || null;
  const roundSummaries = list(round.replayRoundSummaryInfo);
  const playerRoundSummary = roundSummaries.find((entry) => same(entry.nexonSN, player.nexonSN));
  const playerTeamNo = num(playerRoundSummary?.teamNo, player.teamNo);
  const character = list(round.replayCharacterInfo).find((e) => same(e.nexonSN, player.nexonSN));
  const teammateDistances = death ? list(round.replayCharacterInfo)
    .filter((entry) => {
      if (same(entry.nexonSN, player.nexonSN)) return false;
      const matchSummary = players.find((p) => same(p.nexonSN, entry.nexonSN));
      const roundSummary = roundSummaries.find((candidate) => same(candidate.nexonSN, entry.nexonSN));
      const teammateTeamNo = num(roundSummary?.teamNo, matchSummary?.teamNo);
      if (teammateTeamNo !== playerTeamNo) return false;
      const teammateState = stateAt(entry, num(death.timeStamp));
      const diedBeforePlayer = attacks.some((event) =>
        same(event.victimNexonSN, entry.nexonSN)
        && num(event.timeStamp) <= num(death.timeStamp)
      );
      return teammateState && num(teammateState.state, 1) !== 2 && !diedBeforePlayer;
    })
    .map((entry) => distance(
      { posX: death.victimPosX, posY: death.victimPosY },
      stateAt(entry, num(death.timeStamp))
    )).filter(Number.isFinite).sort((a, b) => a - b) : [];
  return {
    round: num(round.no), won: num(round.winTeam) === playerTeamNo,
    context: analyzeRoundContext(round, player.nexonSN),
    offense: num(round.offenseTeam) === playerTeamNo,
    playTimeSeconds: num(round.playTime),
    survivalSeconds: death ? seconds(death.timeStamp) : num(round.playTime),
    kills: kills.map((e) => ({
      timeSeconds: seconds(e.timeStamp), victim: e.victimNickName || '상대',
      weapon: e.itemName || '알 수 없는 무기',
      distance: distance({ posX: e.attackerPosX, posY: e.attackerPosY }, { posX: e.victimPosX, posY: e.victimPosY })
    })),
    death: death ? {
      timeSeconds: seconds(death.timeStamp), attacker: death.attackerNickName || '상대',
      weapon: death.itemName || '알 수 없는 무기',
      distance: distance({ posX: death.attackerPosX, posY: death.attackerPosY }, { posX: death.victimPosX, posY: death.victimPosY }),
      nearestTeammateDistance: teammateDistances[0] ?? null
    } : null,
    throws: list(round.replayThrowWeaponEventInfo).filter((e) => same(e.nexonSN, player.nexonSN)).sort(byTimestamp).map((e) => ({
      timeSeconds: seconds(e.timeStamp), weapon: e.itemName || '투척물',
      travelDistance: distance({ posX: e.firePosX, posY: e.firePosY }, { posX: e.posX, posY: e.posY })
    }))
  };
}

function insights(analysis) {
  const result = [];
  const killsBeforeDeath = (round) => round.death
    ? round.kills.filter((kill) => kill.timeSeconds <= round.death.timeSeconds)
    : round.kills;
  const quick = analysis.rounds.filter((round) => {
    const priorKills = killsBeforeDeath(round);
    if (!round.death || !priorKills.length) return false;
    const gap = round.death.timeSeconds - priorKills.at(-1).timeSeconds;
    return gap >= 0 && gap <= 5;
  });
  if (analysis.player.damage) result.push({ tone: 'neutral', title: '이번 경기 교전 기록', body: `총 ${analysis.player.damage.toLocaleString('ko-KR')} 피해와 ${analysis.player.assist}개의 도움을 기록했습니다.` });
  const active = analysis.rounds.filter((round) => killsBeforeDeath(round).length);
  if (active.length) result.push({ tone: 'good', title: '처치 기록이 있는 라운드', body: `${active.map((r) => `${r.round}라운드`).join(', ')}에서 처치를 기록했습니다.` });
  if (quick.length) result.push({ tone: 'warn', title: '처치 직후 생존 점검', body: `${quick.map((r) => `${r.round}라운드`).join(', ')}에서 마지막 처치 후 5초 안에 사망했습니다.` });
  else result.push({ tone: 'good', title: '라운드 생존', body: `${analysis.rounds.filter((r) => !r.death).length}개 라운드를 생존으로 마쳤습니다.` });
  return [...getContextInsights(analysis.contextSummary), ...result].slice(0, 3);
}

export function getKeyMoments(analysis) {
  const rounds = analysis.rounds;
  if (!rounds.length) return [];
  const scored = [...rounds].sort((a, b) =>
    (b.kills.length * 3 + Number(!b.death) + Number(b.won))
    - (a.kills.length * 3 + Number(!a.death) + Number(a.won))
  );
  const hasKills = rounds.some((round) => round.kills.length);
  const best = hasKills ? scored[0] : [...rounds].sort((a, b) => b.survivalSeconds - a.survivalSeconds)[0];
  const moments = [{
    tone: 'good',
    label: '주목할 장면',
    round: best.round,
    playbackAnchor: hasKills
      ? { type: 'kill', timeSeconds: Math.min(...best.kills.map(kill => kill.timeSeconds)) }
      : best.death ? { type: 'death', timeSeconds: best.death.timeSeconds }
        : { type: 'round-end', timeSeconds: best.playTimeSeconds },
    title: hasKills ? `${best.round}라운드 ${best.kills.length}킬` : `${best.round}라운드 최장 생존`,
    body: hasKills
      ? `${best.won ? '승리' : '패배'} 라운드에서 ${best.kills.length}킬을 기록하고 ${best.death ? `${best.survivalSeconds.toFixed(1)}초 생존했습니다.` : '끝까지 생존했습니다.'}`
      : `${best.won ? '승리' : '패배'} 라운드에서 ${best.death ? `${best.survivalSeconds.toFixed(1)}초 생존했습니다.` : '끝까지 생존했습니다.'}`
  }];
  const openingDeath = analysis.contextSummary?.openingDeaths[0];
  const alone = [...(analysis.contextSummary?.aloneSituations || [])]
    .sort((a, b) => b.opponentAlive - a.opponentAlive || a.round - b.round)[0];
  if (openingDeath) {
    moments.push({ tone: 'review', label: '먼저 복기할 장면', round: openingDeath.round,
      playbackAnchor: { type: 'death', timeSeconds: openingDeath.timeSeconds },
      title: `${openingDeath.round}라운드 첫 사망${openingDeath.simultaneous ? ' 시점' : ''}`,
      body: `${openingDeath.timeSeconds.toFixed(1)}초, ${openingDeath.own}대${openingDeath.enemy}에서 사망했습니다. 사망 시점의 전후 기록을 확인해 보세요.` });
    return moments;
  }
  if (alone && best.round !== alone.round) {
    moments.push({ tone: 'review', label: '상황을 함께 볼 장면', round: alone.round,
      playbackAnchor: { type: 'alone', timeSeconds: alone.timeSeconds },
      title: `${alone.round}라운드 1대${alone.opponentAlive} 상황`,
      body: `${alone.timeSeconds.toFixed(1)}초부터 혼자 남았습니다. 라운드 결과는 ${alone.roundWon ? '승리' : '패배'}이며, 직전 인원 변화를 확인해 보세요.` });
    return moments;
  }
  const quickDeaths = rounds.flatMap((round) => {
    if (!round.death) return [];
    const priorKills = round.kills.filter((kill) => kill.timeSeconds <= round.death.timeSeconds);
    if (!priorKills.length) return [];
    const gap = round.death.timeSeconds - priorKills.at(-1).timeSeconds;
    return gap >= 0 && gap <= 5 ? [{ round, gap }] : [];
  }).sort((a, b) => a.gap - b.gap);
  if (quickDeaths.length) {
    const { round, gap } = quickDeaths[0];
    moments.push({
      tone: 'review',
      label: '다시 볼 장면',
      round: round.round,
      playbackAnchor: { type: 'death', timeSeconds: round.death.timeSeconds },
      title: `${round.round}라운드 처치 직후 사망`,
      body: `마지막 처치 후 ${gap.toFixed(1)}초 뒤 사망했습니다. 처치 직후 위치와 팀 간격을 다시 확인해 보세요.`
    });
  } else {
    const earliestDeath = rounds.filter((round) => round.death).sort((a, b) => a.death.timeSeconds - b.death.timeSeconds)[0];
    if (earliestDeath) moments.push({
      tone: 'review',
      label: '다시 볼 장면',
      round: earliestDeath.round,
      playbackAnchor: { type: 'death', timeSeconds: earliestDeath.death.timeSeconds },
      title: `${earliestDeath.round}라운드 가장 이른 사망`,
      body: `${earliestDeath.death.timeSeconds.toFixed(1)}초에 사망했습니다. 첫 교전까지의 이동과 합류 흐름을 확인해 보세요.`
    });
  }
  return moments;
}

export function analyzeReplay(parsed, playerId) {
  const replay = parsed.replay_info;
  const players = getReplayPlayers(parsed);
  const player = players.find((p) => same(p.nexonSN, playerId));
  if (!player) throw new Error('PLAYER_NOT_FOUND');
  const summary = replay.replayMatchSummaryInfo;
  const rounds = list(replay.replayRoundInfo).map((r) => analyzeRound(r, player, players));
  const throwWindows = rounds.flatMap((round) =>
    round.throws.map((throwEvent) => ({ ...throwEvent, round: round.round }))
  );
  const postThrowKills = rounds.reduce((total, round) => total + round.kills.filter((kill) =>
    round.throws.some((throwEvent) => kill.timeSeconds >= throwEvent.timeSeconds && kill.timeSeconds <= throwEvent.timeSeconds + 5)
  ).length, 0);
  const postThrowDeaths = rounds.filter((round) => round.death && round.throws.some((throwEvent) =>
    round.death.timeSeconds >= throwEvent.timeSeconds && round.death.timeSeconds <= throwEvent.timeSeconds + 5
  )).length;
  const average = (values) => values.length ? Math.round(values.reduce((total, value) => total + value, 0) / values.length) : null;
  const killDistances = rounds.flatMap((round) => round.kills.map((kill) => kill.distance)).filter(Number.isFinite);
  const deathDistances = rounds.map((round) => round.death?.distance).filter(Number.isFinite);
  const weaponDistanceGroups = new Map();
  for (const kill of rounds.flatMap((round) => round.kills)) {
    if (!Number.isFinite(kill.distance)) continue;
    const values = weaponDistanceGroups.get(kill.weapon) || [];
    values.push(kill.distance);
    weaponDistanceGroups.set(kill.weapon, values);
  }
  const averageSurvival = (selectedRounds) => selectedRounds.length
    ? selectedRounds.reduce((total, round) => total + round.survivalSeconds, 0) / selectedRounds.length
    : null;
  const averageSurvivalRate = (selectedRounds) => {
    const values = selectedRounds.filter((round) => round.playTimeSeconds > 0)
      .map((round) => Math.max(0, Math.min(100, round.survivalSeconds / round.playTimeSeconds * 100)));
    return values.length ? values.reduce((total, value) => total + value, 0) / values.length : null;
  };
  const analysis = {
    match: { id: String(summary.matchID), mapName: summary.mapName || '알 수 없는 맵',
      date: summary.matchDate || '', score: `${num(summary.teamAWinCnt)} : ${num(summary.teamBWinCnt)}`,
      won: num(summary.winTeam) === player.teamNo },
    player, rounds, contextSummary: summarizeReplayContext(rounds),
    totals: { throws: rounds.reduce((n, r) => n + r.throws.length, 0),
      averageSurvivalSeconds: averageSurvival(rounds) ?? 0,
      survivalBySide: {
        offense: averageSurvival(rounds.filter((round) => round.offense)),
        defense: averageSurvival(rounds.filter((round) => !round.offense))
      },
      survivalRateBySide: {
        offense: averageSurvivalRate(rounds.filter((round) => round.offense)),
        defense: averageSurvivalRate(rounds.filter((round) => !round.offense))
      },
      survivalByResult: {
        won: averageSurvival(rounds.filter((round) => round.won)),
        lost: averageSurvival(rounds.filter((round) => !round.won))
      },
      survivalRateByResult: {
        won: averageSurvivalRate(rounds.filter((round) => round.won)),
        lost: averageSurvivalRate(rounds.filter((round) => !round.won))
      },
      longestSurvivalRound: [...rounds].sort((a, b) => b.survivalSeconds - a.survivalSeconds)[0] || null,
      throwUsage: {
        offense: rounds.filter((round) => round.offense).reduce((total, round) => total + round.throws.length, 0),
        defense: rounds.filter((round) => !round.offense).reduce((total, round) => total + round.throws.length, 0),
        roundsWithoutThrow: rounds.filter((round) => !round.throws.length).map((round) => round.round),
        first: [...throwWindows].sort((a, b) => a.round - b.round || a.timeSeconds - b.timeSeconds)[0] || null,
        killsWithinFiveSeconds: postThrowKills,
        deathsWithinFiveSeconds: postThrowDeaths
      },
      combatDistance: {
        averageKill: average(killDistances),
        averageDeath: average(deathDistances),
        longestKill: killDistances.length ? Math.max(...killDistances) : null,
        killSampleSize: killDistances.length,
        deathSampleSize: deathDistances.length,
        byWeapon: [...weaponDistanceGroups].map(([weapon, values]) => ({
          weapon, count: values.length, average: average(values)
        })).sort((a, b) => b.count - a.count || b.average - a.average)
      },
      teammateSpacing: {
        offense: average(rounds.filter((round) => round.offense).map((round) => round.death?.nearestTeammateDistance).filter(Number.isFinite)),
        defense: average(rounds.filter((round) => !round.offense).map((round) => round.death?.nearestTeammateDistance).filter(Number.isFinite))
      }
    }
  };
  analysis.insights = insights(analysis);
  analysis.coachingEvidence = buildReplayCoachingEvidence(analysis);
  return analysis;
}

export function getDetailAnalysis(analysis, type) {
  const rounds = analysis.rounds;
  if (type === 'DEATHS') {
    const deaths = rounds.filter((r) => r.death);
    return { title: '사망 장면 분석', items: deaths.length ? deaths.map((r) => {
      const priorKills = r.kills.filter((kill) => kill.timeSeconds <= r.death.timeSeconds);
      const gap = priorKills.length ? r.death.timeSeconds - priorKills.at(-1).timeSeconds : null;
      const context = r.context?.status === 'complete' ? r.context : null;
      const situation = context?.death ? ` 당시 생존 인원은 ${context.death.own}대${context.death.enemy}였습니다.${context.death.opening ? ` 라운드의 첫 사망${context.death.simultaneous ? ' 시점에 포함됩니다' : '입니다'}.` : ''}` : '';
      const traded = context?.tradesReceived[0];
      return `${r.round}라운드 ${r.death.timeSeconds.toFixed(1)}초, ${r.death.attacker}의 ${r.death.weapon}에 사망했습니다.${situation}${traded ? ` 자신을 처치한 상대를 팀원이 ${traded.gapSeconds.toFixed(1)}초 뒤 처치한 교환킬 후보입니다.` : ''}${gap !== null ? ` 마지막 처치 후 ${gap.toFixed(1)}초 뒤였습니다.` : ''}${r.death.nearestTeammateDistance !== null ? ` 가장 가까운 생존 팀원과 ${estimatedDistanceLabel(r.death.nearestTeammateDistance)} 거리로 추정됩니다.` : ''}`;
    }) : ['이 경기에서는 사망 기록이 없습니다.'] };
  }
  if (type === 'TEAMPLAY') {
    const values = rounds.map((r) => r.death?.nearestTeammateDistance).filter(Number.isFinite);
    const avg = values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;
    const sideItems = [
      analysis.totals.teammateSpacing.offense === null ? null : `공격 라운드 사망 시 생존 팀원 간격은 평균 ${estimatedDistanceLabel(analysis.totals.teammateSpacing.offense)}로 추정됩니다.`,
      analysis.totals.teammateSpacing.defense === null ? null : `수비 라운드 사망 시 생존 팀원 간격은 평균 ${estimatedDistanceLabel(analysis.totals.teammateSpacing.defense)}로 추정됩니다.`
    ].filter(Boolean);
    return { title: '팀플레이 분석', items: avg === null ? ['평가할 데이터가 충분하지 않습니다.'] : [`사망 시 가장 가까운 생존 팀원과의 평균 거리는 ${estimatedDistanceLabel(avg)}인 것으로 추정됩니다.`, ...sideItems, '거리 값은 리플레이 좌표에서 100좌표를 약 1m로 가정해 환산했습니다. 실제 게임 내 거리와 차이가 있을 수 있습니다.'] };
  }
  if (type === 'COMBAT') {
    const combat = analysis.totals.combatDistance;
    const items = [
      combat.averageKill === null ? '좌표가 기록된 처치가 없습니다.' : `좌표가 있는 ${combat.killSampleSize}회 처치의 평균 직선거리는 ${estimatedDistanceLabel(combat.averageKill)}로 추정됩니다.`,
      combat.averageDeath === null ? '좌표가 기록된 사망이 없습니다.' : `좌표가 있는 ${combat.deathSampleSize}회 사망의 평균 직선거리는 ${estimatedDistanceLabel(combat.averageDeath)}로 추정됩니다.`,
      combat.longestKill === null ? null : `가장 먼 처치 직선거리는 ${estimatedDistanceLabel(combat.longestKill)}로 추정됩니다.`,
      ...combat.byWeapon.map((entry) => `${entry.weapon}: 좌표가 있는 ${entry.count}회 처치의 평균 직선거리 ${estimatedDistanceLabel(entry.average)}.`)
    ].filter(Boolean);
    return { title: '교전 거리 분석', items };
  }
  if (type === 'THROWS') {
    const used = rounds.flatMap((r) => r.throws.map((e) => ({ ...e, round: r.round })));
    return { title: '투척물 분석', items: used.length ? used.map((e) => `${e.round}라운드 ${e.timeSeconds.toFixed(1)}초에 ${e.weapon}을 사용했습니다.${e.travelDistance !== null ? ` 시작점과 도착점의 직선거리는 ${estimatedDistanceLabel(e.travelDistance)}인 것으로 추정됩니다.` : ''}`) : ['투척물 기록이 없습니다.'] };
  }
  if (type === 'BEST_ROUND') {
    const best = [...rounds].sort((a, b) => (b.kills.length * 3 + !b.death + b.won) - (a.kills.length * 3 + !a.death + a.won))[0];
    return { title: '가장 좋았던 라운드', items: best ? [`${best.round}라운드: ${best.kills.length}킬, ${best.death ? '사망' : '생존'}, 팀 ${best.won ? '승리' : '패배'}였습니다.`] : ['라운드 데이터가 없습니다.'] };
  }
  return { title: '지원하지 않는 분석 항목', items: ['다른 분석 항목을 선택해 주세요.'] };
}
