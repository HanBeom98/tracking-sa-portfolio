// 이 파일에 자신의 Firebase 프로젝트 설정을 붙여넣으세요.
// Firebase 콘솔의 "프로젝트 설정" > "내 앱"에서 찾을 수 있습니다.
// 경고: 실제 자격 증명이 포함된 이 파일을 Git에 커밋하지 마세요.
// 이 파일은 .gitignore에 의해 의도적으로 제외되어 있습니다.

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Firebase 앱 초기화 (이미 초기화되지 않은 경우에만)
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// Firestore 인스턴스
const db = firebase.firestore();