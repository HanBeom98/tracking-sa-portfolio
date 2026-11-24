const ACTIVITY_CACHE_PREFIX = 'sa_activity_31:v4:';
const KOREA_DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

function getKoreaDateKey(timestamp = Date.now()) {
  return KOREA_DATE_FORMATTER.format(new Date(timestamp));
}

export class SaPageUseCases {
  constructor({ service, profileQueryService, crewRepo, repository, highlightsService, crewSeasonUseCases }) {
    this.service = service;
    this.profileQueryService = profileQueryService;
    this.crewRepo = crewRepo;
    this.repository = repository;
    this.highlightsService = highlightsService;
    this.crewSeasonUseCases = crewSeasonUseCases;
    this.dashboardCache = null;
    this.dashboardCacheTtlMs = 60 * 1000;
    this.matchCategoryCache = new Map();
    this.pendingMatchCategoryRequests = new Map();
    this.matchCategoryCacheTtlMs = 5 * 60 * 1000;
    this.playerActivityCache = new Map();
    this.pendingPlayerActivityRequests = new Map();
    this.playerActivityDayCache = new Map();
    this.pendingPlayerActivityDayRequests = new Map();
  }

  async loadPlayerProfile(name, currentRankings = [], onFreshData = null, options = {}) {
    if (options.forceRefresh) this.repository?.invalidateMatchLists?.();
    return this.profileQueryService.getFullPlayerProfile(name, currentRankings, onFreshData, options);
  }

  async loadPublicMatchCategory(player, category) {
    const cacheKey = `${player?.ouid || ''}:${category}`;
    const cached = this.matchCategoryCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < this.matchCategoryCacheTtlMs) {
      return cached.data;
    }
    if (this.pendingMatchCategoryRequests.has(cacheKey)) {
      return this.pendingMatchCategoryRequests.get(cacheKey);
    }
    const request = this.service.getPublicMatchCategory(player, category)
      .then((data) => {
        if (this.pendingMatchCategoryRequests.get(cacheKey) === request) {
          this.matchCategoryCache.set(cacheKey, { data, timestamp: Date.now() });
        }
        return data;
      })
      .finally(() => {
        if (this.pendingMatchCategoryRequests.get(cacheKey) === request) {
          this.pendingMatchCategoryRequests.delete(cacheKey);
        }
      });
    this.pendingMatchCategoryRequests.set(cacheKey, request);
    return request;
  }

  invalidatePublicMatchCategories(ouid) {
    const prefix = `${ouid || ''}:`;
    for (const key of this.matchCategoryCache.keys()) {
      if (key.startsWith(prefix)) this.matchCategoryCache.delete(key);
    }
    for (const key of this.pendingMatchCategoryRequests.keys()) {
      if (key.startsWith(prefix)) this.pendingMatchCategoryRequests.delete(key);
    }
  }

  async loadPlayerActivity(player, onProgress = null) {
    const cacheKey = String(player?.ouid || '');
    const cached = this.playerActivityCache.get(cacheKey) || this.getStoredPlayerActivity(cacheKey);
    if (cached && this.isCurrentPlayerActivityCache(cached)) {
      this.playerActivityCache.set(cacheKey, cached);
      onProgress?.({ completed: 1, total: 1, percent: 100, cached: true });
      return cached.matches;
    }
    if (this.pendingPlayerActivityRequests.has(cacheKey)) {
      return this.pendingPlayerActivityRequests.get(cacheKey);
    }
    const request = this.service.getPlayerActivity(player, { onProgress })
      .then((matches) => {
        const entry = { matches, timestamp: Date.now(), dateKey: getKoreaDateKey() };
        if (this.pendingPlayerActivityRequests.get(cacheKey) === request) {
          this.playerActivityCache.set(cacheKey, entry);
          this.storePlayerActivity(cacheKey, entry);
        }
        return matches;
      })
      .finally(() => {
        if (this.pendingPlayerActivityRequests.get(cacheKey) === request) this.pendingPlayerActivityRequests.delete(cacheKey);
      });
    this.pendingPlayerActivityRequests.set(cacheKey, request);
    return request;
  }

  async loadOlderPublicMatches(player, category, beforeDate) {
    return this.service.getOlderPublicMatches(player, category, beforeDate);
  }

  invalidatePlayerActivity(ouid) {
    const cacheKey = String(ouid || '');
    this.playerActivityCache.delete(cacheKey);
    this.pendingPlayerActivityRequests.delete(cacheKey);
    for (const key of this.pendingPlayerActivityDayRequests.keys()) {
      if (key.startsWith(`${cacheKey}:`)) this.pendingPlayerActivityDayRequests.delete(key);
    }
    for (const key of this.playerActivityDayCache.keys()) {
      if (key.startsWith(`${cacheKey}:`)) this.playerActivityDayCache.delete(key);
    }
    try { globalThis.localStorage?.removeItem(`${ACTIVITY_CACHE_PREFIX}${cacheKey}`); } catch {}
    try { globalThis.sessionStorage?.removeItem(`${ACTIVITY_CACHE_PREFIX}${cacheKey}`); } catch {}
  }

  isCurrentPlayerActivityCache(entry) {
    if (!entry || !Array.isArray(entry.matches)) return false;
    const cachedDateKey = entry.dateKey || (
      Number.isFinite(Number(entry.timestamp)) ? getKoreaDateKey(Number(entry.timestamp)) : ''
    );
    return cachedDateKey === getKoreaDateKey();
  }

  getStoredPlayerActivity(cacheKey) {
    try {
      const storageKey = `${ACTIVITY_CACHE_PREFIX}${cacheKey}`;
      const raw = globalThis.localStorage?.getItem(storageKey)
        || globalThis.sessionStorage?.getItem(storageKey);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  storePlayerActivity(cacheKey, entry) {
    try {
      globalThis.localStorage?.setItem(`${ACTIVITY_CACHE_PREFIX}${cacheKey}`, JSON.stringify(entry));
    } catch (error) {
      console.warn('[SaPageUseCases] Activity daily cache save failed:', error);
    }
  }

  async loadPlayerActivityDay(player, activityMatches, dateKey) {
    const cacheKey = `${player?.ouid || ''}:${dateKey}`;
    if (this.playerActivityDayCache.has(cacheKey)) return this.playerActivityDayCache.get(cacheKey);
    if (this.pendingPlayerActivityDayRequests.has(cacheKey)) return this.pendingPlayerActivityDayRequests.get(cacheKey);
    const request = this.service.getPlayerActivityDay(player, activityMatches, dateKey)
      .then((matches) => {
        if (this.pendingPlayerActivityDayRequests.get(cacheKey) === request) this.playerActivityDayCache.set(cacheKey, matches);
        return matches;
      })
      .finally(() => {
        if (this.pendingPlayerActivityDayRequests.get(cacheKey) === request) this.pendingPlayerActivityDayRequests.delete(cacheKey);
      });
    this.pendingPlayerActivityDayRequests.set(cacheKey, request);
    return request;
  }

  async loadCrewDashboard(forceRefresh = false) {
    if (!forceRefresh && this.dashboardCache) {
      const age = Date.now() - this.dashboardCache.timestamp;
      if (age < this.dashboardCacheTtlMs) {
        return this.dashboardCache.data;
      }
    }

    const rankings = await this.crewRepo.getRankings();
    const seasonStart = this.crewSeasonUseCases
      ? await this.crewSeasonUseCases.getSeasonStartDate()
      : await this.crewRepo.getSeasonStartDate();
    const seasonHistory = this.crewSeasonUseCases
      ? await this.crewSeasonUseCases.getSeasonHistory(140)
      : [];
    const formattedDate = seasonStart.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
    const { memberNames, memberOuids } = this.buildCrewMemberIndex(rankings);
    const highlights = this.highlightsService.build(rankings, seasonHistory, seasonStart);

    this.repository.setCrewMembers(memberNames, memberOuids);
    const data = { rankings, seasonStart, seasonHistory, formattedDate, highlights };
    this.dashboardCache = { timestamp: Date.now(), data };
    return data;
  }

  invalidateCrewDashboardCache() {
    this.dashboardCache = null;
  }

  buildCrewMemberIndex(rankings) {
    const membersSet = new Set();
    const ouids = [];
    rankings.forEach((r) => {
      if (r.characterName) membersSet.add(r.characterName);
      if (r.migratedFrom) membersSet.add(r.migratedFrom);
      if (r.previousNames) r.previousNames.forEach((name) => membersSet.add(name));
      ouids.push(r.id);
    });
    return { memberNames: Array.from(membersSet), memberOuids: ouids };
  }
}
