/**
 * Crew Repository (Infrastructure Layer) - MMR Enhanced
 * Manages Crew member lists, applications, and MMR Rating System.
 */
export class CrewRepository {
  constructor(apiClient) {
    this.apiClient = apiClient;
    this.MEMBERS_COLLECTION = 'sa_crew_members';
    this.APPLICATIONS_COLLECTION = 'sa_crew_applications';
    this.HISTORY_COLLECTION = 'sa_crew_history'; 
    this.SETTINGS_COLLECTION = 'sa_crew_settings';
    this.HISTORY_LIMIT = 50; // Max match history points to store for trend
    
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

  async getSeasonStartDate() {
    if (!this.db) return new Date(0);
    try {
      const doc = await this.db.collection(this.SETTINGS_COLLECTION).doc('season').get();
      if (doc.exists && doc.data().startDate) return doc.data().startDate.toDate();
      return new Date(0);
    } catch (e) { return new Date(0); }
  }

  async setSeasonStartDate(date) {
    if (!this.db) throw new Error('DB 연결 실패');
    const settingsRef = this.db.collection(this.SETTINGS_COLLECTION).doc('season');
    return settingsRef.set({ startDate: window.firebase.firestore.Timestamp.fromDate(new Date(date)) }, { merge: true });
  }

  /**
   * Settle MMR for a list of matches
   * Returns reports for Discord notifications
   */
  async settleMatches(matches) {
    if (!this.db || matches.length === 0) return [];
    
    const seasonStartDate = await this.getSeasonStartDate();
    const memberCache = {};
    const membersSnap = await this.db.collection(this.MEMBERS_COLLECTION).get();
    
    const nameMap = {};
    membersSnap.forEach(doc => {
      const data = doc.data();
      const cacheObj = {
        ouid: doc.id,
        mmr: data.mmr || 1200,
        hsr: data.hsr || data.mmr || 1200,
        wins: data.wins || 0,
        loses: data.loses || 0,
        crewKills: data.crewKills || 0,
        crewDeaths: data.crewDeaths || 0,
        mmrHistory: data.mmrHistory || [],
        isDirty: false
      };
      memberCache[doc.id] = cacheObj;
      if (data.characterName) nameMap[data.characterName.toLowerCase()] = cacheObj;
      if (data.previousNames) data.previousNames.forEach(n => nameMap[n.toLowerCase()] = cacheObj);
    });

    const historySnap = await this.db.collection(this.HISTORY_COLLECTION).get();
    const settledSet = new Set(historySnap.docs.map(d => d.id));
    const batch = this.db.batch();
    const settlementReports = [];
    const sortedMatches = [...matches].sort((a, b) => new Date(a.matchDate) - new Date(b.matchDate));

    for (const match of sortedMatches) {
      if (new Date(match.matchDate) < seasonStartDate) continue;
      if (settledSet.has(match.matchId)) continue;

      const playerChanges = [];

      for (const p of match.allPlayerStats) {
        if (!p.isCrew) continue;
        
        let currentData = p.ouid && memberCache[p.ouid] ? memberCache[p.ouid] : nameMap[p.nickname.toLowerCase()];
        if (!currentData) continue; 

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

        let mmrChange = isWin ? 20 : -20;
        let mmrBonus = 0;
        if (p.isMvp) mmrBonus += 3;
        if (p.damage >= 1500) mmrBonus += 2;
        if (p.headshot >= 7) mmrBonus += 2;
        mmrBonus = Math.min(5, mmrBonus);

        const finalMmrDiff = Math.round((mmrChange + mmrBonus) * gapWeight);
        currentData.mmr += finalMmrDiff;

        // --- 2. HSR 정산 (성적 기반 실력 지표) ---
        let hsrChange = isWin ? 10 : -10;
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

      batch.set(this.db.collection(this.HISTORY_COLLECTION).doc(match.matchId), {
        settledAt: window.firebase.firestore.FieldValue.serverTimestamp(),
        map: match.mapName,
        matchDate: match.matchDate,
        crewCount: match.crewParticipants.length
      });
      settlementReports.push({ match, playerChanges });
      settledSet.add(match.matchId);
    }

    for (const ouid in memberCache) {
      if (memberCache[ouid].isDirty) {
        const finalHistory = memberCache[ouid].mmrHistory.slice(-this.HISTORY_LIMIT);
        batch.update(this.db.collection(this.MEMBERS_COLLECTION).doc(ouid), {
          mmr: memberCache[ouid].mmr,
          hsr: memberCache[ouid].hsr,
          wins: memberCache[ouid].wins,
          loses: memberCache[ouid].loses,
          crewKills: memberCache[ouid].crewKills,
          crewDeaths: memberCache[ouid].crewDeaths,
          mmrHistory: finalHistory,
          updatedAt: window.firebase.firestore.FieldValue.serverTimestamp()
        });
      }
    }

    if (settlementReports.length > 0) await batch.commit();
    return settlementReports;
  }

  async resetSeason() {
    if (!this.db) throw new Error('DB 연결 실패');
    const snapshot = await this.db.collection(this.MEMBERS_COLLECTION).get();
    const batch = this.db.batch();
    snapshot.docs.forEach(doc => {
      batch.update(doc.ref, { mmr: 1200, hsr: 1200, wins: 0, loses: 0, crewKills: 0, crewDeaths: 0, mmrHistory: [], updatedAt: window.firebase.firestore.FieldValue.serverTimestamp() });
    });
    batch.set(this.db.collection(this.SETTINGS_COLLECTION).doc('season'), { startDate: window.firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
    await batch.commit();
  }

  async repairSeasonData() {
    if (!this.db) throw new Error('DB 연결 실패');
    const seasonStartDate = await this.getSeasonStartDate();
    const membersSnap = await this.db.collection(this.MEMBERS_COLLECTION).get();
    const batch = this.db.batch();
    membersSnap.docs.forEach(doc => {
      batch.update(doc.ref, { mmr: 1200, hsr: 1200, wins: 0, loses: 0, crewKills: 0, crewDeaths: 0, mmrHistory: [], updatedAt: window.firebase.firestore.FieldValue.serverTimestamp() });
    });
    const historySnap = await this.db.collection(this.HISTORY_COLLECTION).get();
    historySnap.docs.forEach(doc => {
      const data = doc.data();
      if (!data.matchDate || new Date(data.matchDate) >= seasonStartDate) batch.delete(doc.ref);
    });
    await batch.commit();
  }

  async applyForCrew(characterName, ouid) {
    if (!this.db) throw new Error('데이터베이스 연결 실패');
    const doc = await this.db.collection(this.MEMBERS_COLLECTION).doc(ouid).get();
    if (doc.exists) throw new Error('이미 등록된 멤버입니다.');
    return this.db.collection(this.APPLICATIONS_COLLECTION).add({ characterName, ouid, status: 'PENDING', appliedAt: window.firebase.firestore.FieldValue.serverTimestamp() });
  }

  async getPendingApplications() {
    if (!this.db) return [];
    const snapshot = await this.db.collection(this.APPLICATIONS_COLLECTION).where('status', '==', 'PENDING').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  async approveApplication(appId, characterName, ouid) {
    const batch = this.db.batch();
    batch.update(this.db.collection(this.APPLICATIONS_COLLECTION).doc(appId), { status: 'APPROVED' });
    batch.set(this.db.collection(this.MEMBERS_COLLECTION).doc(ouid), { characterName, mmr: 1200, hsr: 1200, wins: 0, loses: 0, mmrHistory: [], approvedAt: window.firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
    return batch.commit();
  }

  async rejectApplication(appId) { return this.db.collection(this.APPLICATIONS_COLLECTION).doc(appId).update({ status: 'REJECTED' }); }

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
      for (const redRiflers of combinations(riflers, riflersNeededForRed)) {
        const blueRiflers = riflers.filter(r => !redRiflers.includes(r));
        const redTeam = [...redSnipers, ...redRiflers];
        const blueTeam = [...blueSnipers, ...blueRiflers];
        const redHSR = redTeam.reduce((sum, m) => sum + (m.hsr || m.mmr || 1200), 0);
        const blueHSR = blueTeam.reduce((sum, m) => sum + (m.hsr || m.mmr || 1200), 0);
        const diff = Math.abs(redHSR - blueHSR);
        const redMMR = redTeam.reduce((sum, m) => sum + (m.mmr || 1200), 0);
        const blueMMR = blueTeam.reduce((sum, m) => sum + (m.mmr || 1200), 0);
        if (diff < bestSplit.diff) {
          bestSplit = { red: redTeam, blue: blueTeam, diff, redAvg: redMMR / redTeam.length, blueAvg: blueMMR / blueTeam.length, redHsrAvg: redHSR / redTeam.length, blueHsrAvg: blueHSR / blueTeam.length };
        }
      }
    }
    return bestSplit;
  }
}
