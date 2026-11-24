import { buildSyntheticAbandonMatches, mergeMatchesWithSyntheticAbandons } from './abandon-match-service.js';
import { normalizeTrendEntries } from './trend-view-builder.js';
import { getPublicMatchCategory } from './public-match-categories.js';

export async function loadPlayerProfileContext({ repository, crewRepository, characterName, currentRankings = [], scope = 'league' }) {
  const player = await repository.getPlayer(characterName);
  const isPublic = scope === 'public';
  const initialMatchLimit = isPublic ? 40 : 80;
  const initialMatchOptions = isPublic
    ? { scope, matchTypes: getPublicMatchCategory('all').matchTypes }
    : { scope };
  const crewMemberDataPromise = findMemberData({
    crewRepository,
    currentRankings,
    ouid: player.ouid
  });
  const archivedTrendPromise = isPublic
    ? Promise.resolve([])
    : getArchivedPreviousTrendSafe(crewRepository, player.ouid);
  const seasonStartPromise = isPublic
    ? Promise.resolve(new Date(0))
    : getSeasonStartDateSafe(crewRepository);
  const seasonHistoryPromise = !isPublic && crewRepository
    ? crewRepository.getHistory(300)
    : Promise.resolve([]);
  const nicknameSyncPromise = isPublic
    ? Promise.resolve(false)
    : syncCrewNickname({ crewRepository, player });

  const [
    allMatches,
    crewMemberData,
    archivedPreviousTrend,
    seasonStart,
    seasonHistory,
    rawStats
  ] = await Promise.all([
    repository.getRecentMatches(player.ouid, initialMatchLimit, player.nickname, initialMatchOptions),
    crewMemberDataPromise,
    archivedTrendPromise,
    seasonStartPromise,
    seasonHistoryPromise,
    repository.apiClient.getRecentInfo(player.ouid),
    nicknameSyncPromise
  ]);
  if (isPublic) {
    player.isCrew = Boolean(crewMemberData);
  }
  const memberData = isPublic ? null : crewMemberData;
  const syntheticAbandonMatches = !isPublic && crewRepository
    ? buildSyntheticAbandonMatches(allMatches, seasonHistory, {
        ouid: player.ouid,
        nickname: player.nickname
      })
    : [];
  const mergedMatches = mergeMatchesWithSyntheticAbandons(allMatches, syntheticAbandonMatches);
  const abandonSummary = !isPublic && crewRepository
    ? crewRepository.buildMemberAbandonSummary(seasonHistory, {
        ouid: player.ouid,
        nickname: player.nickname,
        seasonStart
      })
    : { current: 0, previous: 0 };
  return {
    player,
    memberData,
    archivedPreviousTrend,
    seasonStart,
    rawStats,
    mergedMatches,
    abandonSummary
  };
}

async function findMemberData({ crewRepository, currentRankings, ouid }) {
  let memberData = currentRankings.find((member) => member.id === ouid);
  if (!memberData && crewRepository) {
    memberData = await crewRepository.findMemberByOuid(ouid);
  }
  return memberData;
}

async function getSeasonStartDateSafe(crewRepository) {
  if (!crewRepository || typeof crewRepository.getSeasonStartDate !== 'function') {
    return new Date(0);
  }
  try {
    const seasonStart = await crewRepository.getSeasonStartDate();
    if (seasonStart instanceof Date && !Number.isNaN(seasonStart.getTime()) && seasonStart.getTime() > 0) {
      return seasonStart;
    }
  } catch (err) {
    console.warn('[ApplicationService] Season start lookup failed (non-critical):', err);
  }
  return new Date(0);
}

async function getArchivedPreviousTrendSafe(crewRepository, ouid) {
  if (!crewRepository || typeof crewRepository.getLatestSeasonArchiveHistory !== 'function') {
    return [];
  }
  try {
    const archived = await crewRepository.getLatestSeasonArchiveHistory(ouid);
    return normalizeTrendEntries(archived);
  } catch (err) {
    console.warn('[ApplicationService] Archived trend lookup failed (non-critical):', err);
    return [];
  }
}

async function syncCrewNickname({ crewRepository, player }) {
  if (!crewRepository) return false;

  try {
    const existingMember = await crewRepository.findMemberByOuid(player.ouid);
    if (existingMember && existingMember.characterName !== player.nickname) {
      console.log(`[ApplicationService] Nickname sync: ${existingMember.characterName} -> ${player.nickname}`);
      await crewRepository.updateNickname(player.ouid, player.nickname);
      return true;
    }
  } catch (err) {
    console.warn('[ApplicationService] Crew sync failed (non-critical):', err);
  }
  return false;
}
