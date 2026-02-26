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

### [News 도메인] (2026-02-26 최신 표준)
- `src/domains/news/domain/newsArticle.js`: 순수 도메인 로직 (마크다운, 필드 분석)
- `src/domains/news/application/news-presenter.js`: 데이터 매핑 및 변환 (Presenter 패턴)
- `src/domains/news/application/news-*-page.js`: 페이지별 유스케이스 및 오케스트레이션
- `src/domains/news/infra/newsRepository.js`: Firestore 접근 로직
- `src/domains/news/ui/newsRenderer.js`: DOM 렌더링 전용
- **특이사항**: 모든 모듈 import는 상대 경로(`./`, `../`)를 사용하여 단위 테스트 호환성 확보.

### [Games 도메인] (2026-02-26 기준)
- `src/domains/games/ai-evolution/application/ai-evolution-game.js`: 게임 로직 및 상태 관리
- `src/domains/games/ai-evolution/infra/firebase-runtime.js`: Firebase 점수 기록 등 연동
- `src/domains/games/tetris/application/tetris-game.js`: 테트리스 핵심 로직
- `src/domains/games/tetris/infra/firebase-runtime.js`: Firebase 연동

### [Account 도메인] (2026-02-26 기준)
- `src/domains/account/domain/nickname.js`: 닉네임 정규화/검증/쿨다운 값 객체 로직
- `src/domains/account/application/account-view-model.js`: 표시/검증/뷰모델 계산 로직
- `src/domains/account/ui/account-renderer.js`: 게스트/계정 화면 렌더링 및 상태 메시지 유틸
- `src/domains/account/main.js`: 인증 상태 구독 + 액션 바인딩 오케스트레이션

### [Board 도메인] (2026-02-26 평탄화 완료)
- `src/domains/board/application/`: 모든 유스케이스 통합 (`submit-post`, `edit-post`, `post-detail`, `postService`, `authGateway`)
- `src/domains/board/ui/`: 모든 UI 컴포넌트 통합 (`board-list`, `write-form`, `edit-form`, `post-view`, `access-renderer`)
- `src/domains/board/infra/`: 공통 인프라 (`firestorePostRepository`, `cryptoAdapter`)
- `src/domains/board/domain/`: 순수 비즈니스 규칙 (`validators`, `nickname`)
- **특이사항**: 하위 폴더(`write`, `edit`, `post`) 구조를 제거하고 루트 레이어로 로직을 집결하여 관리 효율성 극대화.

### [Futures-estimate 도메인] (2026-02-26 기준)
- `src/domains/futures-estimate/main.js`: 위젯/분석/히스토리 로딩 오케스트레이션
- `src/domains/futures-estimate/infra/futures-api-client.js`: API 호출 경계(`/api/tv-scan`, `/api/futures-predictions`)
- `src/domains/futures-estimate/infra/futures-retry-policy.js`: API 재시도/타임아웃 정책 분리
- `src/domains/futures-estimate/application/prediction-labels.js`: 임계값/라벨 표시 규칙
- `src/domains/futures-estimate/application/impact-summary.js`: 수치/요약 문구 포맷터
- `src/domains/futures-estimate/application/impact-table-presenter.js`: 영향표 지표명/시그널 locale 표시 매퍼
- `src/domains/futures-estimate/application/error-messages.js`: 에러코드별 사용자 메시지 키 매핑
- `src/domains/futures-estimate/ui/futures-page.js`: 위젯 초기화/DOM 렌더링
- `src/domains/futures-estimate/ui/style.css`: 페이지 스타일 분리

### [Legacy/Small 도메인] (2026-02-26 기준)
- **Fortune**: `application/` (copy, markdown)과 `ui/`로 나뉘어 있으나, `main.js`에서 직접 API 호출. `infra/` 계층 부재.
- **Animal-face**: `application/` 로직은 분리되어 있으나, `Teachable Machine` 연동 로직이 `main.js`에 포함됨.
- **Search**: `application/search-data.js`로 데이터 파싱 분리. 나머지는 루트에 집중.
- **Inquiry/Contact/Privacy-policy**: 레이어 분리 없이 단일 `index.html`, `style.css` 구조 유지 중.

### [공통 인증 경계] (2026-02-26 기준)
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
- `src/shared/assets/auth-prompt-kit.js`에 로그인 프롬프트/게이트 링크 생성 책임 분리(`createAuthPromptKit`)
- `src/shared/assets/auth-action-handlers.js`에 인증 액션(provider/email/signup/logout) 책임 분리(`createAuthActionHandlers`)
  - `auth-controls`, `inline-login-modal`에서 공통으로 사용
- `src/shared/assets/app-shell-runtime.js`에 앱 셸 책임(i18n/테마/언어 스위처/드롭다운) 분리(`createAppShellRuntime`)
- `src/shared/assets/auth-session-runtime.js`에 인증 세션 책임(Auth ready/init/redirect/requireAuth) 분리(`createAuthSessionRuntime`)
- 헤더 인증 UI 오케스트레이션은 `src/shared/assets/auth-ui-controller.js`로 분리
  - `common.js`는 인증 상태/게이트웨이/프롬프트 엔트리만 유지
- 인증/게시판 알림 메시지는 `src/shared/assets/translations.js` 키를 우선 사용
  - 신규 메시지 추가 시 도메인 코드 하드코딩 대신 번역 키 확장 권장

## 3) Build and Injection Flow
1. 엔트리포인트: `main.py`
2. 사이트 빌드: `src/shared/infra/builder.py::generate_public_site()`
3. HTML 후처리: `src/shared/infra/html_processor.py`
4. 공통 head/header/footer 주입 + 빌드 스탬프 기록

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
