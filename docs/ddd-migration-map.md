# DDD Migration Map (for Gemini/Codex)

이 문서는 Tracking SA의 구조 전환 이력을 빠르게 파악하기 위한 참조 문서입니다.

## 1) Current Source of Truth
- 개발 원본: `src/*`
- 배포 산출물: `public/*` (`npm run build`로 생성)
- 원칙: 직접 `public/*` 수정 금지, 반드시 `src/*` 수정 후 빌드

## 2) Current Structure Snapshot
- `src/domains/*`: 기능/페이지 단위 도메인
- `src/shared/assets/*`: 공통 JS/CSS 정적 자산
- `src/shared/ui/*`: 공통 헤더/푸터/헤드 템플릿
- `src/shared/infra/*`: 빌드/DB/뉴스/환경 설정 인프라

참고: 폴더는 DDD 형태를 따르지만, 모든 도메인이 레이어 분리를 100% 달성한 상태는 아님.

account 도메인(2026-02-26 기준):
- `src/domains/account/domain/nickname.js`: 닉네임 정규화/검증/쿨다운 값 객체 로직
- `src/domains/account/application/account-view-model.js`: 표시/검증/뷰모델 계산 로직
- `src/domains/account/ui/account-renderer.js`: 게스트/계정 화면 렌더링 및 상태 메시지 유틸
- `src/domains/account/main.js`: 인증 상태 구독 + 액션 바인딩 오케스트레이션

board/write 도메인(2026-02-26 기준):
- `src/domains/board/write/application/write-auth.js`: 인증 상태 확인/현재 사용자 접근 유틸
- `src/domains/board/write/application/submit-post-use-case.js`: 게시글 제출 유스케이스(인증 포함)
- `src/domains/board/write/ui/write-access-renderer.js`: 비로그인 상태 렌더링 및 로그인 유도 UI
- `src/domains/board/write/main.js`: 게시글 제출 + 상태 이벤트 오케스트레이션

공통 인증 경계(2026-02-26 기준):
- `src/shared/assets/common.js`의 `window.AuthGateway`를 통해 인증 의존을 단일 인터페이스로 노출
  - `waitForReady()`
  - `getCurrentUser()`
  - `getCurrentUserProfile()`
  - `requireAuth({ redirectTo })`
  - `getAuthService()`
- `src/shared/assets/common.js`의 `window.AuthStateBus`로 인증 상태 전달 경로를 단일화
  - `subscribe(listener)` (unsubscribe 함수 반환)
  - `getSnapshot()`
  - 기존 `auth-state-changed` DOM 이벤트는 하위 호환으로 유지
- `src/shared/assets/auth-state-bus.js`에 상태 버스 생성 로직 분리(`createAuthStateBus`)
- 헤더 인증 UI 오케스트레이션은 `src/shared/assets/auth-ui-controller.js`로 분리
  - `common.js`는 인증 상태/게이트웨이/프롬프트 엔트리만 유지
- 인증/게시판 알림 메시지는 `src/shared/assets/translations.js` 키를 우선 사용
  - 신규 메시지 추가 시 도메인 코드 하드코딩 대신 번역 키 확장 권장

## 3) Build and Injection Flow
1. 엔트리포인트: `main.py`
2. 사이트 빌드: `src/shared/infra/builder.py::generate_public_site()`
3. HTML 후처리: `src/shared/infra/html_processor.py`
4. 공통 head/header/footer 주입 + 빌드 스탬프 기록

실행:
- `npm run build` -> `venv/bin/python main.py --build-only`
- `npm run build:full` -> 뉴스 생성 + 빌드

## 4) Key Migration History (important moves)
- `src/shared/infra/common.js` -> `src/shared/assets/common.js`
- `src/shared/infra/style.css` -> `src/shared/assets/style.css`
- `src/shared/infra/premium-tag.js` -> `src/shared/ui/premium-tag.js`
- `src/domains/news/index.html` -> `src/domains/news/ui/index.html`
- `src/domains/news/style.css` -> `src/domains/news/ui/style.css`
- `src/shared/assets/news-client.js` -> `src/domains/news/application/news-client.js` (domain layer split 과정)

뉴스 도메인 분리 시 추가된 핵심 파일:
- `src/domains/news/domain/newsArticle.js`
- `src/domains/news/infra/newsRepository.js`
- `src/domains/news/ui/newsRenderer.js`
- `src/domains/news/infra/news_builder.py`

## 5) What Gemini Should Check First
1. `blueprint.md`
2. `docs/change-log.md`
3. `docs/ddd-migration-map.md` (이 문서)
4. `main.py`, `src/shared/infra/builder.py`
5. 수정 대상 도메인의 `src/domains/<domain>/`

## 6) Guardrails for Future Changes
- 구조 변경 시 반드시 기록:
  - 이동 전 경로
  - 이동 후 경로
  - 이유(중복 제거/책임 분리/빌드 경로 정리 등)
  - 영향 범위(런타임/빌드/SEO/i18n)
- 커밋 메시지에 `refactor(ddd): ...` 접두어 유지 권장
