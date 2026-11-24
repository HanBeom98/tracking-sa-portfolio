import { SaProfileCache } from './sa-profile-cache.js?v=f6218a4a87c9';

export class ProfileQueryService {
  constructor(profileService, profileCache = new SaProfileCache(), options = {}) {
    this.profileService = profileService;
    this.profileCache = profileCache;
    this.freshTtlMs = Number(options.freshTtlMs || 5 * 60 * 1000);
    this.memoryCache = new Map();
    this.pendingRequests = new Map();
    this.cacheVersions = new Map();
  }

  invalidatePlayerProfile(characterName, options = {}) {
    const cacheKey = this.profileCache.buildKey(characterName, options.scope);
    this.cacheVersions.set(cacheKey, (this.cacheVersions.get(cacheKey) || 0) + 1);
    // Keep a tombstone so a failed storage removal cannot revive the old entry.
    this.memoryCache.set(cacheKey, null);
    this.pendingRequests.delete(cacheKey);
    this.profileCache.remove(cacheKey);
  }

  getCachedEntry(cacheKey) {
    if (this.memoryCache.has(cacheKey)) return this.memoryCache.get(cacheKey);

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

  async fetchDeduped(cacheKey, characterName, currentRankings = [], options = {}) {
    if (this.pendingRequests.has(cacheKey)) {
      console.log(`[ProfileQueryService] Reusing in-flight request for ${characterName}.`);
      return this.pendingRequests.get(cacheKey);
    }

    const request = this.profileService.fetchFreshData(characterName, currentRankings, options)
      .finally(() => {
        if (this.pendingRequests.get(cacheKey) === request) {
          this.pendingRequests.delete(cacheKey);
        }
      });

    this.pendingRequests.set(cacheKey, request);
    return request;
  }

  async getFullPlayerProfile(characterName, currentRankings = [], onUpdate = null, options = {}) {
    if (options.forceRefresh) {
      this.invalidatePlayerProfile(characterName, options);
    }
    const { forceRefresh, onQueryState, ...fetchOptions } = options;
    const notify = (source, revalidating = false) => {
      try { onQueryState?.({ source, revalidating }); } catch { /* Observers cannot change a query. */ }
    };
    const cacheKey = this.profileCache.buildKey(characterName, options.scope);
    const version = this.cacheVersions.get(cacheKey) || 0;
    const isCurrent = () => (this.cacheVersions.get(cacheKey) || 0) === version;
    const cached = this.getCachedEntry(cacheKey);

    if (cached) {
      if (this.isFresh(cached.timestamp)) {
        notify('fresh_cache');
        console.log(`[ProfileQueryService] Fresh cache hit for ${characterName}. Skipping revalidation.`);
        return { ...cached.data, isStale: false, cacheTime: cached.timestamp, querySource: 'fresh_cache' };
      }

      console.log(`[ProfileQueryService] Cache hit for ${characterName}. Returning stale data and revalidating.`);
      notify('stale_cache', true);

      this.fetchDeduped(cacheKey, characterName, currentRankings, fetchOptions).then((freshData) => {
        if (!isCurrent()) return;
        const updated = this.setCachedEntry(cacheKey, freshData);
        if (onUpdate) {
          const changed = JSON.stringify(freshData) !== JSON.stringify(cached.data);
          console.log(`[ProfileQueryService] Background revalidation completed for ${characterName}.`);
          onUpdate({ ...freshData, isStale: false, cacheTime: updated.timestamp, querySource: 'network' }, { changed });
        }
      }).catch((err) => {
        if (!isCurrent()) return;
        console.warn('[ProfileQueryService] Background revalidation failed:', err);
        if (onUpdate) onUpdate(null, { error: err });
      });

      return { ...cached.data, isStale: true, cacheTime: cached.timestamp, querySource: 'stale_cache' };
    }

    let freshData;
    notify('network');
    try {
      freshData = await this.fetchDeduped(cacheKey, characterName, currentRankings, fetchOptions);
    } catch (error) {
      if (isCurrent()) throw error;
    }
    // A refresh supersedes earlier requests, including their failures and cache writes.
    if (!isCurrent()) {
      return this.getFullPlayerProfile(characterName, currentRankings, onUpdate, { ...fetchOptions, onQueryState });
    }
    const cachedEntry = this.setCachedEntry(cacheKey, freshData);
    return { ...freshData, isStale: false, cacheTime: cachedEntry.timestamp, querySource: 'network' };
  }
}
