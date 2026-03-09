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
    this.MATCH_SESSIONS_COLLECTION = 'sa_crew_match_sessions';
    this.MANUAL_ABANDONS_COLLECTION = 'sa_crew_manual_abandons';
    this.SEASON_ARCHIVE_DOC = 'season_archive_latest';
    this.SEASON_ARCHIVE_PREFIX = 'season_archive_';
    this.SEASON_ARCHIVE_INDEX_DOC = 'season_archives_index';
    this.MANUAL_SEED_TIERS = [
      'BRONZE',
      'SILVER',
      'GOLD',
      'MASTER',
      'GRANDMASTER',
      'LEGEND',
      'BLACK_LEGEND',
      'STAR_LEGEND'
    ];
    this.MANUAL_SEED_TIER_LABELS = {
      BRONZE: '브론즈',
      SILVER: '실버',
      GOLD: '골드',
      MASTER: '마스터',
      GRANDMASTER: '그랜드마스터',
      LEGEND: '레전드',
      BLACK_LEGEND: '불레전드 (in300)',
      STAR_LEGEND: '별레전드 (in100)'
    };
    this.MANUAL_SEED_TIER_HSR = {
      BRONZE: 1080,
      SILVER: 1160,
      GOLD: 1240,
      MASTER: 1320,
      GRANDMASTER: 1400,
      LEGEND: 1480,
      BLACK_LEGEND: 1540,
      STAR_LEGEND: 1600
    };
    this.HISTORY_LIMIT = 50; // Max match history points to store for trend
    this.MATCH_SESSION_LOOKBACK_MS = 6 * 60 * 60 * 1000;
    this.MIN_SESSION_OVERLAP = 6;
    this.ABANDON_MMR_PENALTY = -30;
    this.ABANDON_HSR_PENALTY = -20;
    
    // List of Administrators and Moderators (Staff)
    this.STAFF_EMAILS = [
      'admin@trackingsa.com', 
      'hantiger24@naver.com',
      'bjs5739@naver.com',
      'jungsion98@naver.com',
      'wasd1234@naver.com'
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

  async getLatestSeasonArchiveHistory(ouid) {
    if (!this.db || !ouid) return [];
    try {
      const doc = await this.db.collection(this.SETTINGS_COLLECTION).doc(this.SEASON_ARCHIVE_DOC).get();
      if (!doc.exists) return [];
      const archive = doc.data() || {};
      const members = archive.members || {};
      const item = members[ouid];
      if (!item || !Array.isArray(item.mmrHistory)) return [];
      return item.mmrHistory;
    } catch (err) {
      console.warn('[CrewRepo] Failed to read season archive history:', err);
      return [];
    }
  }

  formatSeasonKeyPart(date) {
    const safeDate = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date(0);
    return safeDate.toISOString().slice(0, 10);
  }

  buildSeasonArchiveId(startDate, endDate = new Date()) {
    return `${this.SEASON_ARCHIVE_PREFIX}${this.formatSeasonKeyPart(startDate)}_${this.formatSeasonKeyPart(endDate)}`;
  }

  normalizeSeasonMemberArchive(ouid, data = {}) {
    const wins = Number(data.wins || 0);
    const loses = Number(data.loses || 0);
    const mmrHistory = Array.isArray(data.mmrHistory) ? data.mmrHistory : [];
    const latestEntry = mmrHistory.length > 0 ? mmrHistory[mmrHistory.length - 1] : null;
    const finalMmr = Number(latestEntry?.mmr ?? data.mmr ?? 1200);
    const finalHsr = Number(latestEntry?.hsr ?? data.hsr ?? finalMmr);
    return {
      ouid,
      characterName: data.characterName || "",
      finalMmr,
      finalHsr,
      wins,
      loses,
      matchCount: Number(data.matchCount ?? (wins + loses)),
      crewKills: Number(data.crewKills || 0),
      crewDeaths: Number(data.crewDeaths || 0),
      manualSeedTier: data.manualSeedTier || "",
      mmrHistory
    };
  }

  getManualSeedTierOptions() {
    return this.MANUAL_SEED_TIERS.map((tier) => ({
      value: tier,
      label: this.MANUAL_SEED_TIER_LABELS[tier] || tier,
      hsr: Number(this.MANUAL_SEED_TIER_HSR[tier] || 1200)
    }));
  }

  getManualSeedTierHsr(tier = "") {
    return Number(this.MANUAL_SEED_TIER_HSR[tier] || 1200);
  }

  async updateManualSeedTier(ouid, manualSeedTier = "") {
    if (!this.db || !ouid) throw new Error('DB 연결 실패');
    const normalizedTier = String(manualSeedTier || '').trim().toUpperCase();
    if (normalizedTier && !this.MANUAL_SEED_TIERS.includes(normalizedTier)) {
      throw new Error('유효하지 않은 최고티어 값입니다.');
    }
    return this.db.collection(this.MEMBERS_COLLECTION).doc(ouid).update({
      manualSeedTier: normalizedTier,
      updatedAt: window.firebase.firestore.FieldValue.serverTimestamp()
    });
  }

  buildSeasonArchivePayload(snapshot, seasonStart, seasonEnd = new Date()) {
    const archivedMembers = {};
    snapshot.docs.forEach((doc) => {
      const data = doc.data() || {};
      const normalized = this.normalizeSeasonMemberArchive(doc.id, data);
      if (normalized.matchCount > 0 || normalized.mmrHistory.length > 0) {
        archivedMembers[doc.id] = normalized;
      }
    });

    return {
      seasonId: this.buildSeasonArchiveId(seasonStart, seasonEnd).replace(this.SEASON_ARCHIVE_PREFIX, ''),
      seasonStart: window.firebase.firestore.Timestamp.fromDate(seasonStart),
      seasonEnd: window.firebase.firestore.Timestamp.fromDate(seasonEnd),
      archivedAt: window.firebase.firestore.FieldValue.serverTimestamp(),
      members: archivedMembers
    };
  }

  async getSeasonArchiveIndex() {
    if (!this.db) return [];
    try {
      const doc = await this.db.collection(this.SETTINGS_COLLECTION).doc(this.SEASON_ARCHIVE_INDEX_DOC).get();
      if (!doc.exists) return [];
      const archives = Array.isArray(doc.data()?.archives) ? doc.data().archives : [];
      return archives
        .filter((item) => item?.docId)
        .sort((a, b) => {
          const aTime = this.toDateSafe(a.seasonEnd)?.getTime() || 0;
          const bTime = this.toDateSafe(b.seasonEnd)?.getTime() || 0;
          return bTime - aTime;
        });
    } catch (err) {
      console.warn('[CrewRepo] Failed to read season archive index:', err);
      return [];
    }
  }

  async getRecentSeasonArchives(limit = 2) {
    if (!this.db) return [];
    const index = await this.getSeasonArchiveIndex();
    const targets = index.slice(0, limit);
    if (targets.length === 0) return [];

    const docs = await Promise.all(
      targets.map((item) => this.db.collection(this.SETTINGS_COLLECTION).doc(item.docId).get())
    );

    return docs
      .filter((doc) => doc.exists)
      .map((doc) => ({ id: doc.id, ...(doc.data() || {}) }));
  }

  getArchiveMemberRecord(archive = null, ouid = "") {
    if (!archive || !ouid) return null;
    const raw = archive.members?.[ouid];
    if (!raw) return null;
    return this.normalizeSeasonMemberArchive(ouid, raw);
  }

  calculateSeasonSeed(memberId, recentArchive = null, olderArchive = null) {
    const recent = this.getArchiveMemberRecord(recentArchive, memberId);
    const older = this.getArchiveMemberRecord(olderArchive, memberId);
    const manualSeedTier = recent?.manualSeedTier || older?.manualSeedTier || "";
    const manualSeedHsr = this.getManualSeedTierHsr(manualSeedTier);

    if (!recent && !older) {
      return {
        seedMmr: 1200,
        seedHsr: manualSeedTier ? manualSeedHsr : 1200,
        seedMeta: {
          recentWeight: 0,
          olderWeight: 0,
          baselineWeight: manualSeedTier ? 0 : 1,
          manualWeight: manualSeedTier ? 1 : 0,
          source: manualSeedTier ? 'manual-tier' : 'default',
          manualSeedTier
        }
      };
    }

    const recentMatchCount = Number(recent?.matchCount || 0);
    let recentWeight = 0.30;
    let olderWeight = 0.30;
    let baselineWeight = 0.40;
    let manualWeight = 0;
    if (recentMatchCount >= 15) {
      recentWeight = 0.75;
      olderWeight = 0.25;
      baselineWeight = 0;
    } else if (recentMatchCount >= 5) {
      recentWeight = 0.55;
      olderWeight = 0.25;
      baselineWeight = 0.20;
    }

    if (!older) {
      baselineWeight += olderWeight;
      olderWeight = 0;
    }
    if (!recent) {
      recentWeight = 0;
      olderWeight = 0.60;
      baselineWeight = 0.40;
    }

    let hsrRecentWeight = recentWeight;
    let hsrOlderWeight = olderWeight;
    let hsrBaselineWeight = baselineWeight;
    if (manualSeedTier) {
      if (recentMatchCount >= 15) manualWeight = 0.15;
      else if (recentMatchCount >= 5) manualWeight = 0.30;
      else manualWeight = 0.45;

      const nonManualWeight = hsrRecentWeight + hsrOlderWeight + hsrBaselineWeight;
      const scale = nonManualWeight > 0 ? (1 - manualWeight) / nonManualWeight : 0;
      hsrRecentWeight *= scale;
      hsrOlderWeight *= scale;
      hsrBaselineWeight *= scale;
    }

    const baseHsr = (Number(recent?.finalHsr || 1200) * hsrRecentWeight)
      + (Number(older?.finalHsr || 1200) * hsrOlderWeight)
      + (manualSeedHsr * manualWeight)
      + (1200 * hsrBaselineWeight);
    const baseMmr = (Number(recent?.finalMmr || 1200) * recentWeight)
      + (Number(older?.finalMmr || 1200) * olderWeight)
      + (1200 * baselineWeight);

    const seedHsr = Math.round(1200 + ((baseHsr - 1200) * 0.8));
    const seedMmr = Math.round(1200 + ((baseMmr - 1200) * 0.8));

    return {
      seedMmr,
      seedHsr,
      seedMeta: {
        recentWeight: hsrRecentWeight,
        olderWeight: hsrOlderWeight,
        baselineWeight: hsrBaselineWeight,
        manualWeight,
        source: manualSeedTier
          ? `${recent && older ? 'recent+older' : recent ? 'recent' : 'older'}+manual-tier`
          : recent && older ? 'recent+older' : recent ? 'recent' : 'older',
        manualSeedTier
      }
    };
  }

  buildSeasonResetState(seed = {}) {
    return {
      mmr: 1200,
      hsr: Number(seed.seedHsr || 1200),
      wins: 0,
      loses: 0,
      crewKills: 0,
      crewDeaths: 0,
      mmrHistory: [],
      seasonSeedMmr: 1200,
      seasonSeedHsr: Number(seed.seedHsr || 1200),
      seasonSeedSource: seed.seedMeta?.source || 'default'
    };
  }

  async getHistory(limit = 300) {
    if (!this.db) return [];
    try {
      const snapshot = await this.db.collection(this.HISTORY_COLLECTION).get();
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
        .slice(0, limit);
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
    memberData.mmr += this.ABANDON_MMR_PENALTY;
    memberData.hsr += this.ABANDON_HSR_PENALTY;
    memberData.loses += 1;
    memberData.mmrHistory.push({ mmr: memberData.mmr, hsr: memberData.hsr, date: matchDate });
    memberData.isDirty = true;
    return {
      mmrDiff: this.ABANDON_MMR_PENALTY,
      hsrDiff: this.ABANDON_HSR_PENALTY,
      newMmr: memberData.mmr,
      newHsr: memberData.hsr,
      loses: memberData.loses
    };
  }

  buildManualAbandonHistoryPatch(entries = [], baseHistory = {}) {
    const manualAbandonOuids = Array.isArray(baseHistory.manualAbandonOuids)
      ? [...baseHistory.manualAbandonOuids]
      : [];
    const manualAbandonNicknames = Array.isArray(baseHistory.manualAbandonNicknames)
      ? [...baseHistory.manualAbandonNicknames]
      : [];

    entries.forEach((entry) => {
      if (entry?.ouid && !manualAbandonOuids.includes(entry.ouid)) {
        manualAbandonOuids.push(entry.ouid);
      }
      if (entry?.nickname && !manualAbandonNicknames.includes(entry.nickname)) {
        manualAbandonNicknames.push(entry.nickname);
      }
    });

    return {
      abandonCount: Number(baseHistory.abandonCount || 0) + entries.length,
      manualAbandonOuids,
      manualAbandonNicknames
    };
  }

  async applyManualAbandonPenalty({ ouid = "", nickname = "", matchId = "", reason = "", appliedBy = null } = {}) {
    const trimmedReason = String(reason || "").trim();
    if (!trimmedReason) throw new Error('적용 사유를 입력해주세요.');
    if (!this.db) throw new Error('DB 연결 실패');
    const resolvedOuid = ouid || await this.findOuidByNickname(nickname);
    if (!resolvedOuid) throw new Error('대상 멤버를 찾을 수 없습니다.');
    if (!matchId) throw new Error('경기를 선택해주세요.');

    const memberRef = this.db.collection(this.MEMBERS_COLLECTION).doc(resolvedOuid);
    const historyRef = this.db.collection(this.HISTORY_COLLECTION).doc(matchId);
    const manualRef = this.db.collection(this.MANUAL_ABANDONS_COLLECTION).doc(this.buildManualAbandonDocId(resolvedOuid, matchId));
    const [memberDoc, historyDoc, manualDoc] = await Promise.all([memberRef.get(), historyRef.get(), manualRef.get()]);

    if (!memberDoc.exists) throw new Error('대상 멤버 문서가 없습니다.');
    if (!historyDoc.exists) throw new Error('경기 기록을 찾을 수 없습니다.');

    const memberData = memberDoc.data() || {};
    const historyData = historyDoc.data() || {};
    const matchDate = historyData.matchDate || "";
    if (!matchDate) throw new Error('선택한 경기의 날짜 정보가 없습니다.');

    const existingOuids = Array.isArray(historyData.manualAbandonOuids) ? historyData.manualAbandonOuids : [];
    if (manualDoc.exists) {
      throw new Error('이미 수동 탈주 패널티가 적용된 멤버입니다.');
    }
    if (existingOuids.includes(resolvedOuid)) {
      throw new Error('이미 수동 탈주 패널티가 적용된 멤버입니다.');
    }

    const currentHistory = Array.isArray(memberData.mmrHistory) ? [...memberData.mmrHistory] : [];
    if (currentHistory.some((entry) => entry?.date === matchDate)) {
      throw new Error('해당 경기 시각으로 이미 점수 기록이 있어 중복 적용할 수 없습니다.');
    }

    const nextMmr = Number(memberData.mmr || 1200) + this.ABANDON_MMR_PENALTY;
    const nextHsr = Number(memberData.hsr || memberData.mmr || 1200) + this.ABANDON_HSR_PENALTY;
    const nextLoses = Number(memberData.loses || 0) + 1;
    const nextHistory = currentHistory
      .concat([{ mmr: nextMmr, hsr: nextHsr, date: matchDate }])
      .slice(-this.HISTORY_LIMIT);

    const manualNicknames = Array.isArray(historyData.manualAbandonNicknames) ? [...historyData.manualAbandonNicknames] : [];
    const targetName = nickname || memberData.characterName || "";
    if (targetName && !manualNicknames.includes(targetName)) manualNicknames.push(targetName);
    const manualOuids = [...existingOuids];
    if (!manualOuids.includes(resolvedOuid)) manualOuids.push(resolvedOuid);
    const manualReasons = Array.isArray(historyData.manualAbandonReasons) ? [...historyData.manualAbandonReasons] : [];
    manualReasons.push(trimmedReason);
    const manualAppliedByEmails = Array.isArray(historyData.manualAbandonAppliedByEmails) ? [...historyData.manualAbandonAppliedByEmails] : [];
    const appliedByEmail = String(appliedBy?.email || "").trim();
    if (appliedByEmail) manualAppliedByEmails.push(appliedByEmail);
    const appliedByUid = String(appliedBy?.uid || "").trim();

    const batch = this.db.batch();
    batch.update(memberRef, {
      mmr: nextMmr,
      hsr: nextHsr,
      loses: nextLoses,
      mmrHistory: nextHistory,
      updatedAt: window.firebase.firestore.FieldValue.serverTimestamp()
    });
    batch.update(historyRef, {
      abandonCount: Number(historyData.abandonCount || 0) + 1,
      manualAbandonNicknames: manualNicknames,
      manualAbandonOuids: manualOuids,
      manualAbandonReasons: manualReasons,
      manualAbandonAppliedByEmails: manualAppliedByEmails
    });
    batch.set(manualRef, {
      ouid: resolvedOuid,
      nickname: targetName || resolvedOuid,
      matchId,
      matchDate,
      mapName: historyData.map || "알 수 없음",
      mmrDiff: this.ABANDON_MMR_PENALTY,
      hsrDiff: this.ABANDON_HSR_PENALTY,
      reason: trimmedReason,
      appliedByUid: appliedByUid || null,
      appliedByEmail: appliedByEmail || null,
      appliedAt: window.firebase.firestore.FieldValue.serverTimestamp(),
      createdAt: window.firebase.firestore.FieldValue.serverTimestamp()
    });
    await batch.commit();

    return {
      ouid: resolvedOuid,
      nickname: targetName || resolvedOuid,
      matchId,
      matchDate,
      mapName: historyData.map || "알 수 없음",
      mmrDiff: this.ABANDON_MMR_PENALTY,
      hsrDiff: this.ABANDON_HSR_PENALTY,
      reason: trimmedReason,
      appliedByUid: appliedByUid || null,
      appliedByEmail: appliedByEmail || null,
      newMmr: nextMmr,
      newHsr: nextHsr,
      loses: nextLoses
    };
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
    if (!value) return null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    if (typeof value?.toDate === 'function') {
      const converted = value.toDate();
      return Number.isNaN(converted?.getTime?.()) ? null : converted;
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
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
    const present = new Set();
    const players = Array.isArray(match?.allPlayerStats) ? match.allPlayerStats : [];
    players.forEach((player) => {
      const nickname = String(player?.nickname || "").toLowerCase().trim();
      if (player?.ouid && memberCache[player.ouid]) present.add(player.ouid);
      const byName = nickname ? nameMap[nickname] : null;
      if (byName?.ouid) present.add(byName.ouid);
    });
    return present;
  }

  findPendingSessionForMatch(match, pendingSessions = [], memberCache = {}, nameMap = {}, usedSessionIds = new Set()) {
    const matchDate = this.toDateSafe(match?.matchDate);
    if (!matchDate) return null;

    const present = this.getMatchPresenceSet(match, memberCache, nameMap);
    let best = null;

    pendingSessions.forEach((session) => {
      if (!session?.id || usedSessionIds.has(session.id)) return;
      const participants = Array.isArray(session.participants) ? session.participants.filter((item) => item?.ouid) : [];
      if (participants.length < 8) return;

      const createdAt = this.toDateSafe(session.createdAt);
      if (createdAt && matchDate.getTime() < createdAt.getTime()) return;
      if (createdAt && (matchDate.getTime() - createdAt.getTime()) > this.MATCH_SESSION_LOOKBACK_MS) return;

      const overlap = participants.filter((item) => present.has(item.ouid)).length;
      if (overlap < Math.min(this.MIN_SESSION_OVERLAP, participants.length)) return;

      const missing = participants.filter((item) => !present.has(item.ouid));
      if (missing.length === 0) return;

      const score = overlap * 100 - missing.length;
      const candidate = { session, overlap, missing, score };
      if (!best || candidate.score > best.score) best = candidate;
    });

    return best;
  }

  applyAbandonPenalty(memberData, matchDate) {
    memberData.mmr += this.ABANDON_MMR_PENALTY;
    memberData.hsr += this.ABANDON_HSR_PENALTY;
    memberData.loses += 1;
    memberData.mmrHistory.push({ mmr: memberData.mmr, hsr: memberData.hsr, date: matchDate });
    memberData.isDirty = true;
    return {
      mmrDiff: this.ABANDON_MMR_PENALTY,
      hsrDiff: this.ABANDON_HSR_PENALTY
    };
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
        characterName: data.characterName || "",
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
    const historyStateMap = new Map(
      historySnap.docs.map((doc) => [doc.id, doc.data() || {}])
    );
    const pendingSessions = await this.getPendingMatchSessions();
    const manualAbandons = await this.getManualAbandonEntries();
    const usedSessionIds = new Set();
    const batch = this.db.batch();
    const settlementReports = [];
    const sortedMatches = [...matches].sort((a, b) => new Date(a.matchDate) - new Date(b.matchDate));

    for (const match of sortedMatches) {
      if (new Date(match.matchDate) < seasonStartDate) continue;
      if (settledSet.has(match.matchId)) continue;

      const playerChanges = [];
      const processedOuids = new Set();
      const matchedSession = this.findPendingSessionForMatch(match, pendingSessions, memberCache, nameMap, usedSessionIds);

      for (const p of match.allPlayerStats) {
        if (!p.isCrew) continue;
        
        let currentData = p.ouid && memberCache[p.ouid] ? memberCache[p.ouid] : nameMap[p.nickname.toLowerCase()];
        if (!currentData) continue; 
        processedOuids.add(currentData.ouid);

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

      let abandonCount = 0;
      if (matchedSession) {
        matchedSession.missing.forEach((missingMember) => {
          const currentData = memberCache[missingMember.ouid];
          if (!currentData || processedOuids.has(currentData.ouid)) return;
          const penalty = this.applyAbandonPenalty(currentData, match.matchDate);
          abandonCount += 1;
          processedOuids.add(currentData.ouid);
          playerChanges.push({
            nickname: missingMember.characterName || currentData.characterName || missingMember.ouid,
            originalResult: 'ABANDON',
            mmrDiff: penalty.mmrDiff,
            hsrDiff: penalty.hsrDiff,
            newMmr: currentData.mmr,
            newHsr: currentData.hsr
          });
        });
      }

      batch.set(this.db.collection(this.HISTORY_COLLECTION).doc(match.matchId), {
        settledAt: window.firebase.firestore.FieldValue.serverTimestamp(),
        map: match.mapName,
        matchDate: match.matchDate,
        crewCount: match.crewParticipants.length,
        abandonCount,
        matchedSessionId: matchedSession?.session?.id || null
      });
      historyStateMap.set(match.matchId, {
        ...(historyStateMap.get(match.matchId) || {}),
        map: match.mapName,
        matchDate: match.matchDate,
        crewCount: match.crewParticipants.length,
        abandonCount,
        matchedSessionId: matchedSession?.session?.id || null
      });
      if (matchedSession?.session?.id) {
        batch.update(this.db.collection(this.MATCH_SESSIONS_COLLECTION).doc(matchedSession.session.id), {
          status: 'SETTLED',
          settledMatchId: match.matchId,
          settledAt: window.firebase.firestore.FieldValue.serverTimestamp()
        });
        usedSessionIds.add(matchedSession.session.id);
      }
      settlementReports.push({ match, playerChanges });
      settledSet.add(match.matchId);
    }

    const manualAbandonsByMatch = new Map();
    manualAbandons.forEach((entry) => {
      const currentData = memberCache[entry.ouid];
      if (settledSet.has(entry.matchId)) {
        const items = manualAbandonsByMatch.get(entry.matchId) || [];
        items.push(entry);
        manualAbandonsByMatch.set(entry.matchId, items);
      }
      if (!currentData) return;
      if ((currentData.mmrHistory || []).some((item) => item?.date === entry.matchDate)) return;
      this.applyManualAbandonToMember(currentData, entry.matchDate);
    });

    manualAbandonsByMatch.forEach((entries, matchId) => {
      const baseHistory = historyStateMap.get(matchId) || {};
      const patch = this.buildManualAbandonHistoryPatch(entries, baseHistory);
      batch.set(this.db.collection(this.HISTORY_COLLECTION).doc(matchId), patch, { merge: true });
      historyStateMap.set(matchId, { ...baseHistory, ...patch });
    });

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
    const previousSeasonStart = await this.getSeasonStartDate();
    const seasonEnd = new Date();
    const snapshot = await this.db.collection(this.MEMBERS_COLLECTION).get();
    const archivePayload = this.buildSeasonArchivePayload(snapshot, previousSeasonStart, seasonEnd);
    const archiveDocId = this.buildSeasonArchiveId(previousSeasonStart, seasonEnd);
    const previousArchives = await this.getRecentSeasonArchives(2);
    const recentArchive = { id: archiveDocId, ...archivePayload };
    const olderArchive = previousArchives[0] || null;
    const archiveIndex = await this.getSeasonArchiveIndex();
    const nextArchiveIndex = [
      {
        docId: archiveDocId,
        seasonId: archivePayload.seasonId,
        seasonStart: archivePayload.seasonStart,
        seasonEnd: archivePayload.seasonEnd
      },
      ...archiveIndex.filter((item) => item.docId !== archiveDocId)
    ].slice(0, 12);

    const batch = this.db.batch();
    snapshot.docs.forEach((doc) => {
      const seed = this.calculateSeasonSeed(doc.id, recentArchive, olderArchive);
      batch.update(doc.ref, {
        ...this.buildSeasonResetState(seed),
        updatedAt: window.firebase.firestore.FieldValue.serverTimestamp()
      });
    });
    batch.set(this.db.collection(this.SETTINGS_COLLECTION).doc(archiveDocId), archivePayload, { merge: false });
    batch.set(this.db.collection(this.SETTINGS_COLLECTION).doc(this.SEASON_ARCHIVE_DOC), archivePayload, { merge: false });
    batch.set(
      this.db.collection(this.SETTINGS_COLLECTION).doc(this.SEASON_ARCHIVE_INDEX_DOC),
      { archives: nextArchiveIndex, updatedAt: window.firebase.firestore.FieldValue.serverTimestamp() },
      { merge: true }
    );
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
