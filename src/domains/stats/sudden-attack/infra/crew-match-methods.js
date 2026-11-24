import {
  toDateSafe, getMatchPresenceSet, findPendingSessionForMatch,
  applyAbandonPenalty, applyManualAbandonToMember, buildManualAbandonHistoryPatch
} from '../domain/crew-settlement.js';
import { saveManualAbandonPenalty } from './crew-settlement-store.js';

/** Match history, pending rosters, and manual-abandon adapters. */
class CrewMatchMethods {
  async getHistory(limit = 300) {
    if (!this.db) return [];
    try {
      const safeLimit = Math.max(1, Math.min(500, Number(limit) || 300));
      const snapshot = await this.db
        .collection(this.HISTORY_COLLECTION)
        .orderBy("matchDate", "desc")
        .limit(safeLimit)
        .get();
      return snapshot.docs
        .map((doc) => {
          const data = doc.data();
          return {
            matchId: doc.id,
            map: data.map || "알 수 없음",
            matchDate: data.matchDate || "",
            crewCount: Number(data.crewCount || 0),
            abandonCount: Number(data.abandonCount || 0),
            manualAbandonOuids: Array.isArray(data.manualAbandonOuids) ? data.manualAbandonOuids : [],
            manualAbandonNicknames: Array.isArray(data.manualAbandonNicknames) ? data.manualAbandonNicknames : []
          };
        })
        .sort((a, b) => new Date(b.matchDate) - new Date(a.matchDate))
        .slice(0, safeLimit);
    } catch (err) {
      console.error('[CrewRepo] Failed to fetch history:', err);
      return [];
    }
  }

  buildMemberAbandonSummary(history = [], { ouid = "", nickname = "", seasonStart = null } = {}) {
    const normalizedNickname = String(nickname || "").toLowerCase().trim();
    const safeSeasonStart = seasonStart instanceof Date && !Number.isNaN(seasonStart.getTime())
      ? seasonStart
      : null;

    return (Array.isArray(history) ? history : []).reduce((acc, item) => {
      const matchDate = item?.matchDate ? new Date(item.matchDate) : null;
      const manualOuids = Array.isArray(item?.manualAbandonOuids) ? item.manualAbandonOuids : [];
      const manualNicknames = Array.isArray(item?.manualAbandonNicknames) ? item.manualAbandonNicknames : [];
      const hitByOuid = !!ouid && manualOuids.includes(ouid);
      const hitByNickname = !!normalizedNickname && manualNicknames.some((value) => String(value || "").toLowerCase().trim() === normalizedNickname);
      if (!hitByOuid && !hitByNickname) return acc;

      const isCurrent = safeSeasonStart && matchDate && !Number.isNaN(matchDate.getTime())
        ? matchDate >= safeSeasonStart
        : true;

      if (isCurrent) acc.current += 1;
      else acc.previous += 1;
      return acc;
    }, { current: 0, previous: 0 });
  }

  async getManualAbandonEntries() {
    if (!this.db) return [];
    try {
      const snapshot = await this.db.collection(this.MANUAL_ABANDONS_COLLECTION).get();
      return snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter((item) => !!item?.ouid && !!item?.matchId && !!item?.matchDate)
        .sort((a, b) => new Date(a.matchDate) - new Date(b.matchDate));
    } catch (err) {
      console.warn('[CrewRepo] Failed to read manual abandon entries:', err);
      return [];
    }
  }

  buildManualAbandonDocId(ouid, matchId) {
    return `${ouid}__${matchId}`;
  }

  extractManualAbandonCandidates(historyItem = {}) {
    const matchId = historyItem.matchId || historyItem.id || "";
    const matchDate = historyItem.matchDate || "";
    if (!matchId || !matchDate) return [];

    const manualOuids = Array.isArray(historyItem.manualAbandonOuids) ? historyItem.manualAbandonOuids : [];
    const manualNicknames = Array.isArray(historyItem.manualAbandonNicknames) ? historyItem.manualAbandonNicknames : [];
    const candidateCount = Math.max(manualOuids.length, manualNicknames.length);
    const candidates = [];

    for (let index = 0; index < candidateCount; index += 1) {
      const ouid = String(manualOuids[index] || "").trim();
      const nickname = String(manualNicknames[index] || "").trim();
      if (!ouid && !nickname) continue;
      candidates.push({
        ouid,
        nickname,
        matchId,
        matchDate,
        mapName: historyItem.map || "알 수 없음"
      });
    }

    return candidates;
  }

  applyManualAbandonToMember(memberData, matchDate) {
    return applyManualAbandonToMember(memberData, matchDate, this.settlementPolicy);
  }

  buildManualAbandonHistoryPatch(entries = [], baseHistory = {}) {
    return buildManualAbandonHistoryPatch(entries, baseHistory);
  }

  async applyManualAbandonPenalty(options = {}) {
    return saveManualAbandonPenalty(this, options);
  }

  async backfillManualAbandonEntries() {
    if (!this.db) throw new Error('DB 연결 실패');

    const [historySnapshot, manualEntries] = await Promise.all([
      this.db.collection(this.HISTORY_COLLECTION).get(),
      this.getManualAbandonEntries()
    ]);

    const existingIds = new Set(
      manualEntries.map((entry) => this.buildManualAbandonDocId(entry.ouid, entry.matchId))
    );
    const pendingWrites = [];
    let createdCount = 0;
    let skippedCount = 0;

    for (const doc of historySnapshot.docs) {
      const historyItem = { matchId: doc.id, ...doc.data() };
      const candidates = this.extractManualAbandonCandidates(historyItem);

      for (const candidate of candidates) {
        let resolvedOuid = candidate.ouid;
        if (!resolvedOuid && candidate.nickname) {
          resolvedOuid = await this.findOuidByNickname(candidate.nickname);
        }
        if (!resolvedOuid) {
          skippedCount += 1;
          continue;
        }

        const docId = this.buildManualAbandonDocId(resolvedOuid, candidate.matchId);
        if (existingIds.has(docId)) {
          skippedCount += 1;
          continue;
        }

        pendingWrites.push({
          docId,
          payload: {
            ouid: resolvedOuid,
            nickname: candidate.nickname || resolvedOuid,
            matchId: candidate.matchId,
            matchDate: candidate.matchDate,
            mapName: candidate.mapName,
            mmrDiff: this.ABANDON_MMR_PENALTY,
            hsrDiff: this.ABANDON_HSR_PENALTY,
            backfilledAt: window.firebase.firestore.FieldValue.serverTimestamp(),
            createdAt: window.firebase.firestore.FieldValue.serverTimestamp()
          }
        });
        existingIds.add(docId);
        createdCount += 1;
      }
    }

    if (pendingWrites.length === 0) {
      return { createdCount, skippedCount };
    }

    const batch = this.db.batch();
    pendingWrites.forEach((item) => {
      batch.set(this.db.collection(this.MANUAL_ABANDONS_COLLECTION).doc(item.docId), item.payload, { merge: true });
    });
    await batch.commit();

    return { createdCount, skippedCount };
  }

  toDateSafe(value) {
    return toDateSafe(value);
  }

  async createPendingMatchSession(teamResult) {
    if (!this.db) throw new Error('DB 연결 실패');
    const red = Array.isArray(teamResult?.red) ? teamResult.red : [];
    const blue = Array.isArray(teamResult?.blue) ? teamResult.blue : [];
    const participants = [...red, ...blue]
      .map((member) => ({
        ouid: member?.ouid || "",
        characterName: member?.characterName || "",
        team: red.includes(member) ? 'RED' : 'BLUE'
      }))
      .filter((member) => member.ouid && member.characterName);

    if (participants.length < 2) {
      throw new Error('참가자 정보가 부족합니다.');
    }

    return this.db.collection(this.MATCH_SESSIONS_COLLECTION).add({
      status: 'PENDING',
      participants,
      participantCount: participants.length,
      createdAt: window.firebase.firestore.FieldValue.serverTimestamp()
    });
  }

  async getPendingMatchSessions() {
    if (!this.db) return [];
    try {
      const snapshot = await this.db.collection(this.MATCH_SESSIONS_COLLECTION).get();
      return snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter((item) => item.status === 'PENDING')
        .sort((a, b) => (this.toDateSafe(b.createdAt)?.getTime() || 0) - (this.toDateSafe(a.createdAt)?.getTime() || 0));
    } catch (err) {
      console.warn('[CrewRepo] Failed to read pending match sessions:', err);
      return [];
    }
  }

  getMatchPresenceSet(match, memberCache = {}, nameMap = {}) {
    return getMatchPresenceSet(match, memberCache, nameMap);
  }

  findPendingSessionForMatch(match, pendingSessions = [], memberCache = {}, nameMap = {}, usedSessionIds = new Set()) {
    return findPendingSessionForMatch(match, pendingSessions, memberCache, nameMap, usedSessionIds, this.settlementPolicy);
  }

  applyAbandonPenalty(memberData, matchDate) {
    return applyAbandonPenalty(memberData, matchDate, this.settlementPolicy);
  }
}

export function applyCrewMatchMethods(targetClass) {
  const descriptors = Object.getOwnPropertyDescriptors(CrewMatchMethods.prototype);
  delete descriptors.constructor;
  Object.defineProperties(targetClass.prototype, descriptors);
}
