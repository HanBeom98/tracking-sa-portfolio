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

      // Sort logic: 
      // 1. If both are active or both are inactive, sort by MMR (desc)
      // 2. If one is active and the other is not, active one comes first
      return members.sort((a, b) => {
        if (a.totalMatches > 0 && b.totalMatches === 0) return -1;
        if (a.totalMatches === 0 && b.totalMatches > 0) return 1;
        
        // If match status is same, sort by MMR
        if (b.mmr !== a.mmr) return b.mmr - a.mmr;
        
        // If MMR is same, sort by total matches
        return b.totalMatches - a.totalMatches;
      });
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
   * Get MMR History for a specific member
   */
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

  /**
   * Find a member's OUID by their current nickname or any previous nicknames
   */
  async findOuidByNickname(nickname) {
    if (!this.db || !nickname) return null;
    const searchName = nickname.toLowerCase();
    try {
      // 1. Check current names
      let snapshot = await this.db.collection(this.MEMBERS_COLLECTION)
        .where('characterName', '==', nickname)
        .limit(1)
        .get();
      
      if (!snapshot.empty) return snapshot.docs[0].id;

      // 2. Check previousNames array (Firestore 'array-contains' is very efficient)
      snapshot = await this.db.collection(this.MEMBERS_COLLECTION)
        .where('previousNames', 'array-contains', nickname)
        .limit(1)
        .get();

      if (!snapshot.empty) return snapshot.docs[0].id;

      // 3. Last resort: Case-insensitive scan
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

  /**
   * Update nickname for a member and keep track of name history
   */
  async updateNickname(ouid, newNickname) {
    if (!this.db || !ouid || !newNickname) return;
    
    try {
      const docRef = this.db.collection(this.MEMBERS_COLLECTION).doc(ouid);
      const doc = await docRef.get();
      
      if (!doc.exists) return;
      
      const data = doc.data();
      const oldName = data.characterName;
      
      // If name is actually different, update it and push to history
      if (oldName && oldName !== newNickname) {
        const previousNames = data.previousNames || [];
        if (!previousNames.includes(oldName)) {
          previousNames.push(oldName);
        }
        
        console.log(`[CrewRepo] Updating name history for ${ouid}: ${oldName} -> ${newNickname}`);
        return docRef.update({
          characterName: newNickname,
          previousNames: previousNames,
          updatedAt: window.firebase.firestore.FieldValue.serverTimestamp()
        });
      }
    } catch (error) {
      console.error('[CrewRepo] updateNickname failed:', error);
    }
  }

  /**
   * Explicitly add a nickname to a player's history (Robust version)
   */
  async addNicknameToHistory(ouid, nicknameToAdd) {
    if (!this.db || !ouid || !nicknameToAdd) return;
    try {
      // 1. Try finding by OUID first (Standard)
      let docRef = this.db.collection(this.MEMBERS_COLLECTION).doc(ouid);
      let doc = await docRef.get();

      // 2. If not found by OUID, search by characterName field
      if (!doc.exists) {
        const snapshot = await this.db.collection(this.MEMBERS_COLLECTION)
          .where('characterName', '==', nicknameToAdd) // It might be under an old name ID
          .limit(1)
          .get();
        
        if (!snapshot.empty) {
          docRef = snapshot.docs[0].ref;
          doc = snapshot.docs[0];
        } else {
          return;
        }
      }

      const data = doc.data();
      const currentName = data.characterName;
      const previousNames = data.previousNames || [];

      if (currentName === nicknameToAdd || previousNames.includes(nicknameToAdd)) return;

      previousNames.push(nicknameToAdd);
      console.log(`[CrewRepo] Successfully linked ${nicknameToAdd} to member history.`);
      
      return docRef.update({
        previousNames: previousNames,
        updatedAt: window.firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch (error) {
      console.error('[CrewRepo] addNicknameToHistory failed:', error);
    }
  }

  /**
   * Batch sync discovered nicknames (Used during settlement to overcome permissions)
   */
  async syncHistoricalNicknames(discoveredMap) {
    if (!this.db || !discoveredMap) return;
    console.log('[CrewRepo] Starting batch nickname sync...');
    
    for (const ouid in discoveredMap) {
      const names = Array.from(discoveredMap[ouid]);
      for (const name of names) {
        await this.addNicknameToHistory(ouid, name);
      }
    }
  }

  /**
   * Delete a member from the crew
   * Enhanced: Deletes by OUID and also attempts to delete legacy name-based doc
   */
  async deleteMember(ouid, nickname = null) {
    if (!this.db || !ouid) return;
    const batch = this.db.batch();
    
    // 1. Delete OUID-based document
    const ouidRef = this.db.collection(this.MEMBERS_COLLECTION).doc(ouid);
    batch.delete(ouidRef);

    // 2. Delete legacy name-based document if nickname provided
    if (nickname) {
      const nameRef = this.db.collection(this.MEMBERS_COLLECTION).doc(nickname);
      batch.delete(nameRef);
    }

    return batch.commit();
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
   * Manually set the season start date
   */
  async setSeasonStartDate(date) {
    if (!this.db) throw new Error('DB 연결 실패');
    const settingsRef = this.db.collection(this.SETTINGS_COLLECTION).doc('season');
    return settingsRef.set({ 
      startDate: window.firebase.firestore.Timestamp.fromDate(new Date(date)) 
    }, { merge: true });
  }

  /**
   * Settle MMR for a list of matches
   */
  async settleMatches(matches) {
    if (!this.db || matches.length === 0) return [];
    
    const seasonStartDate = await this.getSeasonStartDate();
    const memberCache = {};
    const membersSnap = await this.db.collection(this.MEMBERS_COLLECTION).get();
    
    // Mapping: OUID -> MemberData & Nickname -> MemberData (Cache)
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
        mmrHistory: data.mmrHistory || [], // Load existing history
        mmrHistoryToAppend: [], 
        isDirty: false
      };
      memberCache[doc.id] = cacheObj;
      
      // Index current name
      if (data.characterName) {
        nameMap[data.characterName.toLowerCase()] = cacheObj;
      }
      
      // Index all previous names for historical matching
      if (data.previousNames && Array.isArray(data.previousNames)) {
        data.previousNames.forEach(prevName => {
          nameMap[prevName.toLowerCase()] = cacheObj;
        });
      }
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
        
        let currentData = p.ouid && memberCache[p.ouid] ? memberCache[p.ouid] : nameMap[p.nickname.toLowerCase()];

        if (!currentData && this.apiClient) {
            try {
                const liveOuid = await this.apiClient.getOuid(p.nickname);
                if (liveOuid && memberCache[liveOuid]) {
                    currentData = memberCache[liveOuid];
                    nameMap[p.nickname.toLowerCase()] = currentData;
                }
            } catch (e) {}
        }

        if (!currentData) continue; 

        const isWin = p.result === 'WIN';
        const kill = parseInt(p.kill || 0);
        const death = parseInt(p.death || 0);
        const kd = parseFloat(p.kd || 0);
        
        // 1. Public MMR: 승패 기반 (±20)
        let mmrChange = isWin ? 20 : -20;
        currentData.mmr += mmrChange;

        // 2. Hidden Skill Rating (HSR): 퍼포먼스 기반
        // 기본 승패 점수 축소 (±10), K/D 편차에 따른 점수 확대 (최대 ±15)
        let hsrChange = isWin ? 10 : -10;
        
        // 기준 K/D 1.0 대비 편차 계산
        const kdDeviance = kd - 1.0;
        // 편차 0.1당 1.5점 가감 (K/D 2.0이면 +15점, K/D 0.0이면 -15점)
        let performanceAdj = Math.round(kdDeviance * 15);
        performanceAdj = Math.max(-15, Math.min(15, performanceAdj)); // 캡 제한

        hsrChange += performanceAdj;

        // --- PERFORMANCE BONUS UPGRADE (Damage-centric) ---
        // 1. Damage Bonus (+1 per 1000 damage)
        if (p.damage > 0) {
          const damageBonus = Math.floor(p.damage / 1000);
          if (damageBonus > 0) {
            hsrChange += damageBonus;
            console.log(`[CrewRepo] ${p.nickname} high damage bonus: +${damageBonus}`);
          }
        }

        // 2. MVP Bonus (+5 pts)
        if (p.isMvp) {
          hsrChange += 5;
          console.log(`[CrewRepo] ${p.nickname} MVP bonus: +5`);
        }

        currentData.hsr += hsrChange;

        if (isWin) currentData.wins += 1; else currentData.loses += 1;
        currentData.crewKills += kill;
        currentData.crewDeaths += death;
        
        // Append point to history
        currentData.mmrHistory.push({
          mmr: currentData.mmr,
          date: match.matchDate
        });

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
        
        // Final trim before saving
        const finalHistory = memberCache[ouid].mmrHistory.slice(-this.HISTORY_LIMIT);

        batch.update(memberRef, {
          mmr: memberCache[ouid].mmr,
          wins: memberCache[ouid].wins,
          loses: memberCache[ouid].loses,
          crewKills: memberCache[ouid].crewKills,
          crewDeaths: memberCache[ouid].crewDeaths,
          mmrHistory: finalHistory, // Save trimmed history
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
      batch.update(doc.ref, { 
        mmr: 1200, hsr: 1200, wins: 0, loses: 0, 
        crewKills: 0, crewDeaths: 0,
        mmrHistory: [], 
        updatedAt: window.firebase.firestore.FieldValue.serverTimestamp() 
      });
    });
    const settingsRef = this.db.collection(this.SETTINGS_COLLECTION).doc('season');
    batch.set(settingsRef, { startDate: window.firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
    await batch.commit();
  }

  /**
   * REPAIR LOGIC: Resets stats and clears history to allow re-settlement
   * Enhanced: Now respects the current season start date.
   */
  async repairSeasonData() {
    if (!this.db) throw new Error('DB 연결 실패');
    
    // 1. Get current season start date first
    const seasonStartDate = await this.getSeasonStartDate();
    
    // 2. Reset all members stats to zero/default
    const membersSnap = await this.db.collection(this.MEMBERS_COLLECTION).get();
    const batch = this.db.batch();
    membersSnap.docs.forEach(doc => {
      batch.update(doc.ref, { 
        mmr: 1200, wins: 0, loses: 0, 
        crewKills: 0, crewDeaths: 0,
        mmrHistory: [],
        updatedAt: window.firebase.firestore.FieldValue.serverTimestamp() 
      });
    });

    // 3. Clear only history entries that belong to the current season
    const historySnap = await this.db.collection(this.HISTORY_COLLECTION).get();
    historySnap.docs.forEach(doc => {
      const data = doc.data();
      // If no matchDate exists, or if it's after the current season start, delete it
      if (!data.matchDate || new Date(data.matchDate) >= seasonStartDate) {
        batch.delete(doc.ref);
      }
    });

    // 4. Do NOT change the settings/season/startDate. Keep it as is.

    await batch.commit();
    console.log(`[CrewRepo] Season data repaired. Respected start date: ${seasonStartDate}`);
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
      mmrHistory: [],
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
        // HSR 기준으로 팀간 격차 계산
        const redHSR = redTeam.reduce((sum, m) => sum + (m.hsr || m.mmr || 1200), 0);
        const blueHSR = blueTeam.reduce((sum, m) => sum + (m.hsr || m.mmr || 1200), 0);
        const diff = Math.abs(redHSR - blueHSR);
        
        // UI 출력을 위해 Public MMR 평균도 별도 계산
        const redMMR = redTeam.reduce((sum, m) => sum + (m.mmr || 1200), 0);
        const blueMMR = blueTeam.reduce((sum, m) => sum + (m.mmr || 1200), 0);
        
        if (diff < bestSplit.diff) {
          bestSplit = { 
            red: redTeam, 
            blue: blueTeam, 
            diff: diff, // HSR 격차
            redAvg: redMMR / redTeam.length, 
            blueAvg: blueMMR / blueTeam.length,
            redHsrAvg: redHSR / redTeam.length,
            blueHsrAvg: blueHSR / blueTeam.length
          };
        }
      }
    }
    return bestSplit;
  }
}
