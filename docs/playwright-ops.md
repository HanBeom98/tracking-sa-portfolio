# Playwright Ops Guide

## 기준
- 배포 검증의 최종 기준은 GitHub Actions의 `E2E Auth Smoke` 결과다.
- 로컬 Playwright는 개발 참고용이며, 환경 크래시가 있으면 CI 결과를 우선한다.

## 기본 실행
- 인증 E2E: `npm run test:e2e:auth`
- 배포 런타임 스모크: `npm run test:smoke:release`

## 로컬 Chromium 이슈 대응
- 증상: `Target crashed`, `page.goto: Page crashed`, `Target page ... has been closed`
- 우선 조치:
  1. 시스템 Chromium 경로 지정  
     `PLAYWRIGHT_CHROMIUM_PATH=/path/to/chromium npm run test:e2e:auth`
  2. 그래도 실패하면 로컬 결과는 참고만 하고 CI 실행 결과 확인

## CI 흐름
- `Release Auth Smoke`:
  - `Site Deploy (Build Only)` / `Daily AI News Post` 성공 후 자동 실행
  - `scripts/smoke_auth_release.sh` 실행
- `E2E Auth Smoke`:
  - 동일 배포 워크플로우 성공 후 자동 실행
  - 실패 시 artifact(trace/report) 확인
