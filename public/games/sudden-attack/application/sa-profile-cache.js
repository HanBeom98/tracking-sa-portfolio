export const SA_PROFILE_CACHE_PREFIX = 'sa_cache_';

export class SaProfileCache {
  constructor(storage = globalThis?.localStorage, prefix = SA_PROFILE_CACHE_PREFIX) {
    this.storage = storage;
    this.prefix = prefix;
  }

  buildKey(characterName) {
    return `${this.prefix}${String(characterName || '').toLowerCase()}`;
  }

  get(key) {
    if (!this.storage?.getItem) return null;
    const raw = this.storage.getItem(key);
    if (!raw) return null;

    try {
      const item = JSON.parse(raw);
      return { data: item.data, timestamp: item.timestamp };
    } catch {
      return null;
    }
  }

  set(key, data) {
    if (!this.storage?.setItem) return;
    try {
      const item = { data, timestamp: Date.now() };
      this.storage.setItem(key, JSON.stringify(item));
    } catch (err) {
      console.warn('[SaProfileCache] Cache save failed:', err);
    }
  }

  remove(key) {
    if (!this.storage?.removeItem) return;
    this.storage.removeItem(key);
  }
}
