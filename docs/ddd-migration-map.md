# DDD Migration Map (for Gemini/Codex)

이 문서는 Tracking SA의 구조 전환 이력을 빠르게 파악하기 위한 참조 문서입니다.

## 1) Current Source of Truth
- 개발 원본: `src/*`
- 배포 산출물: `public/*` (`npm run build`로 생성)
- 원칙: 직접 `public/*` 수정 금지, 반드시 `src/*` 수정 후 빌드

## 2) Current Structure Snapshot
- `src/domains/*`: 기능/페이지 단위 도메인
- `src/shared/assets/*`: 공통 JS/CSS 정적 자산 (전역 디자인 시스템, i18n, 공통 런타임)
- `src/shared/ui/*`: 공통 헤더/푸터/헤드 템플릿
- `src/shared/infra/*`: 빌드/DB/뉴스 인프라

### [Games 도메인] (Strict DDD)
- **Domain**: `src/domains/games/domain/Game.js` (게임 엔티티 모델 및 비즈니스 규칙)
- **Application**: `src/domains/games/application/gameService.js` (게임 라이프사이클 비즈니스 로직)
- **Infra**: `src/domains/games/infra/gameRepository.js` (Firestore 데이터 액세스 전담)
- **UI**: `src/domains/games/ui/gameRenderer.js` (전용 렌더링 및 UI 컴포넌트 로직)
- **Pages**:
  - `src/domains/games/main.js`: 허브 메인 페이지
  - `src/domains/games/play/`: 내부 플레이어 및 추천 시스템
  - `src/domains/games/admin/`: 관리자 전용 대시보드
  - `src/domains/games/submit/`: 게임 등록 폼 및 검증 로직
- **개별 엔진**: `tetris/`, `ai-evolution/` (독립된 게임 엔진 도메인)
- **특이사항**: `!important` 제거 및 `is-embedded` 감지 로직을 통한 우아한 레이아웃 제어.

### [Search 도메인] (완성형)
- **Infra**:
  - `src/domains/search/infra/searchRepository.js`: 정적 인덱스 로딩 및 Firestore 실시간 게임 검색 전담.
- **Application**:
  - `src/domains/search/application/search-data.js`: 데이터 필터링 및 파싱 로직.
- **UI**:
  - `src/domains/search/ui/search-renderer.js`: 하이라이팅 및 스니펫 렌더링.
- **특이사항**: 홈 화면 `search.js`와 로직 동기화 완료.

### [기타 도메인 표준]
- **News**: Presenter 패턴을 통한 데이터 변환 및 상세/목록 페이지 분리.
- **Board**: 기능별 하위 폴더를 제거하고 루트 레이어(`application/`, `ui/`)로 평탄화하여 관리 효율 증대.
- **Account**: 닉네임 규칙을 Domain 레이어(Value Object)로 분리하여 비즈니스 무결성 확보.

## 3) Build and Injection Flow
1. 엔트리포인트: `main.py`
2. 사이트 빌드: `src/shared/infra/builder.py` (전 도메인 1:1 미러링 복사 및 HTML 후처리)
3. 검색 인덱스 생성: 기사 요약문을 포함한 풍부한 인덱스 자동 생성.

## 4) What Gemini Should Check First
1. `blueprint.md` (현재 목표와 완료된 마일스톤)
2. `docs/change-log.md` (최근의 기술적 변경 내역)
3. `docs/ddd-migration-map.md` (이 문서 - 구조적 지도)
