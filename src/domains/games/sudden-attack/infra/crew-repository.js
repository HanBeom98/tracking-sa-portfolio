/**
 * Crew Repository (Infrastructure Layer) - MMR Enhanced
 * Manages Crew member lists, applications, and MMR Rating System.
 */
export class CrewRepository {
  constructor() {
    this.MEMBERS_COLLECTION = 'sa_crew_members';
    this.APPLICATIONS_COLLECTION = 'sa_crew_applications';
    this.HISTORY_COLLECTION = 'sa_crew_history'; // Record of settled matches
    this.ADMIN_EMAILS = ['admin@trackingsa.com', 'hanbeom98@gmail.com'];
  }

  get db() {
    if (typeof window !== 'undefined' && window.db) return window.db;
    return null;
  }

  /**
   * Get crew members sorted by MMR
   */
  async getRankings() {
    if (!this.db) return [];
    try {
      const snapshot = await this.db.collection(this.MEMBERS_COLLECTION)
        .orderBy('mmr', 'desc')
        .get();
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        // Ensure default values if new
        mmr: doc.data().mmr || 1200,
        wins: doc.data().wins || 0,
        loses: doc.data().loses || 0
      }));
    } catch (error) {
      console.error('[CrewRepo] Failed to fetch rankings:', error);
      return [];
    }
  }

  async getCrewMembers() {
    const list = await this.getRankings();
    return list.map(m => m.characterName);
  }

  /**
   * Settle MMR for a list of matches
   * @param {Array} matches - Array of MatchRecord objects
   */
  async settleMatches(matches) {
    if (!this.db) return;
    const batch = this.db.batch();
    const processedMatchIds = [];

    for (const match of matches) {
      // 1. Check if already settled
      const historyRef = this.db.collection(this.HISTORY_COLLECTION).doc(match.matchId);
      const historyDoc = await historyRef.get();
      if (historyDoc.exists) continue;

      // 2. Calculate MMR changes for participants
      for (const p of match.allPlayerStats) {
        if (!p.isCrew) continue;

        const memberRef = this.db.collection(this.MEMBERS_COLLECTION).doc(p.nickname.toLowerCase());
        const memberDoc = await memberRef.get();
        if (!memberDoc.exists) continue;

        const currentData = memberDoc.data();
        let mmr = currentData.mmr || 1200;
        let wins = currentData.wins || 0;
        let loses = currentData.loses || 0;

        // --- ELO LOGIC ---
        const isWin = p.result === 'WIN';
        const kd = parseFloat(p.kd);
        let change = isWin ? 20 : -20;

        // Weightings
        if (isWin && kd < 0.5) change = 10; // Bus rider
        if (!isWin && kd >= 1.5) change = -10; // Hard carry but lost

        mmr += change;
        if (isWin) wins++; else loses++;

        batch.update(memberRef, { 
          mmr, wins, loses, 
          lastMatchId: match.matchId,
          updatedAt: window.firebase.firestore.FieldValue.serverTimestamp()
        });
      }

      // 3. Mark match as settled
      batch.set(historyRef, {
        settledAt: window.firebase.firestore.FieldValue.serverTimestamp(),
        map: match.mapName,
        crewCount: match.crewParticipants.length
      });
      processedMatchIds.push(match.matchId);
    }

    await batch.commit();
    return processedMatchIds;
  }

  async applyForCrew(characterName) {
    if (!this.db) throw new Error('데이터베이스 연결 실패');
    const memberRef = this.db.collection(this.MEMBERS_COLLECTION).doc(characterName.toLowerCase());
    const memberDoc = await memberRef.get();
    if (memberDoc.exists) throw new Error('이미 등록된 멤버입니다.');

    try {
      await this.db.collection(this.APPLICATIONS_COLLECTION).add({
        characterName,
        status: 'PENDING',
        appliedAt: window.firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch (error) { throw new Error('신청 실패'); }
  }

  async getPendingApplications() {
    if (!this.db) return [];
    const snapshot = await this.db.collection(this.APPLICATIONS_COLLECTION)
      .where('status', '==', 'PENDING').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  async approveApplication(appId, characterName) {
    const batch = this.db.batch();
    const appRef = this.db.collection(this.APPLICATIONS_COLLECTION).doc(appId);
    const memberRef = this.db.collection(this.MEMBERS_COLLECTION).doc(characterName.toLowerCase());

    batch.update(appRef, { status: 'APPROVED' });
    batch.set(memberRef, { 
      characterName, 
      mmr: 1200, wins: 0, loses: 0,
      approvedAt: window.firebase.firestore.FieldValue.serverTimestamp() 
    });
    return batch.commit();
  }

  async rejectApplication(appId) {
    return this.db.collection(this.APPLICATIONS_COLLECTION).doc(appId).update({ status: 'REJECTED' });
  }

  isAdmin() {
    if (typeof window === 'undefined' || !window.firebase || !window.firebase.auth) return false;
    const user = window.firebase.auth().currentUser;
    return user && this.ADMIN_EMAILS.includes(user.email);
  }
}
