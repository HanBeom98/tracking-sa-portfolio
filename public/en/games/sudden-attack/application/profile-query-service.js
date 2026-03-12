import { SaProfileCache } from './sa-profile-cache.js';

export class ProfileQueryService {
  constructor(profileService, profileCache = new SaProfileCache()) {
    this.profileService = profileService;
    this.profileCache = profileCache;
  }

  async getFullPlayerProfile(characterName, currentRankings = [], onUpdate = null) {
    const cacheKey = this.profileCache.buildKey(characterName);
    const cached = this.profileCache.get(cacheKey);

    if (cached) {
      console.log(`[ProfileQueryService] Cache hit for ${characterName}. Returning stale data.`);

      this.profileService.fetchFreshData(characterName, currentRankings).then((freshData) => {
        if (onUpdate && JSON.stringify(freshData) !== JSON.stringify(cached.data)) {
          console.log(`[ProfileQueryService] Background update ready for ${characterName}.`);
          this.profileCache.set(cacheKey, freshData);
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
