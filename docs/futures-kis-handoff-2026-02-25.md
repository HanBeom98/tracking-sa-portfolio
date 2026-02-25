# Futures Estimate Sync Handoff (2026-02-25)

## Goal
- `선물 야간 추정지수` 데이터를 5분 주기로 자동 수집해 Firestore에 저장.
- 비용/계약 리스크를 피하기 위해 "공개 시세 기반 추정치"만 제공.

## What was done

### 1) 5분 버킷 저장 적용
- `scripts/sync_futures_estimate.py`
  - `point_id = str(ts // 300)` 로 변경 (5-minute bucket).

### 2) GitHub Actions import 오류 수정
- 오류: `ModuleNotFoundError: No module named 'src'`
- 조치:
  - 스크립트 상단에 repo root를 `sys.path`에 추가.

### 3) 빈 숫자 환경변수 처리
- 오류: `ValueError: could not convert string to float: ''`
- 조치:
  - `_env_float()` 헬퍼 추가.
  - `KOSPI200_BASE`, `FUTURES_REQUEST_TIMEOUT_SEC` 빈 값 시 기본값 사용.

### 4) Workflow 실행 커밋 혼동 방지
- `.github/workflows/futures-estimate-sync-v2.yml`
  - `actions/checkout@v4`에 `ref: main` 고정.
  - debug step 추가(`HEAD SHA`, 스크립트 상단 출력).

### 5) KIS 전환 시도 후, 최종 방향 확정 (공개 시세 기반)
- KIS API는 공개 웹사이트 재배포 시 계약/비용 이슈 가능성이 있어 최종적으로 제거.
- `scripts/sync_futures_estimate.py`
  - 현재는 Stooq 공개 시세(`es.f`) 1회 조회로 `futures_price`, `futures_prev_close`를 수집.
  - 추정값 계산 후 Firestore 저장.
  - 소스 표기: `source=stooq_public_quote`
- `.github/workflows/futures-estimate-sync-v2.yml`
  - KIS 시크릿 제거.
  - 선택 시크릿: `STOOQ_SYMBOL`(기본 `es.f`)

## Commits (main)
- `1a34ee4` chore(futures): bucket point docs by 5-minute interval
- `1e382a4` fix(futures): make sync script import src in GitHub Actions
- `59d967a` fix(futures): handle empty numeric env vars in sync script
- `f2d31e4` chore(actions): pin futures sync workflow to main and print revision
- `5f93b74` feat(futures): switch sync pipeline to Korea Investment OpenAPI
- `a0d591c` feat(futures): use KIS KRX night futures websocket tick for sync (local commit was created during testing)

## Current status
- 최종 구현은 KIS 시크릿 없이 동작.
- 필수는 `FIREBASE_SERVICE_ACCOUNT_JSON`만 유지.

## Required GitHub Secrets
- Required for Firestore write
  - `FIREBASE_SERVICE_ACCOUNT_JSON`
- Optional
  - `STOOQ_SYMBOL` (default: `es.f`)
  - `KOSPI200_BASE`

## After secrets are set
1. GitHub Actions -> `Futures Estimate Sync` -> `Run workflow` (branch `main`)
2. 성공 로그 확인:
   - `✅ Futures sync complete ...`
3. Firestore 확인:
   - `futures_estimate_meta/current`에 `source: stooq_public_quote` 포함
   - `futures_estimate_points`에 숫자 문서 ID(`ts//300`) 누적

## Notes
- 첫 Firestore 데이터는 수동 입력값이었음(검증 대상 제외).
- 현재 목적은 "실시간 원시 야간선물 체결가 재배포"가 아니라 "추정 지수 계산값" 저장/표시 구조.
