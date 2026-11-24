export function createFirestoreCommentRepository({ db = window.db, firebaseApp = window.firebase } = {}) {
  if (!db) throw new Error("Firestore db is not available on window.db");

  const commentsFor = (postId) => db.collection("board_posts").doc(postId).collection("comments");

  async function list(postId) {
    const snapshot = await commentsFor(postId).orderBy("createdAt", "asc").limit(200).get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  async function add(postId, data) {
    const userId = data.authorUid;
    const commentRef = commentsFor(postId).doc();
    const rateLimitRef = db.collection("comment_rate_limits").doc(userId);
    const batch = db.batch();
    batch.set(commentRef, {
      ...data,
      createdAt: firebaseApp.firestore.FieldValue.serverTimestamp(),
    });
    batch.set(rateLimitRef, {
      lastCommentAt: firebaseApp.firestore.FieldValue.serverTimestamp(),
      commentId: commentRef.id,
    }, { merge: true });
    await batch.commit();
  }

  async function remove(postId, commentId) {
    await commentsFor(postId).doc(commentId).delete();
  }

  async function softDelete(postId, commentId) {
    await commentsFor(postId).doc(commentId).update({
      content: "",
      authorName: "Deleted",
      deleted: true,
    });
  }

  return { list, add, remove, softDelete };
}
