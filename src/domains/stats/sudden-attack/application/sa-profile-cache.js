export const SA_PROFILE_CACHE_PREFIX = 'sa_cache_v2_';

export class SaProfileCache {
  constructor(storage, prefix = SA_PROFILE_CACHE_PREFIX) {
    try { this.storage = storage === undefined ? globalThis.localStorage : storage; }
    catch { this.storage = null; }
    this.prefix = prefix;
  }

  buildKey(characterName, context = 'league') {
    return `${this.prefix}${String(context || 'league').trim().toLowerCase()}:${String(characterName || '').trim().toLowerCase()}`;
  }

  get(key) {
    try {
      if (!this.storage?.getItem) return null;
      if (this.prefix === SA_PROFILE_CACHE_PREFIX && key.startsWith(this.prefix)) {
        try { this.storage.removeItem?.(`sa_cache_${key.slice(this.prefix.length)}`); } catch {}
      }
      const raw = this.storage.getItem(key);
      if (!raw) return null;
      const item = JSON.parse(raw);
      const views = [item.data, ...Object.values(item.data?.seasonViews || {})];
      // Older clients labeled a draw as LOSE while every participant was UNKNOWN.
      // Re-fetch only those corrupt profiles; keep normal win/loss caches usable.
      if (views.some(view => view?.matches?.some(match => match.matchResult === 'LOSE'
        && match.allPlayerStats?.length > 0
        && match.allPlayerStats.every(player => player.result === 'UNKNOWN')))) return null;
      return { data: item.data, timestamp: item.timestamp };
    } catch {
      return null;
    }
  }

  set(key, data, timestamp = Date.now()) {
    try {
      if (!this.storage?.setItem) return;
      const item = { data, timestamp };
      this.storage.setItem(key, JSON.stringify(item));
    } catch (err) {
      console.warn('[SaProfileCache] Cache save failed:', err);
    }
  }

  remove(key) {
    try {
      if (!this.storage?.removeItem) return;
      this.storage.removeItem(key);
    } catch (err) {
      console.warn('[SaProfileCache] Cache removal failed:', err);
    }
  }
}
