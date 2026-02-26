# Phase 1 Ops Checklist

## Source Of Truth
- 기능/디자인 수정은 `src/**`만 수정한다.
- `public/**` 직접 수정은 금지한다.
- 예외: 자동 생성 산출물(뉴스 워크플로 커밋)만 허용한다.

## Deploy Rules
- 일반 배포(디자인/기능): `Site Deploy (Build Only)`
- 뉴스 생성/게시: `Daily AI News Post`
- Cloudflare Pages `Automatic deployments`는 `Disabled` 유지

## Before Push
- `src` 기준으로만 수정했는지 확인
- 인증 관련 수정 시 최소 점검 범위:
  - `/account/` 게스트/로그인/로그아웃
  - `/board/write` 로그인 필요 상태
  - 헤더 로그인 버튼 동작

## After Deploy (Quick Smoke)
- 계정 페이지:
  - 로그아웃 상태에서 가운데 로그인 버튼 클릭 시 모달 열림
  - 로그인 후 로그아웃 시 `/account/` 게스트 상태 전환
- 글쓰기 페이지:
  - 비로그인 상태에서 폼 숨김 + 안내문 노출
  - 로그인 후 작성 중 로그아웃하면 제출 차단

## Incident Response
- 로그인 UI 이상:
  - `https://trackingsa.com/common.js` 최신 배포 여부 확인
  - `https://trackingsa.com/account/main.js` 최신 배포 여부 확인
- 배포 누락:
  - GitHub Actions 실행 성공 여부 확인
  - Cloudflare Deploy 기록에서 Direct Upload 확인
