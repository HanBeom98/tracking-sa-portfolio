/** Crew applications and staff approval/rejection operations. */
class CrewApplicationMethods {
  async applyForCrew(characterName, ouid, applicantUid) {
    if (!applicantUid) throw new Error('로그인 후 신청할 수 있습니다.');
    if (!this.db) throw new Error('데이터베이스 연결 실패');
    const doc = await this.db.collection(this.MEMBERS_COLLECTION).doc(ouid).get();
    if (doc.exists) throw new Error('이미 등록된 멤버입니다.');
    const applicationRef = this.db.collection(this.APPLICATIONS_COLLECTION).doc(applicantUid);
    const application = await applicationRef.get();
    if (application.exists) throw new Error('이미 제출한 신청이 있습니다.');
    return applicationRef.set({
      applicantUid,
      characterName,
      ouid,
      status: 'PENDING',
      appliedAt: window.firebase.firestore.FieldValue.serverTimestamp()
    });
  }

  async getPendingApplications({ limit = null } = {}) {
    if (!this.db) return [];
    let query = this.db.collection(this.APPLICATIONS_COLLECTION).where('status', '==', 'PENDING');
    if (limit !== null) {
      if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new Error('INVALID_APPLICATION_LIMIT');
      query = query.limit(limit);
    }
    const snapshot = await query.get();
    return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
  }

  async approveApplication(appId) {
    return decidePendingCrewApplication(this.db, appId, 'APPROVED', () => window.firebase.firestore.FieldValue.serverTimestamp());
  }

  async rejectApplication(appId) { return decidePendingCrewApplication(this.db, appId, 'REJECTED'); }
}

const validId = id => typeof id === 'string' && id.length > 0 && id.length <= 128 && !/[\/\x00-\x1f]/.test(id) && !['.', '..'].includes(id);
// Read the pending application again inside the transaction. Caller-rendered
// names/OUIDs are never authoritative, and existing scores must not be reseeded.
export async function decidePendingCrewApplication(db, appId, decision, timestamp = () => null) {
  if (!validId(appId) || !['APPROVED', 'REJECTED'].includes(decision)) throw new Error('INVALID_APPLICATION_DECISION');
  const applicationRef = db.collection('sa_crew_applications').doc(appId);
  return db.runTransaction(async transaction => {
    const application = await transaction.get(applicationRef);
    if (!application.exists) throw new Error('APPLICATION_NOT_FOUND');
    const data = application.data();
    if (data.status !== 'PENDING') throw new Error('APPLICATION_ALREADY_PROCESSED');
    if (data.applicantUid !== appId) throw new Error('INVALID_APPLICATION_DECISION');
    if (decision === 'REJECTED') { transaction.update(applicationRef, { status: decision }); return { decision, existingMember: false }; }
    if (!validId(data.ouid) || typeof data.characterName !== 'string' || !data.characterName.trim() || data.characterName.length > 32) throw new Error('INVALID_APPLICATION_DECISION');
    const memberRef = db.collection('sa_crew_members').doc(data.ouid);
    const member = await transaction.get(memberRef);
    if (!member.exists) transaction.set(memberRef, { characterName: data.characterName, mmr: 1200, hsr: 1200,
      wins: 0, loses: 0, mmrHistory: [], approvedAt: timestamp() });
    transaction.update(applicationRef, { status: decision });
    return { decision, existingMember: member.exists };
  });
}

export function applyCrewApplicationMethods(targetClass) {
  const descriptors = Object.getOwnPropertyDescriptors(CrewApplicationMethods.prototype);
  delete descriptors.constructor;
  Object.defineProperties(targetClass.prototype, descriptors);
}
