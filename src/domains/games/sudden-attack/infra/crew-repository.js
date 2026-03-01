/**
 * Crew Repository (Infrastructure Layer) - MMR Enhanced
 * Manages Crew member lists, applications, and MMR Rating System.
 */
export class CrewRepository {
  constructor() {
    this.MEMBERS_COLLECTION = 'sa_crew_members';
    this.APPLICATIONS_COLLECTION = 'sa_crew_applications';
    this.HISTORY_COLLECTION = 'sa_crew_history'; // Record of settled matches
    
    // List of Administrators and Moderators (Staff)
    this.STAFF_EMAILS = [
      'admin@trackingsa.com', 
      'hantiger24@naver.com' 
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
   * Get specific crew member data for accumulating stats
   */
  async getMemberStats(characterName) {
    if (!this.db || !characterName) return null;
    try {
      const doc = await this.db.collection(this.MEMBERS_COLLECTION).doc(characterName.toLowerCase()).get();
      if (doc.exists) return doc.data();
      return null;
    } catch (e) { return null; }
  }

  /**
   * Settle MMR for a list of matches
   * Prevents batch overwrite bug by accumulating stats in memory first.
   * @param {Array} matches - Array of MatchRecord objects
   */
  async settleMatches(matches) {
    if (!this.db || matches.length === 0) return [];
    
    // 1. Cache ALL current member stats to prevent overwrite in loop
    const memberCache = {};
    const membersSnap = await this.db.collection(this.MEMBERS_COLLECTION).get();
    membersSnap.forEach(doc => {
      memberCache[doc.id] = {
        mmr: doc.data().mmr || 1200,
        wins: doc.data().wins || 0,
        loses: doc.data().loses || 0,
        isDirty: false
      };
    });

    // 2. Get history to avoid double processing
    const historySnap = await this.db.collection(this.HISTORY_COLLECTION).get();
    const settledSet = new Set(historySnap.docs.map(d => d.id));

    const batch = this.db.batch();
    const processedMatchIds = [];

    // 3. Sort matches chronologically (oldest first) to ensure accurate MMR progression
    const sortedMatches = [...matches].sort((a, b) => new Date(a.matchDate) - new Date(b.matchDate));

    for (const match of sortedMatches) {
      if (settledSet.has(match.matchId)) continue; // Skip if already settled

      // 4. Calculate MMR changes for participants in memory
      for (const p of match.allPlayerStats) {
        if (!p.isCrew) continue;

        const memberId = p.nickname.toLowerCase();
        if (!memberCache[memberId]) continue; // Member not in DB

        const currentData = memberCache[memberId];

        // --- ELO LOGIC ---
        const isWin = p.result === 'WIN';
        const kd = parseFloat(p.kd);
        let change = isWin ? 20 : -20;

        // Weightings
        if (isWin && kd < 0.5) change = 10; // Bus rider
        if (!isWin && kd >= 1.5) change = -10; // Hard carry but lost

        currentData.mmr += change;
        if (isWin) currentData.wins += 1; else currentData.loses += 1;
        currentData.isDirty = true;
      }

      // 5. Mark match as settled in batch
      const historyRef = this.db.collection(this.HISTORY_COLLECTION).doc(match.matchId);
      batch.set(historyRef, {
        settledAt: window.firebase.firestore.FieldValue.serverTimestamp(),
        map: match.mapName,
        crewCount: match.crewParticipants.length
      });
      
      processedMatchIds.push(match.matchId);
      settledSet.add(match.matchId); // Add to local set to prevent dupes in same run
    }

    // 6. Commit accumulated member updates to batch
    for (const memberId in memberCache) {
      if (memberCache[memberId].isDirty) {
        const memberRef = this.db.collection(this.MEMBERS_COLLECTION).doc(memberId);
        batch.update(memberRef, {
          mmr: memberCache[memberId].mmr,
          wins: memberCache[memberId].wins,
          loses: memberCache[memberId].loses,
          updatedAt: window.firebase.firestore.FieldValue.serverTimestamp()
        });
      }
    }

    if (processedMatchIds.length > 0) {
      await batch.commit();
    }
    
    return processedMatchIds;
  }

  /**
   * Reset Season: Clear all MMR, Wins, Loses and History (Admin Only)
   */
  async resetSeason() {
    if (!this.db) throw new Error('DB 연결 실패');
    
    // 1. Reset Members
    const membersSnap = await this.db.collection(this.MEMBERS_COLLECTION).get();
    const batch = this.db.batch();
    
    membersSnap.docs.forEach(doc => {
      batch.update(doc.ref, {
        mmr: 1200,
        wins: 0,
        loses: 0,
        updatedAt: window.firebase.firestore.FieldValue.serverTimestamp()
      });
    });

    // 2. Clear History Collection (Requires multiple batches if large, but crew history is usually small enough for 1 batch)
    const historySnap = await this.db.collection(this.HISTORY_COLLECTION).get();
    historySnap.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();
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

  /**
   * Check if current user is an Admin or Moderator
   * @param {Object} [currentUser] - Optional user object passed from onAuthStateChanged
   */
  isStaff(currentUser = null) {
    const user = currentUser || (typeof window !== 'undefined' && window.firebase && window.firebase.auth ? window.firebase.auth().currentUser : null);
    return user && this.STAFF_EMAILS.includes(user.email);
  }

  /**
   * Smart Team Balancer Algorithm - Position Aware
   * Distributes snipers evenly first, then balances total MMR.
   * @param {Array} selectedMembers - Array of { characterName, mmr, position }
   */
  balanceTeams(selectedMembers) {
    if (selectedMembers.length < 2) return null;

    const snipers = selectedMembers.filter(m => m.position === 'sniper');
    const riflers = selectedMembers.filter(m => m.position === 'rifler');
    
    // Total team size target
    const totalN = selectedMembers.length;
    const teamSize = Math.floor(totalN / 2);

    let bestSplit = { red: [], blue: [], diff: Infinity };

    // Helper for combinations
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

    // 1. Split snipers as evenly as possible
    const redSniperCount = Math.floor(snipers.length / 2);
    const sniperCombos = combinations(snipers, redSniperCount);

    // 2. For each sniper combination, balance the remaining riflers
    for (const redSnipers of sniperCombos) {
      const blueSnipers = snipers.filter(s => !redSnipers.includes(s));
      
      // How many riflers does Red team need?
      const riflersNeededForRed = teamSize - redSnipers.length;
      
      if (riflersNeededForRed < 0 || riflersNeededForRed > riflers.length) continue;

      const riflerCombos = combinations(riflers, riflersNeededForRed);
      
      for (const redRiflers of riflerCombos) {
        const blueRiflers = riflers.filter(r => !redRiflers.includes(r));
        
        const redTeam = [...redSnipers, ...redRiflers];
        const blueTeam = [...blueSnipers, ...blueRiflers];

        // Ensure leftover players go to Blue if odd number
        if (blueTeam.length + redTeam.length < totalN) {
          const leftovers = riflers.filter(r => !redRiflers.includes(r) && !blueRiflers.includes(r));
          blueTeam.push(...leftovers);
        }

        const redMMR = redTeam.reduce((sum, m) => sum + (m.mmr || 1200), 0);
        const blueMMR = blueTeam.reduce((sum, m) => sum + (m.mmr || 1200), 0);
        const diff = Math.abs(redMMR - blueMMR);

        if (diff < bestSplit.diff) {
          bestSplit = { 
            red: redTeam, blue: blueTeam, diff, 
            redAvg: redMMR / redTeam.length, 
            blueAvg: blueMMR / blueTeam.length 
          };
        }
      }
    }

    return bestSplit;
  }
}
