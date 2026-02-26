// Firebase configuration
// 브라우저 호환성을 위해 import.meta.env 대신 일반 객체를 사용합니다.
const runtimeConfig = (typeof window !== "undefined" && window.FIREBASE_CONFIG) ? window.FIREBASE_CONFIG : {};
const firebaseConfig = {
  // apiKey는 런타임 주입 가능: window.FIREBASE_CONFIG.apiKey
  apiKey: runtimeConfig.apiKey || "",
  authDomain: runtimeConfig.authDomain || "tracking-sa-295db.firebaseapp.com",
  projectId: runtimeConfig.projectId || "tracking-sa-295db",
  storageBucket: runtimeConfig.storageBucket || "tracking-sa-295db.firebasestorage.app",
  appId: runtimeConfig.appId || "1:779289056217:web:cf023fc55f1a2913ffbfc8"
};

// 중복 초기화 방지
if (typeof firebase !== 'undefined') {
  if (!firebaseConfig.apiKey) {
    console.error("Firebase apiKey is missing. Search will be disabled.");
    window.db = null;
  } else {
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    // Firestore 인스턴스를 전역 window 객체에 할당
    window.db = firebase.firestore();
    if (firebase.auth) {
      window.auth = firebase.auth();
    }
  }
} else {
  console.error("Firebase SDK not loaded.");
  window.db = null;
}
