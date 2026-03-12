function buildSyntheticAbandonMatches(existingMatches = [], history = [], { ouid = "", nickname = "" } = {}) {
  const existingMatchIds = new Set((Array.isArray(existingMatches) ? existingMatches : []).map((match) => match?.matchId).filter(Boolean));
  const normalizedNickname = String(nickname || "").toLowerCase().trim();

  return (Array.isArray(history) ? history : [])
    .filter((item) => !!item?.matchId && !existingMatchIds.has(item.matchId))
    .filter((item) => {
      const manualOuids = Array.isArray(item?.manualAbandonOuids) ? item.manualAbandonOuids : [];
      const manualNicknames = Array.isArray(item?.manualAbandonNicknames) ? item.manualAbandonNicknames : [];
      const hitByOuid = !!ouid && manualOuids.includes(ouid);
      const hitByNickname = !!normalizedNickname && manualNicknames.some((value) => String(value || "").toLowerCase().trim() === normalizedNickname);
      return hitByOuid || hitByNickname;
    })
    .map((item) => ({
      matchId: item.matchId,
      matchTypeName: '수동 탈주',
      mapName: item.map || '알 수 없음',
      matchDate: item.matchDate,
      participants: [],
      crewParticipants: nickname ? [nickname] : [],
      isCustomMatch: true,
      isSyntheticAbandon: true,
      syntheticBadge: '탈주 판정',
      allPlayerStats: [],
      matchResult: 'ABANDON',
      kill: 0,
      death: 0,
      assist: 0,
      killDisplay: '-',
      deathDisplay: '-',
      assistDisplay: '-',
      kdPercent: 0,
      kdDisplay: '-',
      mmrChange: -30,
      hsrChange: -20,
      laundryInfo: { isWashed: false, totalMissing: 0, winTeamMissing: 0, loseTeamMissing: 0 }
    }))
    .sort((a, b) => new Date(b.matchDate) - new Date(a.matchDate));
}

function mergeMatchesWithSyntheticAbandons(matches = [], syntheticMatches = []) {
  return [...(Array.isArray(matches) ? matches : []), ...(Array.isArray(syntheticMatches) ? syntheticMatches : [])]
    .sort((a, b) => new Date(b.matchDate) - new Date(a.matchDate));
}

export {
  buildSyntheticAbandonMatches,
  mergeMatchesWithSyntheticAbandons,
};
