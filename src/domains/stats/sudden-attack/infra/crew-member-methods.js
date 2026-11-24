/** Member lookup, nickname history, and legacy identity operations. */
class CrewMemberMethods {
  /**
   * Get crew members sorted by MMR
   * Enhanced: Active players (played at least 1 match) always come first.
   */
  async getRankings() {
    if (!this.db) return [];
    try {
      const snapshot = await this.db.collection(this.MEMBERS_COLLECTION).get();
      
      const members = snapshot.docs.map(doc => {
        const data = doc.data();
        const wins = data.wins || 0;
        const loses = data.loses || 0;
        const totalMatches = wins + loses;
        return {
          id: doc.id,
          ...data,
          mmr: data.mmr || 1200,
          hsr: data.hsr || data.mmr || 1200,
          wins,
          loses,
          totalMatches
        };
      });

      return members.sort((a, b) => {
        if (a.totalMatches > 0 && b.totalMatches === 0) return -1;
        if (a.totalMatches === 0 && b.totalMatches > 0) return 1;
        if (b.mmr !== a.mmr) return b.mmr - a.mmr;
        return b.totalMatches - a.totalMatches;
      });
    } catch (error) {
      console.error('[CrewRepo] Failed to fetch rankings:', error);
      return [];
    }
  }

  async findMemberByOuid(ouid) {
    if (!this.db || !ouid) return null;
    const doc = await this.db.collection(this.MEMBERS_COLLECTION).doc(ouid).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  }

  async getMemberMmrHistory(ouid) {
    if (!this.db || !ouid) return [];
    try {
      const doc = await this.db.collection(this.MEMBERS_COLLECTION).doc(ouid).get();
      if (doc.exists) {
        return doc.data().mmrHistory || [];
      }
      return [];
    } catch (err) {
      console.error('[CrewRepo] Failed to get MMR history:', err);
      return [];
    }
  }

  async findOuidByNickname(nickname) {
    if (!this.db || !nickname) return null;
    const searchName = nickname.toLowerCase();
    try {
      let snapshot = await this.db.collection(this.MEMBERS_COLLECTION)
        .where('characterName', '==', nickname)
        .limit(1)
        .get();
      if (!snapshot.empty) return snapshot.docs[0].id;

      snapshot = await this.db.collection(this.MEMBERS_COLLECTION)
        .where('previousNames', 'array-contains', nickname)
        .limit(1)
        .get();
      if (!snapshot.empty) return snapshot.docs[0].id;

      const allSnapshot = await this.db.collection(this.MEMBERS_COLLECTION).get();
      const match = allSnapshot.docs.find(doc => {
        const data = doc.data();
        const currentMatch = data.characterName && data.characterName.toLowerCase() === searchName;
        const previousMatch = (data.previousNames || []).some(n => n.toLowerCase() === searchName);
        return currentMatch || previousMatch;
      });
      return match ? match.id : null;
    } catch (error) {
      console.error('[CrewRepo] findOuidByNickname failed:', error);
      return null;
    }
  }

  async updateNickname(ouid, newNickname) {
    if (!this.db || !ouid || !newNickname) return;
    try {
      const docRef = this.db.collection(this.MEMBERS_COLLECTION).doc(ouid);
      const doc = await docRef.get();
      if (!doc.exists) return;
      const data = doc.data();
      const oldName = data.characterName;
      if (oldName && oldName !== newNickname) {
        const previousNames = data.previousNames || [];
        if (!previousNames.includes(oldName)) previousNames.push(oldName);
        return docRef.update({
          characterName: newNickname,
          previousNames: previousNames,
          updatedAt: window.firebase.firestore.FieldValue.serverTimestamp()
        });
      }
    } catch (error) { console.error('[CrewRepo] updateNickname failed:', error); }
  }

  async addNicknameToHistory(ouid, nicknameToAdd) {
    if (!this.db || !ouid || !nicknameToAdd) return;
    try {
      let docRef = this.db.collection(this.MEMBERS_COLLECTION).doc(ouid);
      let doc = await docRef.get();
      if (!doc.exists) {
        const snapshot = await this.db.collection(this.MEMBERS_COLLECTION)
          .where('characterName', '==', nicknameToAdd)
          .limit(1).get();
        if (!snapshot.empty) { docRef = snapshot.docs[0].ref; doc = snapshot.docs[0]; }
        else return;
      }
      const data = doc.data();
      const currentName = data.characterName;
      const previousNames = data.previousNames || [];
      if (currentName === nicknameToAdd || previousNames.includes(nicknameToAdd)) return;
      previousNames.push(nicknameToAdd);
      return docRef.update({
        previousNames: previousNames,
        updatedAt: window.firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch (error) { console.error('[CrewRepo] addNicknameToHistory failed:', error); }
  }

  async syncHistoricalNicknames(discoveredMap) {
    if (!this.db || !discoveredMap) return;
    for (const ouid in discoveredMap) {
      const names = Array.from(discoveredMap[ouid]);
      for (const name of names) { await this.addNicknameToHistory(ouid, name); }
    }
  }

  async deleteMember(ouid, nickname = null) {
    if (!this.db || !ouid) return;
    const batch = this.db.batch();
    const ouidRef = this.db.collection(this.MEMBERS_COLLECTION).doc(ouid);
    batch.delete(ouidRef);
    if (nickname) {
      const nameRef = this.db.collection(this.MEMBERS_COLLECTION).doc(nickname);
      batch.delete(nameRef);
    }
    return batch.commit();
  }

  async updateNicknameManually(ouid, newNickname) {
    if (!this.db || !ouid || !newNickname) return;
    return this.db.collection(this.MEMBERS_COLLECTION).doc(ouid).update({
      characterName: newNickname,
      updatedAt: window.firebase.firestore.FieldValue.serverTimestamp()
    });
  }

  async migrateToOuid(oldNameId, newOuid) {
    if (!this.db || oldNameId === newOuid) return;
    try {
      const oldRef = this.db.collection(this.MEMBERS_COLLECTION).doc(oldNameId);
      const newRef = this.db.collection(this.MEMBERS_COLLECTION).doc(newOuid);
      const doc = await oldRef.get();
      if (doc.exists) {
        const data = doc.data();
        await newRef.set({ ...data, migratedFrom: oldNameId, updatedAt: window.firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
        await oldRef.delete();
      }
    } catch (err) { console.error('[CrewRepo] Migration failed:', err); }
  }
}

export function applyCrewMemberMethods(targetClass) {
  const descriptors = Object.getOwnPropertyDescriptors(CrewMemberMethods.prototype);
  delete descriptors.constructor;
  Object.defineProperties(targetClass.prototype, descriptors);
}
