/**
 * Crew Repository (Infrastructure Layer)
 * Manages Crew member lists and applications via Firestore.
 */
export class CrewRepository {
  constructor() {
    this.MEMBERS_COLLECTION = 'sa_crew_members';
    this.APPLICATIONS_COLLECTION = 'sa_crew_applications';
    this.ADMIN_EMAILS = ['admin@trackingsa.com', 'hanbeom98@gmail.com'];
  }

  get db() {
    if (typeof window !== 'undefined' && window.db) {
      return window.db;
    }
    console.warn('[CrewRepo] window.db is not initialized yet.');
    return null;
  }

  /**
   * Get all approved crew members
   */
  async getCrewMembers() {
    if (!this.db) return [];
    try {
      const snapshot = await this.db.collection(this.MEMBERS_COLLECTION).get();
      return snapshot.docs.map(doc => doc.data().characterName);
    } catch (error) {
      console.error('[CrewRepo] Failed to fetch members:', error);
      return [];
    }
  }

  /**
   * Submit a new application
   */
  async applyForCrew(characterName) {
    if (!this.db) throw new Error('데이터베이스 연결에 실패했습니다.');
    if (!characterName) throw new Error('캐릭터명을 입력해주세요.');
    
    // Check if already a member
    const members = await this.getCrewMembers();
    if (members.some(m => m.toLowerCase() === characterName.toLowerCase())) {
      throw new Error('이미 등록된 크루 멤버입니다.');
    }

    try {
      await this.db.collection(this.APPLICATIONS_COLLECTION).add({
        characterName,
        status: 'PENDING',
        appliedAt: window.firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch (error) {
      console.error('[CrewRepo] Failed to submit application:', error);
      throw new Error('신청에 실패했습니다. 잠시 후 다시 시도해주세요.');
    }
  }

  /**
   * (Admin) Get pending applications
   */
  async getPendingApplications() {
    if (!this.db) return [];
    try {
      const snapshot = await this.db.collection(this.APPLICATIONS_COLLECTION)
        .where('status', '==', 'PENDING')
        .orderBy('appliedAt', 'desc')
        .get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error('[CrewRepo] Failed to fetch applications:', error);
      return [];
    }
  }

  /**
   * (Admin) Approve application
   */
  async approveApplication(appId, characterName) {
    if (!this.db) throw new Error('데이터베이스 연결 실패');
    const batch = this.db.batch();
    
    const appRef = this.db.collection(this.APPLICATIONS_COLLECTION).doc(appId);
    const memberRef = this.db.collection(this.MEMBERS_COLLECTION).doc(characterName.toLowerCase());

    batch.update(appRef, { status: 'APPROVED' });
    batch.set(memberRef, { 
      characterName, 
      approvedAt: window.firebase.firestore.FieldValue.serverTimestamp() 
    });

    return batch.commit();
  }

  /**
   * (Admin) Reject application
   */
  async rejectApplication(appId) {
    if (!this.db) throw new Error('데이터베이스 연결 실패');
    return this.db.collection(this.APPLICATIONS_COLLECTION).doc(appId).update({
      status: 'REJECTED'
    });
  }

  /**
   * Check if current user is admin
   */
  isAdmin() {
    if (typeof window === 'undefined' || !window.firebase || !window.firebase.auth) return false;
    
    const user = window.firebase.auth().currentUser;
    return user && this.ADMIN_EMAILS.includes(user.email);
  }
}
