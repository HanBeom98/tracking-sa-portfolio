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

## 🚦 Deployment & Operation Model (2026-02-25 기준)
- 일반 기능 배포: 로컬에서 `main.py --build-only` 후 `public/` 포함 커밋/푸시
- 뉴스 자동 발행: GitHub Actions 스케줄/수동 실행에서만 `python main.py` 실행 후 `public/` 자동 커밋
- Cloudflare Pages: `main` 변경 감지 후 자동 배포

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

## 🧭 Architecture Reality Check
- `news`, `board`, `games`, `account`, `futures-estimate` 도메인은 성숙한 4계층 DDD 구조를 갖춤.
- `fortune`, `animal-face` 등 레거시 도메인은 여전히 `main.js`에 인프라 로직이 결합되어 있음.
- 공유 자산(`common.js`)의 책임 분리가 지속적으로 진행 중.

## 🔭 Current Focus
- [x] 배포 안정성 강화: 뉴스/보드 도메인 E2E 스모크 테스트(`tests/e2e/`) 보강 완료
- [ ] 레거시 도메인(`fortune`, `animal-face`) API 호출 로직 `infra` 계층으로 분리
- [ ] Firestore 규칙 최소 권한 재설계 및 검색/뉴스 읽기 안정성 기준 재검토
- [ ] 뉴스 생성 프롬프트 품질 관리(제목 품질, 중복 스타일 억제)

## ⚠️ Lessons Learned
- `public/` 커밋 여부는 배포 반영 여부와 직결된다 (현 운영모드 기준).
- 검색은 Firestore 단일 의존 시 장애 파급력이 크므로 index fallback이 필수다.
- 모바일 게임은 `100vh`보다 `100dvh` + safe-area 보정이 실효성이 높다.
- 모듈 import 경로를 상대 경로로 유지해야 브라우저와 Node.js 테스트 환경 양쪽에서 호환된다.
- 도메인 하위의 과도한 폴더 분할보다는 레이어 중심의 평탄한 구조가 유지보수에 유리하다.
- 리팩토링 시 빌드 스크립트(`builder.py`)의 복사 규칙 최신화는 필수다.
