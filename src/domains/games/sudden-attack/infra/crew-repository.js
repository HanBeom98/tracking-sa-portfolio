/**
 * Crew Repository (Infrastructure Layer) - MMR Enhanced
 * Manages Crew member lists, applications, and MMR Rating System.
 */
export class CrewRepository {
  constructor() {
    this.MEMBERS_COLLECTION = 'sa_crew_members';
    this.APPLICATIONS_COLLECTION = 'sa_crew_applications';
    this.HISTORY_COLLECTION = 'sa_crew_history'; 
    this.SETTINGS_COLLECTION = 'sa_crew_settings';
    
    // List of Administrators and Moderators (Staff)
    this.STAFF_EMAILS = [
      'admin@trackingsa.com', 
      'hantiger24@naver.com',
      'bjs5739@naver.com',
      'jungsion98@naver.com'
    ];
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
        id: doc.id, // This is the OUID
        ...doc.data(),
        mmr: doc.data().mmr || 1200,
        wins: doc.data().wins || 0,
        loses: doc.data().loses || 0
      }));
    } catch (error) {
      console.error('[CrewRepo] Failed to fetch rankings:', error);
      return [];
    }
  }

  /**
   * Find a member by their OUID
   */
  async findMemberByOuid(ouid) {
    if (!this.db || !ouid) return null;
    const doc = await this.db.collection(this.MEMBERS_COLLECTION).doc(ouid).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  }

  /**
   * Update nickname for a member when a name change is detected
   */
  async updateNickname(ouid, newNickname) {
    if (!this.db || !ouid) return;
    return this.db.collection(this.MEMBERS_COLLECTION).doc(ouid).update({
      characterName: newNickname,
      updatedAt: window.firebase.firestore.FieldValue.serverTimestamp()
    });
  }

  /**
   * Delete a member from the crew
   */
  async deleteMember(ouid) {
    if (!this.db || !ouid) return;
    return this.db.collection(this.MEMBERS_COLLECTION).doc(ouid).delete();
  }

  /**
   * Manually update a member's nickname (for fixing PLAYER_NOT_FOUND issues)
   */
  async updateNicknameManually(ouid, newNickname) {
    if (!this.db || !ouid || !newNickname) return;
    return this.db.collection(this.MEMBERS_COLLECTION).doc(ouid).update({
      characterName: newNickname,
      updatedAt: window.firebase.firestore.FieldValue.serverTimestamp()
    });
  }

  /**
   * Migrates a name-based document to an OUID-based document
   */
  async migrateToOuid(oldNameId, newOuid) {
    if (!this.db || oldNameId === newOuid) return;
    
    try {
      const oldRef = this.db.collection(this.MEMBERS_COLLECTION).doc(oldNameId);
      const newRef = this.db.collection(this.MEMBERS_COLLECTION).doc(newOuid);
      
      const doc = await oldRef.get();
      if (doc.exists) {
        const data = doc.data();
        await newRef.set({
          ...data,
          migratedFrom: oldNameId,
          updatedAt: window.firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        await oldRef.delete();
        console.log(`[CrewRepo] Migrated ${oldNameId} -> ${newOuid}`);
      }
    } catch (err) {
      console.error('[CrewRepo] Migration failed:', err);
    }
  }

  async getSeasonStartDate() {
    if (!this.db) return new Date(0);
    try {
      const doc = await this.db.collection(this.SETTINGS_COLLECTION).doc('season').get();
      if (doc.exists && doc.data().startDate) {
        return doc.data().startDate.toDate();
      }
      return new Date(0);
    } catch (e) { return new Date(0); }
  }

  /**
   * Settle MMR for a list of matches
   */
  async settleMatches(matches) {
    if (!this.db || matches.length === 0) return [];
    
    const seasonStartDate = await this.getSeasonStartDate();
    const memberCache = {};
    const membersSnap = await this.db.collection(this.MEMBERS_COLLECTION).get();
    
    // Mapping: Nickname -> MemberData (Cache)
    const nameMap = {};
    membersSnap.forEach(doc => {
      const data = doc.data();
      const cacheObj = {
        ouid: doc.id,
        mmr: data.mmr || 1200,
        wins: data.wins || 0,
        loses: data.loses || 0,
        crewKills: data.crewKills || 0,
        crewDeaths: data.crewDeaths || 0,
        isDirty: false
      };
      memberCache[doc.id] = cacheObj;
      nameMap[data.characterName.toLowerCase()] = cacheObj;
    });

    const historySnap = await this.db.collection(this.HISTORY_COLLECTION).get();
    const settledSet = new Set(historySnap.docs.map(d => d.id));
    const batch = this.db.batch();
    const processedMatchIds = [];
    const sortedMatches = [...matches].sort((a, b) => new Date(a.matchDate) - new Date(b.matchDate));

    for (const match of sortedMatches) {
      if (new Date(match.matchDate) < seasonStartDate) continue;
      if (settledSet.has(match.matchId)) continue;

      for (const p of match.allPlayerStats) {
        if (!p.isCrew) continue;
        
        // Find member by their name AT THE TIME of the match
        const currentData = nameMap[p.nickname.toLowerCase()];
        if (!currentData) continue; 

        const isWin = p.result === 'WIN';
        const kill = parseInt(p.kill || 0);
        const death = parseInt(p.death || 0);
        const kd = parseFloat(p.kd);
        
        let change = isWin ? 20 : -20;
        if (isWin && kd < 0.5) change = 10;
        if (!isWin && kd >= 1.5) change = -10;

        currentData.mmr += change;
        if (isWin) currentData.wins += 1; else currentData.loses += 1;
        
        // ACCUMULATE KILLS AND DEATHS
        currentData.crewKills += kill;
        currentData.crewDeaths += death;
        
        currentData.isDirty = true;
      }

      const historyRef = this.db.collection(this.HISTORY_COLLECTION).doc(match.matchId);
      batch.set(historyRef, {
        settledAt: window.firebase.firestore.FieldValue.serverTimestamp(),
        map: match.mapName,
        matchDate: match.matchDate,
        crewCount: match.crewParticipants.length
      });
      processedMatchIds.push(match.matchId);
      settledSet.add(match.matchId);
    }

    for (const ouid in memberCache) {
      if (memberCache[ouid].isDirty) {
        const memberRef = this.db.collection(this.MEMBERS_COLLECTION).doc(ouid);
        batch.update(memberRef, {
          mmr: memberCache[ouid].mmr,
          wins: memberCache[ouid].wins,
          loses: memberCache[ouid].loses,
          crewKills: memberCache[ouid].crewKills,
          crewDeaths: memberCache[ouid].crewDeaths,
          updatedAt: window.firebase.firestore.FieldValue.serverTimestamp()
        });
      }
    }

    if (processedMatchIds.length > 0) await batch.commit();
    return processedMatchIds;
  }

  async resetSeason() {
    if (!this.db) throw new Error('DB 연결 실패');
    const membersSnap = await this.db.collection(this.MEMBERS_COLLECTION).get();
    const batch = this.db.batch();
    membersSnap.docs.forEach(doc => {
      batch.update(doc.ref, { mmr: 1200, wins: 0, loses: 0, updatedAt: window.firebase.firestore.FieldValue.serverTimestamp() });
    });
    const settingsRef = this.db.collection(this.SETTINGS_COLLECTION).doc('season');
    batch.set(settingsRef, { startDate: window.firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
    await batch.commit();
  }

  async applyForCrew(characterName, ouid) {
    if (!this.db) throw new Error('데이터베이스 연결 실패');
    const memberRef = this.db.collection(this.MEMBERS_COLLECTION).doc(ouid);
    const memberDoc = await memberRef.get();
    if (memberDoc.exists) throw new Error('이미 등록된 멤버입니다.');

    return this.db.collection(this.APPLICATIONS_COLLECTION).add({
      characterName,
      ouid,
      status: 'PENDING',
      appliedAt: window.firebase.firestore.FieldValue.serverTimestamp()
    });
  }

  async getPendingApplications() {
    if (!this.db) return [];
    const snapshot = await this.db.collection(this.APPLICATIONS_COLLECTION).where('status', '==', 'PENDING').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  async approveApplication(appId, characterName, ouid) {
    const batch = this.db.batch();
    const appRef = this.db.collection(this.APPLICATIONS_COLLECTION).doc(appId);
    const memberRef = this.db.collection(this.MEMBERS_COLLECTION).doc(ouid);

    batch.update(appRef, { status: 'APPROVED' });
    batch.set(memberRef, { 
      characterName, 
      mmr: 1200, wins: 0, loses: 0,
      approvedAt: window.firebase.firestore.FieldValue.serverTimestamp() 
    }, { merge: true });
    return batch.commit();
  }

  async rejectApplication(appId) {
    return this.db.collection(this.APPLICATIONS_COLLECTION).doc(appId).update({ status: 'REJECTED' });
  }

  isStaff(currentUser = null) {
    const user = currentUser || (typeof window !== 'undefined' && window.firebase && window.firebase.auth ? window.firebase.auth().currentUser : null);
    return user && this.STAFF_EMAILS.includes(user.email);
  }

  balanceTeams(selectedMembers) {
    if (selectedMembers.length < 2) return null;
    const snipers = selectedMembers.filter(m => m.position === 'sniper');
    const riflers = selectedMembers.filter(m => m.position === 'rifler');
    const teamSize = Math.floor(selectedMembers.length / 2);
    let bestSplit = { red: [], blue: [], diff: Infinity };

    const combinations = (array, size) => {
      if (size === 0) return [[]];
      const results = [];
      const f = (prefix, chars) => {
        for (let i = 0; i < chars.length; i++) {
          const nextPrefix = prefix.concat([chars[i]]);
          if (nextPrefix.length === size) results.push(nextPrefix);
          else f(nextPrefix, chars.slice(i + 1));
        }
      };
      f([], array);
      return results;
    };

    const redSniperCount = Math.floor(snipers.length / 2);
    const sniperCombos = combinations(snipers, redSniperCount);

    for (const redSnipers of sniperCombos) {
      const blueSnipers = snipers.filter(s => !redSnipers.includes(s));
      const riflersNeededForRed = teamSize - redSnipers.length;
      if (riflersNeededForRed < 0 || riflersNeededForRed > riflers.length) continue;
      const riflerCombos = combinations(riflers, riflersNeededForRed);
      for (const redRiflers of riflerCombos) {
        const blueRiflers = riflers.filter(r => !redRiflers.includes(r));
        const redTeam = [...redSnipers, ...redRiflers];
        const blueTeam = [...blueSnipers, ...blueRiflers];
        if (blueTeam.length + redTeam.length < selectedMembers.length) {
          const leftovers = riflers.filter(r => !redRiflers.includes(r) && !blueRiflers.includes(r));
          blueTeam.push(...leftovers);
        }
        const redMMR = redTeam.reduce((sum, m) => sum + (m.mmr || 1200), 0);
        const blueMMR = blueTeam.reduce((sum, m) => sum + (m.mmr || 1200), 0);
        const diff = Math.abs(redMMR - blueMMR);
        if (diff < bestSplit.diff) {
          bestSplit = { red: redTeam, blue: blueTeam, diff, redAvg: redMMR / redTeam.length, blueAvg: blueMMR / blueTeam.length };
        }
      }
    }
    return bestSplit;
  }
}
