/** Settlement rules operate on plain records; no database or browser access. */
export const CREW_SETTLEMENT_POLICY = Object.freeze({
  historyLimit: 50,
  sessionLookbackMs: 6 * 60 * 60 * 1000,
  minSessionOverlap: 6,
  abandonMmrPenalty: -30,
  abandonHsrPenalty: -20
});

export function toDateSafe(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value?.toDate === 'function') {
    const converted = value.toDate();
    return Number.isNaN(converted?.getTime?.()) ? null : converted;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getMatchPresenceSet(match, memberCache = {}, nameMap = {}) {
  const present = new Set();
  const players = Array.isArray(match?.allPlayerStats) ? match.allPlayerStats : [];
  players.forEach((player) => {
    const nickname = String(player?.nickname || "").toLowerCase().trim();
    if (player?.ouid && memberCache[player.ouid]) present.add(player.ouid);
    const byName = nickname ? nameMap[nickname] : null;
    if (byName?.ouid) present.add(byName.ouid);
  });
  return present;
}

export function findPendingSessionForMatch(match, pendingSessions = [], memberCache = {}, nameMap = {}, usedSessionIds = new Set(), policy = CREW_SETTLEMENT_POLICY) {
  const matchDate = toDateSafe(match?.matchDate);
  if (!matchDate) return null;

  const present = getMatchPresenceSet(match, memberCache, nameMap);
  let best = null;

  pendingSessions.forEach((session) => {
    if (!session?.id || usedSessionIds.has(session.id)) return;
    const participants = Array.isArray(session.participants) ? session.participants.filter((item) => item?.ouid) : [];
    if (participants.length < 8) return;

    const createdAt = toDateSafe(session.createdAt);
    if (createdAt && matchDate.getTime() < createdAt.getTime()) return;
    if (createdAt && (matchDate.getTime() - createdAt.getTime()) > policy.sessionLookbackMs) return;

    const overlap = participants.filter((item) => present.has(item.ouid)).length;
    if (overlap < Math.min(policy.minSessionOverlap, participants.length)) return;

    const missing = participants.filter((item) => !present.has(item.ouid));
    if (missing.length === 0) return;

    const score = overlap * 100 - missing.length;
    const candidate = { session, overlap, missing, score };
    if (!best || candidate.score > best.score) best = candidate;
  });

  return best;
}

export function applyAbandonPenalty(memberData, matchDate, policy = CREW_SETTLEMENT_POLICY) {
  const { mmrDiff, hsrDiff } = applyManualAbandonToMember(memberData, matchDate, policy);
  return { mmrDiff, hsrDiff };
}

export function applyManualAbandonToMember(memberData, matchDate, policy = CREW_SETTLEMENT_POLICY) {
  memberData.mmr += policy.abandonMmrPenalty;
  memberData.hsr += policy.abandonHsrPenalty;
  memberData.loses += 1;
  memberData.mmrHistory.push({ mmr: memberData.mmr, hsr: memberData.hsr, date: matchDate });
  memberData.isDirty = true;
  return {
    mmrDiff: policy.abandonMmrPenalty,
    hsrDiff: policy.abandonHsrPenalty,
    newMmr: memberData.mmr,
    newHsr: memberData.hsr,
    loses: memberData.loses
  };
}

export function buildManualAbandonHistoryPatch(entries = [], baseHistory = {}) {
  const manualAbandonOuids = Array.isArray(baseHistory.manualAbandonOuids)
    ? [...baseHistory.manualAbandonOuids]
    : [];
  const manualAbandonNicknames = Array.isArray(baseHistory.manualAbandonNicknames)
    ? [...baseHistory.manualAbandonNicknames]
    : [];
  const legacyNames = new Set(manualAbandonOuids.length === 0 ? manualAbandonNicknames : []);
  const automaticOuids = new Set(baseHistory.abandonOuids || []);
  let addedCount = 0;

  entries.forEach((entry) => {
    const alreadyRecorded = entry?.ouid
      ? manualAbandonOuids.includes(entry.ouid)
        || legacyNames.has(entry.nickname) || automaticOuids.has(entry.ouid)
      : manualAbandonNicknames.includes(entry?.nickname);
    if (!alreadyRecorded && (entry?.ouid || entry?.nickname)) addedCount += 1;
    if (entry?.ouid && !manualAbandonOuids.includes(entry.ouid)) {
      manualAbandonOuids.push(entry.ouid);
    }
    if (entry?.nickname && !manualAbandonNicknames.includes(entry.nickname)) {
      manualAbandonNicknames.push(entry.nickname);
    }
  });

  return {
    abandonCount: Number(baseHistory.abandonCount || 0) + addedCount,
    manualAbandonOuids,
    manualAbandonNicknames
  };
}

/** Build an isolated write plan from the latest transaction snapshot on every retry.
 * Record arrays contain { id, data }. Input records and matches are never mutated.
 */
export function planCrewSettlement({ matches, season = {}, members = [], histories = [], sessions = [], manualEntries = [] }, policy = CREW_SETTLEMENT_POLICY) {
  const historyWrites = [], sessionUpdates = [], memberUpdates = [];
  const seasonStartDate = toDateSafe(season.startDate) || new Date(0);
  const memberCache = {};

  const nameMap = {};
  members.forEach(doc => {
    const data = doc.data;
    const cacheObj = {
      ouid: doc.id,
      characterName: data.characterName || "",
      mmr: data.mmr || 1200,
      hsr: data.hsr || data.mmr || 1200,
      wins: data.wins || 0,
      loses: data.loses || 0,
      crewKills: data.crewKills || 0,
      crewDeaths: data.crewDeaths || 0,
      mmrHistory: [...(data.mmrHistory || [])],
      isDirty: false
    };
    memberCache[doc.id] = cacheObj;
    if (data.characterName) nameMap[data.characterName.toLowerCase()] = cacheObj;
    if (data.previousNames) data.previousNames.forEach(n => nameMap[n.toLowerCase()] = cacheObj);
  });

  const historyDocs = histories;
  const settledSet = new Set(historyDocs.map(d => d.id));
  const historyStateMap = new Map(
    historyDocs.map((doc) => [doc.id, doc.data || {}])
  );
  const pendingSessions = sessions
    .map((doc) => ({ ...doc.data, id: doc.id }))
    .filter((session) => session.status === 'PENDING');
  const manualAbandons = manualEntries
    .map((doc) => ({ ...doc.data, id: doc.id }))
    .filter((entry) => entry.ouid && entry.matchId && entry.matchDate)
    .sort((a, b) => new Date(a.matchDate) - new Date(b.matchDate));
  const usedSessionIds = new Set();
  const settlementReports = [];
  const sortedMatches = [...matches].sort((a, b) => new Date(a.matchDate) - new Date(b.matchDate));

  for (const match of sortedMatches) {
    if (match.matchResult === 'DRAW' || match.allPlayerStats.some(p => p.result === 'DRAW')) continue;
    if (new Date(match.matchDate) < seasonStartDate) continue;
    if (settledSet.has(match.matchId)) continue;

    const playerChanges = [];
    const processedOuids = new Set();
    const matchedSession = findPendingSessionForMatch(match, pendingSessions, memberCache, nameMap, usedSessionIds, policy);

    for (const p of match.allPlayerStats) {
      if (!p.isCrew || (p.result !== 'WIN' && p.result !== 'LOSE')) continue;

      const currentData = p.ouid && memberCache[p.ouid] ? memberCache[p.ouid] : nameMap[p.nickname.toLowerCase()];
      if (!currentData) continue;
      if (processedOuids.has(currentData.ouid)) continue;
      processedOuids.add(currentData.ouid);

      const isWin = p.result === 'WIN';
      const kill = parseInt(p.kill || 0);
      const death = parseInt(p.death || 0);
      const kd = parseFloat(p.kd || 0);

      // --- 1. MMR 정산 (괴리 보정 시스템 적용) ---
      const gap = currentData.hsr - currentData.mmr;
      let gapWeight = 1.0;
      if (isWin) {
        if (gap >= 150) gapWeight = 1.5;      // 숨은 고수: 승리 시 1.5배 획득
        else if (gap >= 80) gapWeight = 1.2;  // 우수 실력: 승리 시 1.2배 획득
        else if (gap <= -150) gapWeight = 0.5; // 거품 유저: 승리 시 0.5배만 획득
        else if (gap <= -80) gapWeight = 0.8;  // 높은 점수: 승리 시 0.8배만 획득
      } else {
        if (gap <= -150) gapWeight = 1.5;     // 거품 유저: 패배 시 1.5배 하락
        else if (gap <= -80) gapWeight = 1.2; // 높은 점수: 패배 시 1.2배 하락
        else if (gap >= 150) gapWeight = 0.5; // 숨은 고수: 패배 시 0.5배만 하락
        else if (gap >= 80) gapWeight = 0.8;  // 우수 실력: 패배 시 0.8배만 하락
      }

      const mmrChange = isWin ? 20 : -20;
      let mmrBonus = 0;
      if (p.isMvp) mmrBonus += 3;
      if (p.damage >= 1500) mmrBonus += 2;
      if (p.headshot >= 7) mmrBonus += 2;
      mmrBonus = Math.min(5, mmrBonus);

      const finalMmrDiff = Math.round((mmrChange + mmrBonus) * gapWeight);
      currentData.mmr += finalMmrDiff;

      // --- 2. HSR 정산 (성적 기반 실력 지표) ---
      const hsrChange = isWin ? 10 : -10;
      let hsrBonus = 0;
      if (isWin) {
        // 승리했어도 성적이 너무 낮으면(K/D 0.4 이하) HSR 하락 (-10점)
        if (kd <= 0.4) hsrBonus = -20;
        else if (kd >= 1.0) hsrBonus = Math.min(15, Math.round((kd - 1.0) * 10));
      } else {
        if (kd >= 1.7) hsrBonus = 15; // 졌잘싸 보정
        else if (kd <= 1.0) hsrBonus = Math.max(-15, Math.round((kd - 1.0) * 15));
      }
      if ((kill + death) >= 8 && kd >= 0.8) hsrBonus += 2;
      const finalHsrDiff = hsrChange + hsrBonus;
      currentData.hsr += finalHsrDiff;

      if (isWin) currentData.wins += 1; else currentData.loses += 1;
      currentData.crewKills += kill;
      currentData.crewDeaths += death;
      currentData.mmrHistory.push({ mmr: currentData.mmr, hsr: currentData.hsr, date: match.matchDate });
      currentData.isDirty = true;

      playerChanges.push({
        nickname: p.nickname,
        originalResult: p.result,
        mmrDiff: finalMmrDiff,
        hsrDiff: finalHsrDiff,
        newMmr: currentData.mmr,
        newHsr: currentData.hsr
      });
    }

    let abandonCount = 0;
    const abandonOuids = [];
    if (matchedSession) {
      matchedSession.missing.forEach((missingMember) => {
        const currentData = memberCache[missingMember.ouid];
        if (!currentData || processedOuids.has(currentData.ouid)) return;
        const penalty = applyAbandonPenalty(currentData, match.matchDate, policy);
        abandonCount += 1;
        abandonOuids.push(currentData.ouid);
        processedOuids.add(currentData.ouid);
        playerChanges.push({
          nickname: missingMember.characterName || currentData.characterName || missingMember.ouid,
          originalResult: 'ABANDON',
          mmrDiff: penalty.mmrDiff,
          hsrDiff: penalty.hsrDiff,
          newMmr: currentData.mmr,
          newHsr: currentData.hsr
        });
      });
    }

    historyWrites.push({ id: match.matchId, data: {
      map: match.mapName,
      matchDate: match.matchDate,
      crewCount: match.crewParticipants.length,
      abandonCount,
      abandonOuids,
      matchedSessionId: matchedSession?.session?.id || null
    } });
    historyStateMap.set(match.matchId, {
      ...(historyStateMap.get(match.matchId) || {}),
      map: match.mapName,
      matchDate: match.matchDate,
      crewCount: match.crewParticipants.length,
      abandonCount,
      abandonOuids,
      matchedSessionId: matchedSession?.session?.id || null
    });
    if (matchedSession?.session?.id) {
      sessionUpdates.push({ id: matchedSession.session.id, data: { status: 'SETTLED', settledMatchId: match.matchId } });
      usedSessionIds.add(matchedSession.session.id);
    }
    settlementReports.push({ match, playerChanges });
    settledSet.add(match.matchId);
  }

  const manualAbandonsByMatch = new Map();
  manualAbandons.forEach((entry) => {
    if (new Date(entry.matchDate) < seasonStartDate) return;
    if (!settledSet.has(entry.matchId)) return;
    const currentData = memberCache[entry.ouid];
    const items = manualAbandonsByMatch.get(entry.matchId) || [];
    items.push(entry);
    manualAbandonsByMatch.set(entry.matchId, items);
    if (!currentData) return;
    // History receipts outlive the member's rolling 50-point trend array.
    // Season repair removes current match histories, allowing a fresh rebuild.
    const recorded = historyStateMap.get(entry.matchId) || {};
    const manualOuids = recorded.manualAbandonOuids || [];
    if ((recorded.abandonOuids || []).includes(entry.ouid) || manualOuids.includes(entry.ouid)
      || (manualOuids.length === 0 && (recorded.manualAbandonNicknames || []).includes(entry.nickname))) return;
    if ((currentData.mmrHistory || []).some((item) => item?.date === entry.matchDate)) return;
    applyManualAbandonToMember(currentData, entry.matchDate, policy);
  });

  manualAbandonsByMatch.forEach((entries, matchId) => {
    const baseHistory = historyStateMap.get(matchId) || {};
    const patch = buildManualAbandonHistoryPatch(entries, baseHistory);
    historyWrites.push({ id: matchId, data: patch, merge: true });
    historyStateMap.set(matchId, { ...baseHistory, ...patch });
  });

  for (const ouid in memberCache) {
    if (memberCache[ouid].isDirty) {
      const finalHistory = memberCache[ouid].mmrHistory.slice(-policy.historyLimit);
      memberUpdates.push({ id: ouid, data: {
        mmr: memberCache[ouid].mmr,
        hsr: memberCache[ouid].hsr,
        wins: memberCache[ouid].wins,
        loses: memberCache[ouid].loses,
        crewKills: memberCache[ouid].crewKills,
        crewDeaths: memberCache[ouid].crewDeaths,
        mmrHistory: finalHistory
      } });
    }
  }
  return { historyWrites, sessionUpdates, memberUpdates, reports: settlementReports };
}

export function planManualAbandon({ memberData, historyData, manualExists, resolvedOuid, nickname = '', matchId, reason, appliedBy = null }, policy = CREW_SETTLEMENT_POLICY) {
  const trimmedReason = String(reason || '').trim();
  if (!trimmedReason) throw new Error('적용 사유를 입력해주세요.');
  const matchDate = historyData.matchDate || "";
  if (!matchDate) throw new Error('선택한 경기의 날짜 정보가 없습니다.');

  const existingOuids = Array.isArray(historyData.manualAbandonOuids) ? historyData.manualAbandonOuids : [];
  if (manualExists) {
    throw new Error('이미 수동 탈주 패널티가 적용된 멤버입니다.');
  }
  if (existingOuids.includes(resolvedOuid)) {
    throw new Error('이미 수동 탈주 패널티가 적용된 멤버입니다.');
  }

  const currentHistory = Array.isArray(memberData.mmrHistory) ? [...memberData.mmrHistory] : [];
  if (currentHistory.some((entry) => entry?.date === matchDate)) {
    throw new Error('해당 경기 시각으로 이미 점수 기록이 있어 중복 적용할 수 없습니다.');
  }

  const nextMmr = Number(memberData.mmr || 1200) + policy.abandonMmrPenalty;
  const nextHsr = Number(memberData.hsr || memberData.mmr || 1200) + policy.abandonHsrPenalty;
  const nextLoses = Number(memberData.loses || 0) + 1;
  const nextHistory = currentHistory
    .concat([{ mmr: nextMmr, hsr: nextHsr, date: matchDate }])
    .slice(-policy.historyLimit);

  const manualNicknames = Array.isArray(historyData.manualAbandonNicknames) ? [...historyData.manualAbandonNicknames] : [];
  const targetName = nickname || memberData.characterName || "";
  if (targetName && !manualNicknames.includes(targetName)) manualNicknames.push(targetName);
  const manualOuids = [...existingOuids];
  if (!manualOuids.includes(resolvedOuid)) manualOuids.push(resolvedOuid);
  const manualReasons = Array.isArray(historyData.manualAbandonReasons) ? [...historyData.manualAbandonReasons] : [];
  manualReasons.push(trimmedReason);
  const manualAppliedByEmails = Array.isArray(historyData.manualAbandonAppliedByEmails) ? [...historyData.manualAbandonAppliedByEmails] : [];
  const appliedByEmail = String(appliedBy?.email || "").trim();
  if (appliedByEmail) manualAppliedByEmails.push(appliedByEmail);
  const appliedByUid = String(appliedBy?.uid || "").trim();

  const memberUpdate = {
    mmr: nextMmr,
    hsr: nextHsr,
    loses: nextLoses,
    mmrHistory: nextHistory
  };
  const historyUpdate = {
    abandonCount: Number(historyData.abandonCount || 0) + 1,
    manualAbandonNicknames: manualNicknames,
    manualAbandonOuids: manualOuids,
    manualAbandonReasons: manualReasons,
    manualAbandonAppliedByEmails: manualAppliedByEmails
  };
  const manualEntry = {
    ouid: resolvedOuid,
    nickname: targetName || resolvedOuid,
    matchId,
    matchDate,
    mapName: historyData.map || "알 수 없음",
    mmrDiff: policy.abandonMmrPenalty,
    hsrDiff: policy.abandonHsrPenalty,
    reason: trimmedReason,
    appliedByUid: appliedByUid || null,
    appliedByEmail: appliedByEmail || null
  };

  const report = {
    ouid: resolvedOuid,
    nickname: targetName || resolvedOuid,
    matchId,
    matchDate,
    mapName: historyData.map || "알 수 없음",
    mmrDiff: policy.abandonMmrPenalty,
    hsrDiff: policy.abandonHsrPenalty,
    reason: trimmedReason,
    appliedByUid: appliedByUid || null,
    appliedByEmail: appliedByEmail || null,
    newMmr: nextMmr,
    newHsr: nextHsr,
    loses: nextLoses
  };
  return { memberUpdate, historyUpdate, manualEntry, report };
}
