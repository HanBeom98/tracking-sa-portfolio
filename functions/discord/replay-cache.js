// Short-lived, bounded Worker memory only. A miss reloads Discord's header prefix.
// No Firestore, Storage, Cache API, additional binding, or cross-instance guarantee.
export function createReplayCache({ now = Date.now, ttlMs = 120000, maxEntries = 4, maxBytes = 64 * 1024 } = {}) {
  if (![ttlMs,maxEntries,maxBytes].every(value=>Number.isSafeInteger(value)&&value>0)) throw new RangeError('Replay cache budgets must be positive integers');
  const entries = new Map();
  let bytes = 0;
  const key = session => `${session.owner}:${session.expires}:${session.url}`;
  function remove(id) { bytes -= entries.get(id)?.value.bytes || 0; entries.delete(id); }
  function prune() { for (const [id, entry] of entries) if (entry.until <= now()) remove(id); }
  return {
    get(session) {
      prune(); const id = key(session), entry = entries.get(id);
      if (!entry) return null;
      entries.delete(id); entries.set(id, entry);
      return entry.value;
    },
    set(session, value) {
      prune(); const id = key(session);
      if (entries.has(id)) remove(id);
      const until = Math.min(now() + ttlMs, session.expires * 1000);
      if (!Number.isSafeInteger(value.bytes) || value.bytes < 1 || value.bytes > maxBytes || until <= now()) return;
      while (entries.size >= maxEntries || bytes + value.bytes > maxBytes) remove(entries.keys().next().value);
      entries.set(id, { until, value }); bytes += value.bytes;
    },
  };
}
