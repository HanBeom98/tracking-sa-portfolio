# Release Smoke Ops Guide (2026-02-26)

## Scope
- 워크플로:
  - `Release Auth Smoke`
  - `E2E Auth Smoke` (있는 경우 동일 기준 적용)

## Alert Triage
- 1회 실패:
  - 즉시 장애로 단정하지 않는다.
  - 동일 커밋에서 재실행 1회 수행.
- 2회 연속 실패(동일 step):
  - 코드/환경 회귀 가능성으로 판단.
  - 배포 상태 + 최근 리팩토링 변경 확인.
- 3회 이상 연속 실패:
  - 운영 장애로 취급.
  - 배포 보류 또는 롤백 검토.

## Retry Rule
- 수동 재실행: 최대 2회
- 재실행 간격:
  - 1차: 즉시
  - 2차: 3~5분 후 (CDN 반영/캐시 지연 흡수)

## Common Failure Patterns
- 스모크 문자열 체크 불일치:
  - 리팩토링으로 함수명 변경 시 발생 가능
  - 예: `loadAuthControlsFactory` -> `loadAuthUiControllerFactory`
- 일시 네트워크 실패:
  - 외부 리소스 fetch/curl 타임아웃
- 배포 지연:
  - workflow_run 트리거 시점과 실제 서비스 반영 시점 차이

## Required Checks Before Incident
1. 대상 URL 수동 확인 (`/account/`, `/board/write/`)
2. `scripts/smoke_auth_release.sh` 로컬/CI 기준 문자열 확인
3. 최근 1~2개 커밋에서 auth/ui 경로 변경 여부 확인

## Incident Criteria
- 로그인 모달 미오픈
- 계정 페이지 로그인 버튼 무응답
- 글쓰기 인증 가드 미동작

위 3가지 중 1개라도 재현되면 기능 장애로 분류한다.
