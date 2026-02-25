export const fetchNewsList = async (db, limit = 100) => {
  const snapshot = await db.collection('posts').orderBy('createdAt', 'desc').limit(limit).get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const fetchNewsDoc = async (db, urlKey) => {
  if (!urlKey) return null;
  const doc = await db.collection('posts').doc(urlKey).get();
  return doc.exists ? doc.data() : null;
};
