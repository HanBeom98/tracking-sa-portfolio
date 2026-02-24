export function createFirestorePostRepository({ db = window.db, firebaseApp = window.firebase } = {}) {
  if (!db) {
    throw new Error("Firestore db is not available on window.db");
  }

  const postsCollection = db.collection("posts");

  async function add(postData) {
    const payload = {
      ...postData,
      createdAt: getServerTimestamp(firebaseApp),
    };
    await postsCollection.add(payload);
  }

  async function getById(id) {
    const doc = await postsCollection.doc(id).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  }

  async function update(id, postData) {
    await postsCollection.doc(id).update(postData);
  }

  async function remove(id) {
    await postsCollection.doc(id).delete();
  }

  async function list({ limit = 30 } = {}) {
    let query = postsCollection.orderBy("createdAt", "desc");
    if (limit) {
      query = query.limit(limit);
    }
    const snapshot = await query.get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  return {
    add,
    getById,
    update,
    remove,
    list,
  };
}

function getServerTimestamp(firebaseApp) {
  if (firebaseApp && firebaseApp.firestore && firebaseApp.firestore.FieldValue) {
    return firebaseApp.firestore.FieldValue.serverTimestamp();
  }
  return null;
}
