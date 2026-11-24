# Google Cloud Credential Checklist

작성일: 2026-04-02
대상 프로젝트: `tracking-sa`

## 요약

- Firebase Web API 키는 보통 비밀키가 아니다.
- 그래서 클라이언트 코드에 포함되어도 바로 사고로 보진 않는다.
- 하지만 `제한이 불필요`한 것은 아니다.
- 이번 메일에서 더 우선순위가 높은 항목은 `서비스 계정 키 JSON`이다.
- 판단 기준:
  - `긴급 장애 대응은 아니지만, 중기적으로 처리해야 할 보안 권장사항`으로 본다.

## 1. Firebase API 키

### 결론

- 숨길 필요는 대체로 없다.
- 그래도 GCP 콘솔에서 제한 상태는 확인하는 게 맞다.
- 특히 Firebase 외 다른 Google API와 섞여 있으면 분리해야 한다.

### 확인할 항목

1. `Google Cloud Console > APIs & Services > Credentials`로 이동
2. Firebase 웹앱이 사용하는 API 키 선택
3. `API restrictions` 확인
4. `Application restrictions` 확인
5. 사용량 이상 징후 확인

### 안전 / 주의 기준

- 비교적 안전
  - Firebase 웹앱 전용 키다.
  - `API restrictions`가 Firebase 관련 API 위주로 제한되어 있다.
  - 비정상적인 사용량 급증이 없다.

- 주의 필요
  - `Don't restrict key` 상태다.
  - Maps, Vision, Gemini 같은 비-Firebase API도 같은 키로 허용돼 있다.
  - 호출량이 갑자기 늘었다.

### 메모

- Firestore/Storage 보호의 핵심은 API 키가 아니라 `Security Rules`, `IAM`, `App Check`다.
- API 키 제한만으로 데이터 보호가 되지는 않는다.

## 2. 서비스 계정 키

### 결론

- 이번 메일에서 실제로 더 신경 써야 하는 대상이다.
- 장기 JSON 키는 유출 시 바로 사고로 이어질 수 있다.
- 사용 중인 키 목록, 미사용 키, 권한 범위를 점검해야 한다.

### 확인할 항목

1. `Google Cloud Console > IAM & Admin > Service Accounts` 이동
2. 사용 중인 서비스 계정 확인
3. 각 서비스 계정의 `Keys` 탭 확인
4. 최근 30일 이상 미사용 키 삭제 또는 비활성화
5. 현재 사용하는 키는 회전 계획 수립
6. 서비스 계정 역할이 과도하지 않은지 확인

### 우선순위

1. 미사용 서비스 계정 키 삭제
2. 사용 중인 키 회전
3. 최소 권한 재설정
4. 가능하면 키 없는 인증 방식으로 전환

## 3. 이 저장소에서 확인된 관련 경로

- GitHub Actions에서 서비스 계정 JSON 사용:
  - `.github/workflows/site-deploy.yml`
- Python Firestore 초기화에서 서비스 계정 JSON 사용:
  - `src/shared/infra/db.py`
- Cloudflare 함수에서 서비스 계정 JSON 사용:
  - `functions/api/futures-predictions.js`
- Firebase 웹 설정 사용:
  - `src/shared/assets/firebase-config.js`

## 4. 실무 결론

- Firebase API 키는 `긴급 이슈`는 아닐 가능성이 높다.
- 서비스 계정 키는 실제 점검과 회전이 필요할 가능성이 높다.
- 메일 대응 우선순위는 `API 키`보다 `서비스 계정 키`다.
