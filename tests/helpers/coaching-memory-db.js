// Transactional test double: serialize commits and discard writes on failure.
export function coachingMemoryDb() {
  const data = new Map(); let queue = Promise.resolve(), transactions = 0;
  const reads = [], optionsSeen = [];
  const compare = (a, b) => a === b ? 0 : a < b ? -1 : 1;
  function query(collection, fields = [], after = null, bound = null) {
    return { collection, fields, after, bound,
      orderBy: (field, direction = 'asc') => query(collection, [...fields, [field, direction]], after, bound),
      startAfter: (...values) => query(collection, fields, values, bound),
      limit: count => query(collection, fields, after, count) };
  }
  function snapshot(ref) {
    if (Object.hasOwn(ref, 'fields')) {
      if (!Number.isInteger(ref.bound) || ref.bound < 1) throw Error('Query must be bounded');
      reads.push({ collection: ref.collection, limit: ref.bound, after: ref.after });
      const prefix = `${ref.collection}/`;
      const values = row => ref.fields.map(([field]) => field === '__name__' ? row.id : row.value[field]);
      const sort = (a, b) => { for (let i = 0; i < ref.fields.length; i++) {
        const c = compare(a[i], b[i]) * (ref.fields[i][1] === 'desc' ? -1 : 1); if (c) return c;
      } return 0; };
      const docs = [...data.entries()].filter(([key]) => key.startsWith(prefix) && !key.slice(prefix.length).includes('/'))
        .map(([key, value]) => ({ id: key.slice(prefix.length), value }))
        .filter(row => values(row).every(v => v !== undefined)).sort((a, b) => sort(values(a), values(b)))
        .filter(row => ref.after === null || sort(values(row), ref.after) > 0).slice(0, ref.bound)
        .map(row => ({ id: row.id, exists: true, data: () => structuredClone(row.value) }));
      return { docs };
    }
    return { exists: data.has(ref.path), data: () => structuredClone(data.get(ref.path)) };
  }
  return {
    data, reads, optionsSeen, get transactions() { return transactions; },
    collection: collection => ({ ...query(collection), doc: id => {
      if (typeof id !== 'string' || !id || id.includes('/')) throw new Error('Invalid document ID');
      return { path: `${collection}/${id}` };
    } }),
    runTransaction(fn, options) {
      const operation = queue.then(async () => {
        transactions++; optionsSeen.push(options); const pending = new Map();
        const result = await fn({ get: async ref => snapshot(ref),
          set: (ref, value) => { if (options?.readOnly) throw Error('Read-only transaction'); pending.set(ref.path, structuredClone(value)); } });
        for (const [key, value] of pending) data.set(key, value);
        return result;
      });
      queue = operation.catch(() => {}); return operation;
    },
  };
}
