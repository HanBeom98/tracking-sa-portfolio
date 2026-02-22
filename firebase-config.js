// 환경 변수에서 설정을 불러옵니다. (Vite/Cloudflare 기준)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: "tracking-sa-295db.firebaseapp.com",
  projectId: "tracking-sa-295db",
  storageBucket: "tracking-sa-295db.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: "1:779289056217:web:cf023fc55f1a2913ffbfc8"
};

// 중복 초기화 방지
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// Firestore 인스턴스를 전역 window 객체에 할당
window.db = firebase.firestore();