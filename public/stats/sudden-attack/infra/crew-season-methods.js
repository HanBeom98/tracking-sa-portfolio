/** Season archive, reset, and seed behavior mixed into CrewRepository. */
class CrewSeasonMethods {
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

  getManualSeedWeight(recentMatchCount = 0, olderMatchCount = 0, seasonCount = 0) {
    let manualWeight = 0;
    if (recentMatchCount >= 15) manualWeight = 0.15;
    else if (recentMatchCount >= 5) manualWeight = 0.30;
    else manualWeight = 0.45;

    const totalMatchCount = Number(recentMatchCount || 0) + Number(olderMatchCount || 0);
    if (seasonCount >= 2 && totalMatchCount >= 40) return Math.min(manualWeight, 0.05);
    if (seasonCount >= 2 && totalMatchCount >= 25) return Math.min(manualWeight, 0.15);
    return manualWeight;
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
    const olderMatchCount = Number(older?.matchCount || 0);
    const seasonCount = [recent, older].filter(Boolean).length;
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
      manualWeight = this.getManualSeedWeight(recentMatchCount, olderMatchCount, seasonCount);

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

  buildCurrentSeasonReseedState(memberData = {}, seed = {}, changedAt = new Date()) {
    const currentMmr = Number(memberData.mmr || 1200);
    const nextHsr = Number(seed.seedHsr || memberData.hsr || 1200);
    const currentHistory = Array.isArray(memberData.mmrHistory) ? [...memberData.mmrHistory] : [];
    const changedAtIso = changedAt instanceof Date && !Number.isNaN(changedAt.getTime())
      ? changedAt.toISOString()
      : new Date().toISOString();
    const lastEntry = currentHistory[currentHistory.length - 1] || null;
    const nextHistory = (!lastEntry || Number(lastEntry.hsr || lastEntry.mmr || 1200) !== nextHsr)
      ? currentHistory.concat([{ mmr: currentMmr, hsr: nextHsr, date: changedAtIso }]).slice(-this.HISTORY_LIMIT)
      : currentHistory;

    return {
      hsr: nextHsr,
      mmr: currentMmr,
      mmrHistory: nextHistory,
      seasonSeedMmr: 1200,
      seasonSeedHsr: nextHsr,
      seasonSeedSource: `current-reseed:${seed.seedMeta?.source || 'default'}`
    };
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

  async reseedCurrentSeasonHsr() {
    if (!this.db) throw new Error('DB 연결 실패');
    const snapshot = await this.db.collection(this.MEMBERS_COLLECTION).get();
    const currentArchive = this.buildSeasonArchivePayload(snapshot, await this.getSeasonStartDate(), new Date());
    const previousArchives = await this.getRecentSeasonArchives(1);
    const olderArchive = previousArchives[0] || null;
    const changedAt = new Date();
    const batch = this.db.batch();

    snapshot.docs.forEach((doc) => {
      const data = doc.data() || {};
      const seed = this.calculateSeasonSeed(doc.id, currentArchive, olderArchive);
      const reseedState = this.buildCurrentSeasonReseedState(data, seed, changedAt);
      batch.update(doc.ref, {
        hsr: reseedState.hsr,
        mmrHistory: reseedState.mmrHistory,
        seasonSeedMmr: reseedState.seasonSeedMmr,
        seasonSeedHsr: reseedState.seasonSeedHsr,
        seasonSeedSource: reseedState.seasonSeedSource,
        updatedAt: window.firebase.firestore.FieldValue.serverTimestamp()
      });
    });

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
}

export function applyCrewSeasonMethods(targetClass) {
  const descriptors = Object.getOwnPropertyDescriptors(CrewSeasonMethods.prototype);
  delete descriptors.constructor;
  Object.defineProperties(targetClass.prototype, descriptors);
}
