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
