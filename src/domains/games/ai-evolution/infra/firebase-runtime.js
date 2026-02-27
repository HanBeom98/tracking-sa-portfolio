export function initAiEvolutionFirebase() {
  if (typeof window.firebaseConfig === "undefined") {
    window.firebaseConfig = {
      authDomain: "tracking-sa-295db.firebaseapp.com",
      projectId: "tracking-sa-295db",
      storageBucket: "tracking-sa-295db.firebasestorage.app",
    };
  }

  if (typeof window.firebase !== "undefined" && window.firebase.apps.length === 0) {
    window.firebase.initializeApp(window.firebaseConfig);
  }

  if (typeof window.firebase !== "undefined" && typeof window.db === "undefined") {
    window.db = window.firebase.firestore();
  }
}

export async function fetchRankings(db) {
  if (!db) return [];
  const snapshot = await db.collection('ai_evolution_rankings').orderBy('score', 'desc').limit(5).get();
  return snapshot.docs.map(doc => doc.data());
}

export async function saveRanking(db, data) {
  if (!db) return;
  return db.collection('ai_evolution_rankings').add({
    ...data,
    createdAt: window.firebase.firestore.FieldValue.serverTimestamp()
  });
}
