// 이 파일에 자신의 Firebase 프로젝트 설정을 붙여넣으세요.
// Firebase 콘솔에서 "프로젝트 설정"으로 이동하여 찾을 수 있습니다.
// For security reasons, do not commit this file with real credentials.
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Firebase 앱 초기화
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// Firestore 인스턴스 내보내기
const db = firebase.firestore();

export { db };
