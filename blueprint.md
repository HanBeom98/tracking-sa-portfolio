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

### 2026-02-28
- **게임 센터(Game Hub) 허브 및 등록 시스템 구축 (NEW)**:
  - 독립적인 `/games/` 메인 페이지를 구축하여 테트리스, 2048 등 게임 콘텐츠 접근성 강화.
  - 사용자가 직접 게임을 등록하고 공유할 수 있는 **제출 시스템**(`/games/submit/`) 구현 (DDD 구조 적용).
  - 관리자 승인 기반의 게임 게시 워크플로우 마련 및 다국어 지원 완료.
- **지수 예측 신뢰도 및 시각화 고도화 (NEW)**:
  - '예측 vs 실제 비교표'에 **이전 거래일 종가 → 현재 종가** 변화 과정을 노출하여 데이터 맥락 제공.
  - 결과(성공/실패)에 따른 컬러 배지(Badge) 시스템을 도입하여 시각적 직관성 강화.
  - API 및 단위 테스트를 최신 데이터 스키마(`actual_prev_close` 포함)에 맞게 업데이트하여 무결성 보장.

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
- **애드센스 승인 최적화 및 콘텐츠 고품질화**:
  - 멀티 에이전트 프롬프트를 강화하여 단순 요약을 넘어 기술적/경제적 배경 논증을 포함한 **1,200자 이상의 전문 칼럼** 형식을 강제.
  - 기획-집필-교열 파이프라인에서 출력 포맷(`[KO_START]` 등) 파싱 안정성 개선.
- **검색 엔진 인덱싱 버그 해결 및 데이터 무결성 강화**:
  - `builder.py` 정규식을 개선하여 HTML 속성 순서(href/class)에 상관없이 100여 건의 뉴스 기사를 `search-index.json`에 100% 정상 인덱싱.
  - 뉴스 수집 시 시스템 시간이 아닌 **RSS 원본 발행 시간(published_parsed)**을 추출해 Firestore에 저장하도록 로직을 수정하여 기사 정렬의 논리적 순서 확보.
- **운영 도구 및 브랜딩 개선**:
  - 기존 기사들을 새로운 고품질 프롬프트로 안전하게 일괄 재생성할 수 있는 `scripts/regenerate_news.py` 개발 및 배치 완료.
  - 사이트 내 사용된 '실리콘밸리' 표현을 '글로벌 전문가'로 일괄 교체하여 독자층 확대 및 범용성 확보.
- **AI 용어사전(Glossary) 시스템 구축 및 SEO 자동화**:
  - 뉴스 본문 내 핵심 용어를 자동으로 추출하고 백과사전식 설명을 생성하는 `multi-agent-system/glossary-extractor.js` 및 전용 에이전트 도입.
  - 생성된 용어사전을 기반으로 뉴스 본문에 자동으로 내부 링크를 삽입하는 SEO 최적화 파이프라인 구축.
  - 용어사전 도메인(`public/glossary/`) 신규 추가로 AdSense 승인용 고품질 정적 콘텐츠 대량 확보.
- **FOUC(Flash of Unstyled Content) 완전 해결 및 UI 안정화**:
  - 번역 데이터 로딩 전 기본 텍스트 노출로 인한 깜빡임을 방지하기 위해 헤더/푸터 및 네비게이션 기본값을 한국어('인사이트' 등)로 동기화.
  - 모든 도메인 페이지의 `app-shell-runtime.js` 로딩 순서를 최적화하여 레이아웃 시프트와 텍스트 유실 방지.

### 2026-02-26
- 뉴스 도메인 DDD 완성
- 보드 도메인 레이어 평탄화 및 통합 완료
- 레거시 도메인(Fortune, Animal-face) DDD 리팩토링 완료
- 게임 도메인 DDD 분리 완료

### 2026-02-25
- 뉴스 도메인 정리 및 UI/기능 보강
- 동물상 테스트 복구 및 네비게이션 안정화

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
