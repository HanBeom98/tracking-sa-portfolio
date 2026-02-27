# Tracking SA Project Blueprint

## 🎯 Project Vision
Tracking SA를 프레임워크 의존 없이 안정적으로 운영 가능한 DDD 지향 웹 플랫폼으로 발전시킨다.

## 📚 Canonical Docs For AI Handoff
- `blueprint.md`: 현재 목표/운영방식/진행상태
- `docs/change-log.md`: 변경 의도/영향/검증 기록
- `docs/ddd-migration-map.md`: DDD 전환 및 파일 이동 이력

## 🛠️ Tech Stack & Standards
- Architecture: `src/domains` + `src/shared` 기반 DDD 지향 구조
- Frontend: Vanilla JS + Web Components (선택적 Shadow DOM)
- Build: `main.py` + `src/shared/infra/builder.py` 커스텀 빌더
- Data: Firebase Firestore
- News Gen: RSS + Gemini 기반 `multi-agent-system/news-desk.js`

## 🚦 Deployment & Operation Model (2026-02-26 기준)
- **배포 원칙 (Test-First)**: 모든 코드 변경은 GitHub Actions에서 **단위 테스트 및 Firestore 규칙 검증을 통과해야만** Cloudflare Pages로 배포됩니다.
- 일반 기능 배포: 로컬에서 `main.py --build-only` 후 `public/` 포함 커밋/푸시 -> CI 테스트 -> 자동 배포.
- 뉴스 자동 발행: GitHub Actions 스케줄 실행에서 `python main.py` 실행 후 `public/` 자동 커밋.
- Cloudflare Pages: GitHub Actions 워크플로우 성공 시 배포된 `public/` 정적 파일을 호스팅.

## ✅ Completed Milestones

### 2026-02-24
- DDD 문서화:
  - `docs/change-log.md`, `docs/ddd-migration-map.md` 추가
  - `blueprint.md`에 핸드오프 문서 참조 체계 반영
- 검색 안정화 1차:
  - Firestore prefix query 실패 시 fallback 검색 추가
  - `/search` 라우트 및 연관 에셋 반영

### 2026-02-25
- 뉴스 도메인 정리:
  - 뉴스 빌드 로직 분리: `src/domains/news/infra/news_builder.py`
  - HTML 공통 처리 분리: `src/shared/infra/html_processor.py`
  - 빌더 오케스트레이션 정리: `src/shared/infra/builder.py`
- 뉴스 UI/기능 보강:
  - EN 번역 동작 정합성 수정
  - 한/영 페이지네이션 버튼 스타일 통일
  - 뉴스 상세 상단 “목록으로” 버튼 추가 (KO/EN 분기)
- 동물상 테스트 복구:
  - Teachable Machine 런타임 로딩 안정화 (`exports is not defined` 이슈 해결)
- 네비게이션/업로드 UI:
  - 드롭다운 hover gap 제거 및 클릭 안정화
  - 동물상 업로드 점선 박스 크기 축소
- 운세/행운의 추천:
  - AI 처리 중 로딩 시각 효과 강화

### 2026-02-26
- 뉴스 도메인 DDD 완성 (By Gemini CLI):
  - `NewsPresenter` 도입으로 데이터 매핑 로직 완벽 분리 및 `tests/unit/news-presenter.test.js` 검증.
  - 모든 모듈 import 경로를 상대 경로로 전환하여 단위 테스트 환경과 브라우저 런타임 호환성 확보.
  - 빌드 스크립트(`builder.py`) 수정: 뉴스 `application/` 디렉토리 전체 배포 구조 반영.
- 보드 도메인 레이어 평탄화 및 통합 완료 (By Gemini CLI):
  - 하위 폴더(`write`, `edit`, `post`)에 파편화된 레이어 로직을 도메인 루트(`application/`, `ui/`)로 집결.
  - 전체 게시판 기능의 `import` 경로 수술적 최적화 및 단위 테스트 100% 통과 확인.
- 레거시 도메인(Fortune, Animal-face) DDD 리팩토링 완료 (By Gemini CLI):
  - `infra/` 계층 분리(API 호출, 모델 로딩) 및 유스케이스(`application/`) 추출.
  - 마크다운 파서 버그 수정 및 도메인별 단위 테스트 보강.
- 게임 도메인 DDD 분리 완료:
  - 테트리스, AI Evolution 게임 로직을 `application/`, `infra/` 레이어로 물리적 분리 완료.
- GitHub Actions 역할 고정:
  - `daily-news-post.yml`을 예약/수동 뉴스 생성 전용으로 단순화 (push 트리거 제거).
- 뉴스 에이전트 안정화:
  - Gemini 호출 재시도(backoff) 및 기획(JSON) 파싱 실패 시 fallback plan 추가.
  - `processed_articles.log` 회전 정책 및 파라미터 환경변수화.
- 뉴스 본문 해시태그 렌더링 개선:
  - `##HASHTAGS##`를 작은 chip 컴포넌트로 렌더링하도록 UI 개선.
- 검색 기능 안정화 2차:
  - Firestore unavailable 시 뉴스 인덱스 즉시 fallback.
  - DOMParser 실패 대비 HTML 정규식 파서 fallback 구현.
  - 메인 검색바 및 결과 페이지 동기화 반영.
- 모바일 게임 UX 개선:
  - 테트리스: 헤더/하단 safe-area 고려 레이아웃(`100dvh`) 및 버튼 가림 방지.
  - 2048: 단일 `index.html` 내 상단 네비게이션 내장 및 오프셋 적용.

### 2026-02-27
- **아키텍처 안정성 회복 및 1:1 미러링 DDD 확립**:
  - 무리한 `ui/` 폴더 강제화로 인한 경로 파손 장애를 해결하고, **Source와 Build 구조를 1:1로 일치**시킨 실용적 DDD 구조로 복구.
  - 빌드 시 불필요한 JS 치환 로직(`fix_js_imports`)을 제거하고 소스 코드의 무결성을 배포 환경까지 직접 전달하도록 빌더(`builder.py`) 단순화.
- **게시판 UI 정전환 (Card to List)**:
  - 기존 카드 그리드 형식에서 **번호/제목/작성자/날짜가 포함된 정통 리스트 형식**으로 UI 대폭 개선.
  - 오늘 작성 글은 시간 표시, 이전 글은 날짜 표시 등 가독성 최적화 로직 적용.
  - 공지사항 상단 고정 및 강조 디자인 적용.
- **테스트 및 배포 무결성 검증**:
  - 장애 복구 후 GitHub Actions를 통해 실제 배포 사이트 대상 E2E Smoke 테스트 및 단위 테스트 88개 전원 통과 확인.

## 🧭 Architecture Reality Check
- `news`, `board`, `games`, `account`, `futures-estimate`, `fortune`, `animal-face`, `lucky-recommendation`, `search` 등 전 도메인이 **안정적인 1:1 미러링 DDD 구조**를 갖춤.
- 번들러 없는 순수 JS 환경에 최적화된 계층 분리 체계 확립.

## Telescope Current Focus
- [ ] Firestore 규칙 최소 권한 재설계 및 검색/뉴스 읽기 안정성 기준 재검토
- [ ] 뉴스 생성 프롬프트 품질 관리(제목 품질, 중복 스타일 억제)
- [ ] (NEW) 검색 인덱스 데이터 최신성 및 검색 결과 렌더링 성능 최적화

## ⚠️ Lessons Learned
- **물리적 경로 의존성**: 번들러 없는 순수 JS 환경에서는 파일 시스템 구조가 곧 런타임 경로임을 명심해야 한다.
- **이론보다 실제**: 아키텍처 정석(Strict DDD Folder)을 지키려다 실제 동작(URL 접근성)을 해쳐서는 안 된다.
- **단순함의 힘**: 빌드 스크립트에서의 마법(정규표현식 치환 등)은 예기치 못한 부작용을 낳는다. 소스 구조와 배포 구조를 1:1로 가져가는 것이 가장 안전하다.
- **검증의 기준**: 로컬 서버 테스트와 깃액션(운영 사이트) 테스트는 다를 수 있으므로, 최종 확인은 항상 배포된 환경을 기준으로 해야 한다.
