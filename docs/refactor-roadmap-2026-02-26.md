# Refactor Roadmap (2026-02-26)

## Goal
- 기능 개발 속도를 유지하면서 중복 수정, 배포 충돌, 인증 로직 분산 문제를 줄인다.
- 기준: `src` 중심 개발, 예측 가능한 배포, 도메인별 책임 분리.

## Current Pain Points
- `src`와 `public` 동시 수정이 자주 발생해 실수 가능성이 높다.
- 인증/로그인 UI 로직이 `common.js`, `account`, `board/write`에 분산되어 있다.
- 페이지별 인라인 스타일/스크립트가 커져 재사용성과 테스트가 낮다.
- 뉴스/사이트 배포 워크플로 책임이 분리됐지만 운영 규칙 문서화가 부족하다.

## Phase 1 (Now, 1-2 days)
- `src`를 단일 소스로 고정하고 수동 `public` 편집 금지 규칙 확정.
- 운영 규칙 문서화:
  - 디자인/기능 수정 배포: `Site Deploy (Build Only)`
  - 뉴스 생성 배포: `Daily AI News Post`
- 계정/게시판 인증 관련 최근 핫픽스 동작 점검 체크리스트 추가.

### Done Criteria
- 팀이 동일한 배포 루트를 사용하고, 수동 `public` 편집 없이 운영 가능.
- 로그인/로그아웃 핵심 플로우(계정/글쓰기)가 재현 테스트 통과.

### Progress Update (2026-02-26)
- 완료:
  - `promptLogin`, `createLoginRequiredPrompt` 공통 진입점 도입.
  - `AuthGateway` 인증 경계 도입(`waitForReady/getCurrentUser/getCurrentUserProfile/requireAuth/getAuthService`).
  - `account` 도메인 파일 분리:
    - `domain/nickname.js` (정규화/검증/쿨다운 값 객체)
    - `application/account-view-model.js`
    - `ui/account-renderer.js`
    - `ui/account.css`
    - `main.js` 오케스트레이션
  - `board/write` 도메인 파일 분리:
    - `application/submit-post-use-case.js`
    - `application/write-auth.js`
    - `ui/write-access-renderer.js`
    - `main.js` 오케스트레이션
  - `board/post`, `board/edit` 인증 접근을 `AuthGateway` 경계로 정렬.
  - `board/post`, `board/edit` use-case 분리:
    - `post/application/post-detail-use-cases.js`
    - `edit/application/edit-post-use-cases.js`
  - `AuthStateBus` 도입으로 인증 상태 발행 경로 단일화(`common.js`).
  - `account`, `board/write` 인증 상태 구독을 `AuthStateBus` 우선으로 전환(이벤트 fallback 유지).
  - `auth-ui-controller` 분리:
    - `src/shared/assets/auth-ui-controller.js`
    - `common.js`는 인증 UI 오케스트레이션 호출만 담당
  - 인증/게시판 주요 알림 메시지를 번역 키로 공통화:
    - `auth_required/auth_service_unavailable/auth_ui_load_failed`
    - `post_required_fields/post_create_success/post_create_failed`
    - `post_edit_success/post_edit_failed/post_not_authorized`
    - `board_write_login_required`
  - `auth-state-bus`를 독립 자산으로 분리:
    - `src/shared/assets/auth-state-bus.js`
    - `common.js`는 버스 로딩/연결만 담당
  - `auth-prompt-kit` 분리:
    - `src/shared/assets/auth-prompt-kit.js`
    - `common.js`의 로그인 프롬프트/게이트링크 생성 책임을 모듈로 이동
  - 인증 액션 핸들러 분리:
    - `src/shared/assets/auth-action-handlers.js`
    - `auth-controls`, `inline-login-modal`의 provider/email/signup/logout 중복 로직 통합
  - unit test 추가:
    - `tests/unit/auth-state-bus.test.js`
    - `tests/unit/auth-action-handlers.test.js`
    - `tests/unit/board-auth-gateway.test.js`
    - `tests/unit/board-write-auth.test.js`
    - `tests/unit/futures-prediction-labels.test.js`
    - `tests/unit/futures-impact-summary.test.js`
    - `tests/unit/app-shell-runtime.test.js`
    - `tests/unit/auth-session-runtime.test.js`
    - `tests/unit/auth-prompt-kit.test.js`
  - `app-shell-runtime` 분리:
    - `src/shared/assets/app-shell-runtime.js`
    - `common.js`에서 i18n/테마/드롭다운 초기화 책임 분리
  - `auth-session-runtime` 분리:
    - `src/shared/assets/auth-session-runtime.js`
    - `common.js`에서 auth state ready/init/redirect/gateway 책임 분리
  - futures 도메인 1차 분리:
    - `src/domains/futures-estimate/main.js` (오케스트레이션)
    - `src/domains/futures-estimate/infra/futures-api-client.js`
    - `src/domains/futures-estimate/application/prediction-labels.js`
    - `src/domains/futures-estimate/application/impact-summary.js`
    - `src/domains/futures-estimate/ui/futures-page.js`
    - `src/domains/futures-estimate/ui/style.css`
  - futures API 재시도 정책 분리:
    - `src/domains/futures-estimate/infra/futures-retry-policy.js`
    - `src/domains/futures-estimate/infra/futures-api-client.js`는 정책 기반 재시도/타임아웃 처리
  - unit test 추가:
    - `tests/unit/futures-retry-policy.test.js`
    - `tests/unit/futures-api-client.test.js`
    - `tests/unit/futures-error-messages.test.js`
  - futures 에러코드별 사용자 메시지 세분화:
    - `src/domains/futures-estimate/application/error-messages.js`
    - `main.js`에서 에러코드 -> 메시지키 매핑 후 UI 렌더로 전달
  - futures 페이지 위젯 심볼 라벨 i18n 키화:
    - `src/domains/futures-estimate/index.html`의 6개 심볼 타이틀을 `data-i18n`으로 전환
    - `src/shared/assets/translations.js`에 ko/en 심볼 라벨 키 추가
  - futures 영향표 locale 표시 정규화:
    - `src/domains/futures-estimate/application/impact-table-presenter.js` 추가
    - 지표명(`item.symbol`) -> locale 표시명 매핑
    - 시그널(`item.signal`) ko/en 혼합 입력 -> canonical 분류 -> locale 문구 매핑
  - unit test 추가:
    - `tests/unit/futures-impact-table-presenter.test.js`
    - `tests/unit/futures-api-contract.test.js`
  - futures API 계약 문서화:
    - `docs/futures-api-contract.md`
    - `tv-scan`/`futures-predictions` 응답 스키마 및 default/error 규약 명시
  - futures 에러코드 운영 문서화:
    - `docs/futures-error-code-mapping.md`
    - transport 에러코드(`timeout/network/http/empty`)와 UI 번역키 매핑 규칙 정리
  - 헤더 인증 메뉴 UID 노출 제거.
  - `smoke_auth_release.sh`를 분리 구조 기준으로 안정화(pipefail-safe).
  - 배포 후 `smoke_auth_release.sh` 자동 실행 워크플로우 연결.
  - unit test 추가:
    - `tests/unit/account-nickname-domain.test.js`
    - `tests/unit/board-submit-post-use-case.test.js`
    - `tests/unit/board-post-detail-use-cases.test.js`
    - `tests/unit/board-edit-post-use-cases.test.js`
  - CI `Unit Tests` 워크플로우로 unit test 필수 게이트 연결.
- 진행중:
  - 로그인 UI 문구/알림의 도메인별 상세 키 세분화(계정/게시판 1차 완료, 나머지 페이지 확장 필요).
  - account 도메인 저장/탈퇴 에러코드별 번역키 분리(1차 완료, auth provider별 세분화 추가 여지).
  - animal-face 도메인 1차 분리 시작(결과 계산/공유 URL 로직 application 모듈화).
  - animal-face 메시지 모듈 분리:
    - `src/domains/animal-face/application/messages.js`
    - 모델 로딩/분석 실패 알림, 점수 라벨 텍스트를 `main.js`에서 분리
    - 번역 키 추가: `animal_face_model_loading`, `animal_face_analysis_error`
  - animal-face UI/문구 2차 분리:
    - `src/domains/animal-face/application/view-text.js` (뷰 텍스트 조합)
    - `src/domains/animal-face/ui/animal-face-view.js` (템플릿/이벤트 바인딩/상태 렌더)
    - `main.js`는 모델 예측/도메인 오케스트레이션 책임으로 축소
  - unit test 추가:
    - `tests/unit/animal-face-messages.test.js`
    - `tests/unit/animal-face-view-text.test.js`

## Phase 2 (Short-term, 3-5 days)
- 인증 UI/상태 로직을 모듈화:
  - `auth-ui-controller`(모달/드롭다운/상태 전환)
  - `auth-state-bus`(페이지별 구독만 수행)
- `account/main.js`와 `board/write/main.js`에서 공통 인증 코드 제거.
- 번역 키/메시지 처리 공통화.

### Done Criteria
- 인증 관련 코드 중복 30% 이상 감소.
- 로그아웃/세션만료 시 모든 페이지에서 일관된 처리.

## Phase 3 (Mid-term, 1 week+)
- 인라인 스타일 축소:
  - `account`/`board` 페이지 스타일을 도메인 CSS로 분리.
- 빌드 파이프라인 정리:
  - 생성 산출물(`public`) 커밋 범위 최소화(뉴스 생성 파이프라인 중심).
- 도메인별 회귀 테스트 시나리오 문서화(수동 + 스모크).

### Done Criteria
- 페이지 템플릿의 인라인 CSS/JS 최소화.
- 배포 이슈 재현/진단 시간이 크게 감소.

## Execution Order (Recommended)
1. Phase 1 운영 규칙 문서/체크리스트 확정
2. Phase 2 인증 모듈화
3. Phase 3 스타일/빌드 정리

## Risks
- 빠른 핫픽스가 필요한 상황에서 다시 `public` 직접 수정으로 회귀할 수 있음.
- 뉴스 생성 파이프라인과 사이트 배포 파이프라인 책임 경계가 흐려질 수 있음.

## Guardrails
- 모든 기능 수정은 `src`만 수정하고 워크플로로 배포한다.
- 인증 관련 변경은 `account + board/write + common` 3개 플로우를 반드시 함께 테스트한다.
