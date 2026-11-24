import { planCrewSettlement, planManualAbandon } from '../domain/crew-settlement.js?v=0ecea9f51ef9';

const records = (docs) => docs.filter(doc => doc.exists).map(doc => ({ id: doc.id, data: doc.data() || {} }));
const serverTimestamp = () => window.firebase.firestore.FieldValue.serverTimestamp();

export async function settleCrewMatches(repository, matches) {
  if (!repository.db || matches.length === 0) return [];
  const db = repository.db;
  // Web transactions read document references, so queries only discover candidates.
  // Their values are re-read below on EVERY retry before any writes are staged.
  const [membersSnapshot, discoveredSessions, discoveredManualEntries] = await Promise.all([
    db.collection(repository.MEMBERS_COLLECTION).get(),
    repository.getPendingMatchSessions(),
    repository.getManualAbandonEntries()
  ]);
  const memberIds = new Set(membersSnapshot.docs.map((doc) => doc.id));
  matches.forEach((match) => (match.allPlayerStats || []).forEach((player) => {
    if (player.ouid) memberIds.add(player.ouid);
  }));
  discoveredSessions.forEach((session) => (session.participants || []).forEach((player) => {
    if (player.ouid) memberIds.add(player.ouid);
  }));
  discoveredManualEntries.forEach((entry) => memberIds.add(entry.ouid));
  const historyIds = new Set([
    ...matches.map((match) => match.matchId),
    ...discoveredManualEntries.map((entry) => entry.matchId)
  ]);
  const memberRefs = [...memberIds].map((id) => db.collection(repository.MEMBERS_COLLECTION).doc(id));
  const historyRefs = [...historyIds].map((id) => db.collection(repository.HISTORY_COLLECTION).doc(id));
  const sessionRefs = discoveredSessions.map((session) => db.collection(repository.MATCH_SESSIONS_COLLECTION).doc(session.id));
  const manualRefs = discoveredManualEntries.map((entry) => db.collection(repository.MANUAL_ABANDONS_COLLECTION)
    .doc(entry.id || repository.buildManualAbandonDocId(entry.ouid, entry.matchId)));
  const seasonRef = db.collection(repository.SETTINGS_COLLECTION).doc('season');

  return db.runTransaction(async (transaction) => {
    const [seasonDoc, memberDocs, historySnapshots, sessionDocs, manualDocs] = await Promise.all([
      transaction.get(seasonRef),
      Promise.all(memberRefs.map((ref) => transaction.get(ref))),
      Promise.all(historyRefs.map((ref) => transaction.get(ref))),
      Promise.all(sessionRefs.map((ref) => transaction.get(ref))),
      Promise.all(manualRefs.map((ref) => transaction.get(ref)))
    ]);
    const plan = planCrewSettlement({
      matches, season: seasonDoc.data() || {}, members: records(memberDocs),
      histories: records(historySnapshots), sessions: records(sessionDocs), manualEntries: records(manualDocs)
    }, repository.settlementPolicy);
    for (const write of plan.historyWrites) {
      const ref = db.collection(repository.HISTORY_COLLECTION).doc(write.id);
      if (write.merge) transaction.set(ref, write.data, { merge: true });
      else transaction.set(ref, { settledAt: serverTimestamp(), ...write.data });
    }
    for (const write of plan.sessionUpdates) {
      transaction.update(db.collection(repository.MATCH_SESSIONS_COLLECTION).doc(write.id), {
        ...write.data, settledAt: serverTimestamp()
      });
    }
    for (const write of plan.memberUpdates) {
      transaction.update(db.collection(repository.MEMBERS_COLLECTION).doc(write.id), {
        ...write.data, updatedAt: serverTimestamp()
      });
    }
    return plan.reports;
  });
}

export async function saveManualAbandonPenalty(repository, { ouid = "", nickname = "", matchId = "", reason = "", appliedBy = null } = {}) {
  const trimmedReason = String(reason || "").trim();
  if (!trimmedReason) throw new Error('적용 사유를 입력해주세요.');
  if (!repository.db) throw new Error('DB 연결 실패');
  const resolvedOuid = ouid || await repository.findOuidByNickname(nickname);
  if (!resolvedOuid) throw new Error('대상 멤버를 찾을 수 없습니다.');
  if (!matchId) throw new Error('경기를 선택해주세요.');

  const memberRef = repository.db.collection(repository.MEMBERS_COLLECTION).doc(resolvedOuid);
  const historyRef = repository.db.collection(repository.HISTORY_COLLECTION).doc(matchId);
  const manualRef = repository.db.collection(repository.MANUAL_ABANDONS_COLLECTION).doc(repository.buildManualAbandonDocId(resolvedOuid, matchId));
  return repository.db.runTransaction(async (transaction) => {
    const [memberDoc, historyDoc, manualDoc] = await Promise.all([
      transaction.get(memberRef), transaction.get(historyRef), transaction.get(manualRef)
    ]);

    if (!memberDoc.exists) throw new Error('대상 멤버 문서가 없습니다.');
    if (!historyDoc.exists) throw new Error('경기 기록을 찾을 수 없습니다.');

    const plan = planManualAbandon({
      memberData: memberDoc.data() || {}, historyData: historyDoc.data() || {},
      manualExists: manualDoc.exists, resolvedOuid, nickname, matchId, reason: trimmedReason, appliedBy
    }, repository.settlementPolicy);
    transaction.update(memberRef, { ...plan.memberUpdate, updatedAt: serverTimestamp() });
    transaction.update(historyRef, plan.historyUpdate);
    transaction.set(manualRef, { ...plan.manualEntry, appliedAt: serverTimestamp(), createdAt: serverTimestamp() });
    return plan.report;
  });
}
