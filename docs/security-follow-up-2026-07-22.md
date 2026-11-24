# 보안 후속 작업 기록

- 기준일: 2026-07-22
- 대상 프로젝트: `tracking-sa`
- 현재 규모: 약 DAU 100
- 현재 판단: 긴급 대응이 필요한 공개 취약점은 확인되지 않음. 아래 항목은 운영 안정화를 위한 중기 작업으로 관리한다.

## 완료된 항목

- 자유게시판 댓글·대댓글 권한 규칙 적용
- 댓글 작성 간격 제한 적용
- 게시글 삭제 시 하위 댓글을 정리하는 서버 함수 배포
- Firestore 및 Storage 보안 규칙 배포
- Firebase App Check reCAPTCHA Enterprise 앱 등록
- App Check 클라이언트와 공개 사이트 키 운영 배포
- Cloud Functions Node.js 22 전환
- 함수 빌드 이미지 자동 정리 정책 적용
- 단위 테스트, 빌드, 소스 기준 및 공개 산출물 정책 검사 통과

## 추후 처리할 항목

### 1. App Check 강제 적용

현재는 토큰 및 요청 지표를 수집하고 있으며 Firestore와 Storage 강제 적용은 아직 켜지 않는다.

진행 조건:

- App Check 요청 지표가 최소 24시간 이상 수집됨
- 정상 요청 중 유효한 App Check 요청 비율이 안정적으로 확인됨
- 로그인, 게시판 목록, 게시글 상세, 댓글 작성 및 이미지 업로드를 운영 환경에서 점검함

진행 순서:

1. Firebase Console의 `App Check > API`에서 Cloud Firestore 지표 확인
2. Cloud Firestore 강제 적용
3. 게시판 및 댓글 기능 재점검
4. Storage 지표 확인 후 Storage 강제 적용
5. 이미지 첨부 기능 재점검

롤백 기준:

- 정상 사용자의 Firestore 또는 Storage 요청이 대량 거부됨
- 로그인 후 게시판이나 이미지 첨부가 동작하지 않음

문제가 발생하면 해당 API의 App Check 강제 적용을 즉시 해제하고 원인을 확인한다.

### 2. GitHub Actions 인증을 키 없는 방식으로 전환

현재 GitHub Actions는 서비스 계정 JSON을 GitHub Secret으로 사용한다. DAU 100 수준에서 긴급 작업은 아니지만, 장기 서비스 계정 키 유출 위험을 없애기 위해 Workload Identity Federation(OIDC)으로 전환한다.

진행 조건:

- 배포 작업을 변경하고 검증할 유지보수 시간이 확보됨
- 사이트 및 Firebase Functions 배포를 연속으로 시험할 수 있음

진행 순서:

1. GitHub 저장소 전용 Workload Identity Pool 및 Provider 생성
2. `main` 브랜치와 해당 GitHub 저장소만 인증하도록 조건 제한
3. 배포 서비스 계정에 필요한 최소 역할만 부여
4. 사이트 및 Functions 워크플로를 OIDC 인증으로 변경
5. 두 배포가 성공하는지 확인
6. 기존 GitHub 서비스 계정 JSON Secret 제거
7. 기존 서비스 계정 키 폐기

### 3. CI 서비스 계정 최소 권한 재검토

현재 배포 계정에는 Firebase 및 배포 관련 권한이 비교적 넓게 부여되어 있다. OIDC 전환과 함께 다음 원칙으로 정리한다.

- 사이트 배포와 Functions 배포 계정을 가능하면 분리
- 프로젝트 전체 관리자 역할 대신 배포에 필요한 역할만 부여
- `서비스 계정 사용자` 권한은 실제 런타임 서비스 계정으로 범위를 제한
- 사용하지 않는 키와 역할은 제거
- 변경 후 Firestore 규칙, Storage 규칙, 사이트 및 Functions 배포를 각각 검증

## 재검토 시점

다음 중 하나가 발생하면 이 문서를 다시 검토한다.

- 기준일로부터 30일 경과: 2026-08-21
- DAU가 500 이상으로 증가
- Firestore 읽기가 하루 무료 할당량의 50%에 접근
- 이미지 업로드 또는 다운로드가 Storage 무료 할당량의 50%에 접근
- GitHub 관리자 또는 배포 담당자가 변경됨
- 서비스 계정, Firebase 또는 Google Cloud 관련 보안 알림 수신
- App Check 지표에 유효하지 않은 요청이 지속적으로 관찰됨

## 운영 원칙

- 비밀 키, 서비스 계정 JSON, reCAPTCHA 비밀 값은 문서와 소스에 기록하지 않는다.
- App Check 사이트 키와 Firebase Web API 키는 공개 식별자이며, 실제 데이터 보호는 Security Rules, IAM 및 App Check 강제 적용으로 수행한다.
- 예산 알림은 비용 상한이 아니므로 Firebase 및 Google Cloud 사용량을 함께 확인한다.
