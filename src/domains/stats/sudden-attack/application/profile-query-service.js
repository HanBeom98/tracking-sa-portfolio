import { SaProfileCache } from './sa-profile-cache.js';

export class ProfileQueryService {
  constructor(profileService, profileCache = new SaProfileCache(), options = {}) {
    this.profileService = profileService;
    this.profileCache = profileCache;
    this.freshTtlMs = Number(options.freshTtlMs || 5 * 60 * 1000);
    this.memoryCache = new Map();
    this.pendingRequests = new Map();
  }

  getCachedEntry(cacheKey) {
    const memoryCached = this.memoryCache.get(cacheKey);
    if (memoryCached) return memoryCached;

    const storageCached = this.profileCache.get(cacheKey);
    if (storageCached) {
      this.memoryCache.set(cacheKey, storageCached);
    }
    return storageCached;
  }

  setCachedEntry(cacheKey, data, timestamp = Date.now()) {
    const entry = { data, timestamp };
    this.memoryCache.set(cacheKey, entry);
    this.profileCache.set(cacheKey, data, timestamp);
    return entry;
  }

  isFresh(timestamp) {
    return (Date.now() - Number(timestamp || 0)) < this.freshTtlMs;
  }

  async fetchDeduped(cacheKey, characterName, currentRankings = []) {
    if (this.pendingRequests.has(cacheKey)) {
      console.log(`[ProfileQueryService] Reusing in-flight request for ${characterName}.`);
      return this.pendingRequests.get(cacheKey);
    }

    const request = this.profileService.fetchFreshData(characterName, currentRankings)
      .finally(() => {
        this.pendingRequests.delete(cacheKey);
      });

    this.pendingRequests.set(cacheKey, request);
    return request;
  }

  async getFullPlayerProfile(characterName, currentRankings = [], onUpdate = null) {
    const cacheKey = this.profileCache.buildKey(characterName);
    const cached = this.getCachedEntry(cacheKey);

    if (cached) {
      if (this.isFresh(cached.timestamp)) {
        console.log(`[ProfileQueryService] Fresh cache hit for ${characterName}. Skipping revalidation.`);
        return { ...cached.data, isStale: false, cacheTime: cached.timestamp };
      }

      console.log(`[ProfileQueryService] Cache hit for ${characterName}. Returning stale data and revalidating.`);

      this.fetchDeduped(cacheKey, characterName, currentRankings).then((freshData) => {
        const updated = this.setCachedEntry(cacheKey, freshData);
        if (onUpdate && JSON.stringify(freshData) !== JSON.stringify(cached.data)) {
          console.log(`[ProfileQueryService] Background update ready for ${characterName}.`);
          onUpdate({ ...freshData, isStale: false, cacheTime: updated.timestamp });
        }
      }).catch((err) => console.warn('[ProfileQueryService] Background revalidation failed:', err));

      return { ...cached.data, isStale: true, cacheTime: cached.timestamp };
    }

    const freshData = await this.fetchDeduped(cacheKey, characterName, currentRankings);
    const cachedEntry = this.setCachedEntry(cacheKey, freshData);
    return { ...freshData, isStale: false, cacheTime: cachedEntry.timestamp };
  }
}
