// An optimistic, version-checked store: competing attempts read before committing,
// and only the successful attempt's return value escapes runTransaction.
export function createTransactionalFirestore(seed = {}) {
  const documents = new Map(Object.entries(seed).map(([path, value]) => [path, structuredClone(value)]));
  const versions = new Map([...documents.keys()].map((path) => [path, 1]));
  const copy = (value) => value === undefined ? undefined : structuredClone(value);
  const snapshot = (path) => ({ id: path.split('/').at(-1), exists: documents.has(path), data: () => copy(documents.get(path)) });
  const store = {
    retries: 0, commits: 0, failNextCommit: false, beforeCommit: null,
    read: (path) => copy(documents.get(path)),
    write(path, data) { documents.set(path, copy(data)); versions.set(path, (versions.get(path) || 0) + 1); },
    remove(path) { documents.delete(path); versions.set(path, (versions.get(path) || 0) + 1); },
    paths: () => [...documents.keys()],
    collection(name) {
      return {
        doc: (id) => ({ path: `${name}/${id}`, get: async () => snapshot(`${name}/${id}`) }),
        async get() {
          const docs = [...documents.keys()].filter((path) => path.startsWith(`${name}/`)).map(snapshot);
          return { docs, forEach: (fn) => docs.forEach(fn) };
        },
      };
    },
    async runTransaction(update) {
      for (let attempt = 0; attempt < 10; attempt++) {
        const reads = new Map(), writes = [];
        const transaction = {
          async get(ref) {
            if (writes.length) throw new Error('read after write');
            reads.set(ref.path, versions.get(ref.path) || 0);
            const result = snapshot(ref.path);
            const data = result.data();
            return { ...result, data: () => copy(data) };
          },
          set: (ref, data, options) => writes.push({ type: 'set', path: ref.path, data: copy(data), options }),
          update: (ref, data) => writes.push({ type: 'update', path: ref.path, data: copy(data) }),
          delete: (ref) => writes.push({ type: 'delete', path: ref.path }),
        };
        const result = await update(transaction);
        await store.beforeCommit?.({ attempt, writes });
        await Promise.resolve();
        if ([...reads].some(([path, version]) => (versions.get(path) || 0) !== version)) { store.retries++; continue; }
        if (store.failNextCommit) { store.failNextCommit = false; throw new Error('commit rejected'); }
        if (writes.some((write) => write.type === 'update' && !documents.has(write.path))) throw new Error('missing document');
        for (const write of writes) {
          if (write.type === 'delete') store.remove(write.path);
          else store.write(write.path,
            write.type === 'update' || write.options?.merge ? { ...store.read(write.path), ...write.data } : write.data);
        }
        if (writes.length) store.commits++;
        return result;
      }
      throw new Error('transaction retry limit');
    },
  };
  return store;
}
