import { SaProfileCache } from './sa-profile-cache.js';

export class ProfileQueryService {
  constructor(profileService, profileCache = new SaProfileCache(), options = {}) {
    this.profileService = profileService;
    this.profileCache = profileCache;
    this.freshTtlMs = Number(options.freshTtlMs || 5 * 60 * 1000);
  }

  async getFullPlayerProfile(characterName, currentRankings = [], onUpdate = null) {
    const cacheKey = this.profileCache.buildKey(characterName);
    const cached = this.profileCache.get(cacheKey);

    if (cached) {
      const ageMs = Date.now() - Number(cached.timestamp || 0);
      if (ageMs < this.freshTtlMs) {
        console.log(`[ProfileQueryService] Fresh cache hit for ${characterName}. Skipping revalidation.`);
        return { ...cached.data, isStale: false, cacheTime: cached.timestamp };
      }

      console.log(`[ProfileQueryService] Cache hit for ${characterName}. Returning stale data and revalidating.`);

      this.profileService.fetchFreshData(characterName, currentRankings).then((freshData) => {
        this.profileCache.set(cacheKey, freshData);
        if (onUpdate && JSON.stringify(freshData) !== JSON.stringify(cached.data)) {
          console.log(`[ProfileQueryService] Background update ready for ${characterName}.`);
          onUpdate(freshData);
        }
      }).catch((err) => console.warn('[ProfileQueryService] Background revalidation failed:', err));

      return { ...cached.data, isStale: true, cacheTime: cached.timestamp };
    }

    const freshData = await this.profileService.fetchFreshData(characterName, currentRankings);
    this.profileCache.set(cacheKey, freshData);
    return { ...freshData, isStale: false, cacheTime: Date.now() };
  }
}
