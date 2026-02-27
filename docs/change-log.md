# Change Log (AI Collaboration)

이 문서는 Gemini CLI/Codex 같은 AI 에이전트가 빠르게 맥락을 파악하도록, 변경 의도와 영향 범위를 요약합니다.

## 2026-02-25

### fix(nav): stabilize dropdown interaction; tune animal upload box size (`e872480`)
- 문제/증상:
  - 상단 네비게이션 드롭다운이 마우스 이동 중 닫혀 하위 메뉴 클릭이 어려움.
  - 동물상 테스트 업로드 점선 박스가 과하게 크게 보임.
- 변경:
  - `src/shared/assets/common.js`
    - 드롭다운 닫힘 지연 시간 `140ms -> 320ms` 조정.
    - `.dropdown-content` 영역 진입/이탈 이벤트를 추가해 이동 중 닫힘 완화.
  - `src/domains/animal-face/main.js`
    - 업로드 박스 폭/패딩/간격 축소 (`width: min(100%, 520px)`, `padding: 22px 16px`, `gap: 10px`).
- 영향 범위:
  - 네비게이션 공통 동작(전체 페이지).
  - 동물상 테스트 업로드 UI 크기(동물상 페이지).
- 검증:
  - 빌드 성공 확인 (`npm run build`).
  - 드롭다운 메뉴 hover/click 이동 테스트 및 동물상 업로드 박스 크기 확인.

### fix(animal-face): use official tmimage runtime loading (`3be01e7`)
- 문제/증상:
  - 동물상 테스트 실행 시 `Uncaught ReferenceError: exports is not defined`, `tmImage not available`.
- 변경:
  - `src/domains/animal-face/index.html`
    - Teachable Machine 런타임을 정적 스크립트로 로드:
      - `@tensorflow/tfjs@latest`
      - `@teachablemachine/image@latest`
  - `src/domains/animal-face/main.js`
    - 동적 로더(`loadScriptOnce`, `ensureTmImageReady`) 제거.
    - `window.tmImage` 준비 대기 후 `tmImage.load(model.json, metadata.json)` 호출.
- 영향 범위:
  - 동물상 테스트 모델 로딩 경로만 변경.
  - 공통 스타일/다른 페이지 로직 영향 없음.
- 검증:
  - 빌드 성공 확인.
  - 동물상 테스트에서 이미지 업로드 후 결과 추론 정상 동작 확인.

### build/seo/search/nav 관련 직전 히스토리 요약
- `a1d21c1`: SEO/수익화/소셜 메타 복구(공통 head 주입 포함).
- `1a95d46`: 표준 빌드 스크립트 정리(`npm run build`, `build:full`).
- `004c479`: 검색 입력 Enter 시 결과 페이지 라우팅(포털형 검색 UX 기초).
- `568afa3`, `b5e0cb5`, `7af4a0d`: 네비게이션 드롭다운 안정화 1~3차 수정.

## 2026-02-27

### refactor(ddd): complete domain-driven migration for all active modules
- 문제/증상:
  - `lucky-recommendation`, `search`, `games` 등의 도메인에 데이터 접근 로직과 UI 처리가 혼재되어 유지보수 및 테스트가 어려움.
- 변경:
  - 전 도메인 4계층 DDD 구조 적용:
    - `infra/`: Firestore 접근 및 외부 API 연동 캡슐화.
    - `application/`: 비즈니스 로직 및 유스케이스 분리.
    - `ui/`: 순수 렌더링 및 이벤트 핸들링 전담.
  - 신규 생성 파일:
    - `src/domains/lucky-recommendation/infra/luckyRepository.js`
    - `src/domains/search/infra/searchRepository.js`
  - 기존 파일 리팩토링: `games`, `news`, `board` 등의 레이어 간 결합도 제거.
- 영향 범위: 프로젝트 내 모든 활성 도메인 모듈 및 빌드 파이프라인.
- 검증:
  - 단위 테스트 86개 전원 통과 확인 (`npm run test:unit`).
  - 로컬 빌드 및 도메인별 자산 로딩 무결성 확인.

### feat(news/rss): implement automated RSS feed generation
- 문제/증상:
  - 뉴스 도메인에 RSS 피드가 없어 검색 엔진 인덱싱 및 자동화된 콘텐츠 배포에 제약이 있음.
- 변경:
  - `src/domains/news/application/rss_builder.py`: 뉴스 데이터를 RSS 2.0 XML로 변환하는 도메인 로직 구현.
  - `src/shared/infra/builder.py`: 사이트 빌드 시 `/rss.xml` 및 `/en/rss.xml`을 자동 생성하도록 인프라 연동.
  - `index.html`: RSS 자동 인식 링크 태그 추가.
- 영향 범위: 뉴스 도메인 콘텐츠 소비 채널 확장 및 SEO 성능 향상.
- 검증:
  - `npm run build`를 통한 XML 파일 생성 및 규격 확인.

### fix(auth): ensure page refresh on same-URL redirects after login
- 문제/증상:
  - '내 정보' 등 인증 필수 페이지에서 로그인 성공 시, 리다이렉트 대상이 현재 페이지와 같으면 화면이 갱신되지 않는 이슈 발생.
- 변경:
  - `src/shared/assets/auth-session-runtime.js`:
    - 리다이렉트 가드 로직 개선: 대상 URL이 현재와 동일할 경우 `location.reload()`를 강제 수행하도록 수정.
- 영향 범위: 인증 세션 관리 및 전역 로그인 성공 시나리오 UX.
- 검증:
  - 단위 테스트 통과 확인 및 시나리오 검토.

### feat(board): implement category system (Notice/Free Board) with role-based permissions
- 문제/증상:
  - 게시판이 단일 카테고리로 운영되어 운영자 공지와 일반 유저 글이 섞임.
  - 카테고리별 정렬 및 접근 권한 제어 기능 부재.
- 변경:
  - **Infrastructure**:
    - `src/domains/board/infra/firestorePostRepository.js`: `category` 필터링 및 정렬 쿼리 구현.
    - `firestore.indexes.json`: 카테고리별 복합 인덱스 정의 및 자동 배포 설정 추가.
  - **Application**:
    - `src/domains/board/application/postService.js`: 공지사항은 관리자만, 자유게시판은 누구나 쓸 수 있도록 비즈니스 규칙 강화.
  - **UI**:
    - `src/domains/board/ui/board-list.js`: 공지사항 글에 전용 배지(`[공지사항]`) 표시.
    - `src/domains/board/ui/board-write-form.js`: 관리자 여부에 따라 카테고리 선택 UI 노출 제어.
- 영향 범위: 게시판 전체(목록, 작성, 상세) 및 Firestore 보안/인덱스 설정.
- 검증:
  - 단위 테스트 87개 100% 통과 확인.
  - 관리자/일반유저별 글쓰기 권한 및 배지 노출 정상 작동 확인.

### fix(news): ensure correct sorting and robust pagination
- 문제/증상:
  - 뉴스 목록의 정렬이 간헐적으로 뒤죽박죽으로 나타남.
  - 한 페이지에 12개만 보여야 하는 페이징 로직이 동적 로딩 시점에서 씹히는 문제 발생.
- 변경:
  - `src/domains/news/infra/news_builder.py`: 정렬 기준을 Firestore `createdAt` 타임스탬프로 고정하여 물리적 정렬 보장.
  - `src/domains/news/application/news-client.js`: 뉴스 데이터가 화면에 완전히 그려진(Hydration) 직후에 페이징(`setupPagination`)을 실행하도록 생명주기 조율.
- 영향 범위: 뉴스 목록 페이지 UX.
- 검증:
  - 빌드 후 최신순 정렬 상태 및 12개 단위 페이징 작동 확인.

### feat(home/search): add community cards and fix search page app-shell
- 문제/증상:
  - 홈 화면에서 게시판 접근성이 낮음.
  - 검색 결과 페이지(`/search/`)에 네비게이션과 푸터가 누락되어 사이트 일관성 저하.
- 변경:
  - `index.html`: 'Community' 섹션 신규 추가 및 공지사항/자유게시판 카드 배치.
  - `src/domains/search/index.html`: 공통 앱 셸(Header, Footer) 주입 마커 추가 및 UI 개선.
  - `src/shared/infra/builder.py`: 검색 인덱스에 공지사항/자유게시판 추가.
- 영향 범위: 메인 페이지 및 검색 결과 페이지.
- 검증:
  - 홈 화면 카드 클릭 이동 및 검색 페이지 내 네비게이션 정상 노출 확인.

### ci(ops): automate firestore index deployment and optimize workflows
- 문제/증상:
  - 새로운 쿼리(카테고리 정렬) 추가 시 수동으로 Firebase Console에서 인덱스를 만들어야 하는 번거로움과 배포 누락 위험.
  - 깃액션에서 동일한 테스트가 중복 실행되어 리소스 낭비.
- 변경:
  - `.github/workflows/site-deploy.yml`: `firebase deploy` 시 인덱스 파일도 함께 배포하도록 워크플로 확장.
  - `.github/workflows/unit-tests.yml`: `main` 브랜치 직접 푸시 시 중복 실행되지 않도록 트리거 정리.
  - `.gitignore`: 인덱스 설정 파일(`firestore.indexes.json`)을 추적 대상에 포함.
- 영향 범위: CI/CD 파이프라인 및 개발 운영 효율성.
- 검증:
  - 깃허브 액션 실행 로그 확인 및 Firestore 인덱스 배포 상태 확인.

## 작업 규칙 (향후 AI용)
- 소스는 `src/*`를 먼저 수정하고, 반드시 `npm run build`로 `public/*`를 동기화한다.
- 커밋은 기능 단위로 작게 나누고, 아래 5가지를 남긴다:
  - 문제/증상
  - 변경 파일/핵심 로직
  - 영향 범위
  - 검증 방법
  - 남은 리스크/후속 과제

## 2026-02-26

### refactor(auth/account/board): 인증 흐름 공통화 + 계정/글쓰기 스크립트 구조화 (`4292128`, `58d826b`, `b47d0f2`, `b87d27c`, `93a2a58`, `c64af32`)
- 문제/증상:
  - 로그인 유도 코드가 페이지별로 중복되어 변경 시 누락/회귀 위험이 높음.
  - `account/main.js`, `board/write/main.js`가 한 파일에 로직이 뭉쳐 추적이 어려움.
  - 헤더 인증 메뉴에서 UID 노출 버튼이 남아 보안/운영 관점에서 불필요함.
- 변경:
  - `src/shared/assets/common.js`
    - `window.promptLogin` 추가(로그인 유도 진입점 단일화).
    - `window.createLoginRequiredPrompt` 추가(게스트 로그인 안내 UI 공통화).
    - 인라인 로그인 모달 로딩 경로를 auth-controls 초기화와 분리해 항상 호출 가능하게 보강.
  - `src/domains/account/main.js`
    - 렌더링/뷰모델/프로필 저장/탈퇴 액션을 함수 단위로 분리.
    - 게스트 상태 UI를 공통 `createLoginRequiredPrompt` 사용으로 전환.
  - `src/domains/board/write/main.js`
    - 접근 제어 렌더링/제출 바인딩/초기화를 분리.
    - 게스트 상태 UI를 공통 `createLoginRequiredPrompt` 사용으로 전환.
  - `src/shared/assets/auth-controls.js`
    - 헤더 메뉴의 `내 UID 확인` UI/로직 제거.
  - `scripts/smoke_auth_release.sh`
    - 공통화된 인증 진입점(`promptLogin`, `createLoginRequiredPrompt`) 기준으로 체크 업데이트.
  - 대응 `public/*` 동기화 파일 반영.
- 영향 범위:
  - 계정 페이지, 게시글 작성 페이지, 공통 로그인 모달 진입.
  - 인증 UI 회귀 점검 스크립트.
- 검증:
  - `node --check`로 `common/account/board` 문법 확인.
  - `npm run sync:public`, `npm run check:public-sync` 통과.
  - `./scripts/smoke_auth_release.sh` 통과.
- 남은 리스크/후속 과제:
  - 로컬 Playwright 환경(Chromium crash)으로 E2E 신뢰도 제한이 있어 CI 기준 검증 유지 필요.
  - 다음 단계로 account 도메인의 파일 단위 분리(application/ui helper) 진행 가능.

### refactor(ddd/ops): account·board 파일 분리 + 릴리즈 스모크 자동화 (`be7a4c6`, `949899b`, `b4e570d`, `f8892d6`)
- 문제/증상:
  - account/board 페이지에 인라인 스타일·단일 파일 로직이 남아 구조 추적이 어려움.
  - 배포 후 수동 점검 의존도가 높아 운영 회귀 탐지 속도가 느림.
- 변경:
  - account 도메인:
    - `application/account-view-model.js`, `ui/account-renderer.js`, `ui/account.css`, `main.js`로 분리.
  - board/write 도메인:
    - `application/write-auth.js`, `ui/write-access-renderer.js`, `main.js`로 분리.
  - CI:
    - `.github/workflows/release-auth-smoke.yml` 추가(배포 성공 후 자동 스모크).
  - 운영:
    - `scripts/smoke_auth_release.sh`를 분리 구조에 맞게 갱신하고 pipefail-safe 처리.
    - `scripts/public_sync_map.txt` 신규 파일 매핑 확장.
- 영향 범위:
  - 계정/게시글 작성 도메인 구조, 배포 후 인증 회귀 점검 체계.
- 검증:
  - `npm run sync:public`, `npm run check:public-sync` 통과.
  - `./scripts/smoke_auth_release.sh` 통과.
  - 관련 JS 문법 체크(`node --check`) 통과.

### refactor(auth-boundary): AuthGateway 인터페이스로 page/domain 결합 완화
- 문제/증상:
  - account/board 도메인이 `window` 인증 전역 함수에 직접 결합되어 테스트/교체 지점이 분산됨.
- 변경:
  - `src/shared/assets/common.js`
    - `window.AuthGateway` 추가:
      - `waitForReady`, `getCurrentUser`, `getCurrentUserProfile`, `requireAuth`, `getAuthService`
  - `src/domains/account/main.js`, `src/domains/board/write/application/write-auth.js`
    - 인증 조회/요구/서비스 접근을 `AuthGateway` 우선 사용으로 전환.
- 영향 범위:
  - account/board 인증 접근 경계 단일화.
- 검증:
  - `node --check` 통과.
  - `npm run sync:public`, `npm run check:public-sync` 통과.
  - `npm run test:smoke:release` 통과.

### refactor(domain/usecase): account nickname value-object + board write submit use-case 분리
- 문제/증상:
  - 닉네임 규칙(정규화/검증/쿨다운)이 account viewmodel에 섞여 도메인 규칙 재사용이 어려움.
  - board write 제출 로직이 main 오케스트레이터에 남아 use-case 경계가 약함.
- 변경:
  - `src/domains/account/domain/nickname.js` 추가:
    - `normalizeNickname`, `validateNickname`, `getNicknameCooldownInfo`
  - `src/domains/account/application/account-view-model.js`:
    - nickname 규칙을 domain 계층(`window.AccountDomain.nickname`) 우선 참조
  - `src/domains/account/index.html`:
    - `domain/nickname.js` 로드 추가
  - `src/domains/board/write/application/submit-post-use-case.js` 추가
  - `src/domains/board/write/main.js`:
    - 제출 처리 `submitPost` use-case 호출로 전환
  - `scripts/public_sync_map.txt`:
    - 신규 도메인/유스케이스 파일 매핑 추가
- 영향 범위:
  - account 닉네임 규칙 처리 경계
  - board/write 제출 경계(use-case 분리)
- 검증:
  - `node --check` 통과.
  - `npm run sync:public`, `npm run check:public-sync` 통과.
  - `npm run test:smoke:release` 통과.

### refactor(auth/board): board 전역 인증 접근 정렬 + unit test 도입
- 문제/증상:
  - board `post/edit/write`에서 인증 접근 방식이 분산되어(`window.requireAuth`, `window.authStateReady`) 경계가 일관되지 않음.
  - 핵심 도메인 규칙(account nickname, board submit use-case)에 단위 검증이 부족함.
- 변경:
  - `src/domains/board/application/authGateway.js` 추가:
    - `waitAuthReady`, `getCurrentUser`, `requireAuth`, `getAuthService`
  - board 도메인 적용:
    - `src/domains/board/write/application/write-auth.js`
    - `src/domains/board/post/main.js`
    - `src/domains/board/edit/main.js`
  - 테스트:
    - `tests/unit/account-nickname-domain.test.js`
    - `tests/unit/board-submit-post-use-case.test.js`
    - `package.json`에 `test:unit` 스크립트 추가
  - CI:
    - `.github/workflows/unit-tests.yml` 추가 (push/PR unit gate)
  - 운영 매핑 확장:
    - `scripts/public_sync_map.txt`에 board/auth 관련 신규 파일 추가
- 영향 범위:
  - board 인증 경계 일관성, 도메인 규칙 회귀 검증 기반.
- 검증:
  - `npm run test:unit` 통과.
  - `npm run sync:public`, `npm run check:public-sync` 통과.
  - `npm run test:smoke:release` 통과.

### refactor(news): extract presenter and standardize DDD module imports (2026-02-26)
- 문제/증상:
  - 뉴스 도메인의 데이터 변환 로직이 UI 핸들러와 섞여 있어 재사용 및 테스트가 어려움.
  - 모듈의 절대 경로(`/news/...`) 사용으로 인해 Node.js 기반 단위 테스트 환경에서 모듈을 찾지 못하는 문제 발생.
  - 빌드 시 뉴스 `application` 디렉토리의 일부 파일만 복사되어 의존성 누락 위험이 있음.
- 변경:
  - `src/domains/news/application/news-presenter.js` 신규 생성:
    - `mapNewsDocToCard`, `mapNewsDocToArticle`로 데이터 매핑 로직 추출.
  - 모듈 경로 표준화:
    - 뉴스 도메인 내 모든 JS 파일을 상대 경로(`../`, `./`)로 수정하여 테스트 호환성 확보.
  - 뉴스 페이지 리팩토링:
    - `news-index-page.js`, `news-article-page.js`가 프레젠터를 사용하도록 개선.
  - 빌드 시스템 보강:
    - `src/shared/infra/builder.py`에서 뉴스 `application` 디렉토리 전체를 복사하도록 수정.
    - `news_builder.py` 및 `index.html`에서 스크립트 참조 경로 최신화.
  - 테스트:
    - `tests/unit/news-presenter.test.js` 추가 및 검증 완료.
- 영향 범위:
  - 뉴스 목록/상세 페이지 렌더링, 뉴스 도메인 빌드 프로세스, 단위 테스트 환경.
- 검증:
  - `npm run test:unit` 통과 (뉴스 프레젠터 테스트 포함).
  - `python3 main.py --build-only` 빌드 성공 및 `public/` 구조 확인.
  - `public/news/application/` 내 모든 의존성 파일 존재 확인.

### refactor(board): flatten domain structure and unify layers (2026-02-26)
- 문제/증상:
  - 게시판 도메인이 기능별 하위 폴더(`write`, `edit`, `post`)로 파편화되어 레이어 로직(application, ui) 추적이 어렵고 중복 위험이 높음.
  - 소규모 프로젝트에서 과도한 폴더 분할로 인한 관리 오버헤드 발생.
- 변경:
  - 파일 이동 (하위 폴더 -> 루트 레이어):
    - `board/write/application/*`, `board/edit/application/*`, `board/post/application/*` -> `src/domains/board/application/`
    - `board/write/ui/*` -> `src/domains/board/ui/`
  - 참조 경로 최신화:
    - `main.js`, `index.html` 내 스크립트 참조 및 모듈 import 경로를 이동된 위치에 맞게 수술적으로 수정.
    - 모든 import를 상대 경로 표준으로 유지.
  - 테스트 호환성 확보:
    - `tests/unit/board-*.test.js` 파일들의 import 경로를 갱신하여 평탄화 후에도 테스트가 정상 동작하도록 보장.
  - 구조 정리:
    - 로직이 비워진 하위 `application`, `ui` 폴더들을 삭제하여 DDD 계층 구조 명확화.
- 영향 범위:
  - 게시판(목록, 작성, 수정, 상세) 전체 기능의 코드 구조 및 빌드 경로.
- 검증:
  - `npm run test:unit` 실행 (82개 테스트 전체 통과 확인).
  - `python3 main.py --build-only` 빌드 성공 확인.
  - `find src/domains/board` 명령으로 평탄화된 물리 구조 육안 확인.
