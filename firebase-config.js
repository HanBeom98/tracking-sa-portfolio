// Firebase configuration
// 브라우저 호환성을 위해 import.meta.env 대신 일반 객체를 사용합니다.
const firebaseConfig = {
  // apiKey는 빌드 시점에 주입되거나, Firestore 전용 사용 시 프로젝트 ID만으로도 작동할 수 있습니다.
  authDomain: "tracking-sa-295db.firebaseapp.com",
  projectId: "tracking-sa-295db",
  storageBucket: "tracking-sa-295db.firebasestorage.app",
  appId: "1:779289056217:web:cf023fc55f1a2913ffbfc8"
};

// 중복 초기화 방지
if (typeof firebase !== 'undefined') {
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
  // Firestore 인스턴스를 전역 window 객체에 할당
  window.db = firebase.firestore();
} else {
  console.error("Firebase SDK not loaded.");
}
