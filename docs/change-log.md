## 2026-02-28

### refactor(games): implement strict DDD architecture and cleanup CSS hacks
- 문제/증상:
  - 빠르게 기능을 추가하며 `games` 도메인 내부에 비즈니스 로직, 데이터 접근, UI 렌더링이 섞여 있어 유지보수가 어려움.
  - 빌드 도구와의 충돌을 해결하기 위해 `!important` CSS 해크를 남발하여 기술적 부채 발생.
- 변경:
  - **Strict DDD 레이어 분리**:
    - **Domain**: `Game.js` 엔티티 도입으로 데이터 구조 표준화.
    - **Infra**: `gameRepository.js`로 Firestore API 호출 캡슐화.
    - **Application**: `gameService.js`로 비즈니스 로직 집중 (기존 `game-hub-service.js` 대체).
    - **UI**: `gameRenderer.js`로 모든 HTML 생성 로직 분리 및 재사용성 확보.
  - **CSS 정화**: 모든 `!important` 선언을 제거하고, `is-embedded` 클래스와 빌드 정책 수정을 통해 우아하게 레이아웃 제어.
  - **안정성**: entry point(`main.js`, `play/main.js` 등)의 코드를 더 방어적이고 읽기 쉬운 구조로 리팩토링.
- 영향 범위: `games` 도메인 전체 및 빌드 시스템 연동.
- 검증:
  - `npm run build` 및 `npm run test:unit` 전체 통과 확인.
  - 각 페이지별 UI 겹침 현상 및 데이터 로딩 정상 작동 확인.

### chore(ci): optimize CI/CD pipeline with smart selective testing
- 문제/증상:
  - 프로젝트 규모가 커짐에 따라 불필요한 전체 테스트 실행으로 빌드/배포 시간이 기하급수적으로 증가할 우려가 있음.
- 변경:
  - **영리한 테스트 필터링**: `dorny/paths-filter`를 도입하여 `src/domains/` 하위 수정 사항에 맞는 테스트만 선택적으로 실행 (`unit-tests.yml`, `site-deploy.yml`).
  - **병렬 가속화**: GitHub Actions Matrix 전략을 활용하여 여러 도메인의 테스트를 동시에 수행하여 전체 검증 속도 향상.
  - **배포 프로세스 가속화**: 배포 전 검증 단계를 최적화하여 변경되지 않은 도메인의 테스트를 생략하도록 개선.
- 영향 범위: 전체 CI/CD 파이프라인 및 개발 워크플로우.
- 검증:
  - `unit-tests.yml` 및 `site-deploy.yml` 설정 완료 및 도메인별 필터링 로직 확인.

### feat(games): implement full-cycle operation system and premium UX
- 문제/증상:
  - 게임 센터가 정적인 목록에 그쳐 유저 참여와 지속적인 운영 동력이 부족함.
  - 외부 이탈로 인한 체류 시간 저하 및 데이터 기반 정렬 기능 부재.
- 변경:
  - **운영 시스템**: `/games/admin/` 대시보드 구축으로 사용자 제출물 승인/거절 프로세스 확립.
  - **플레이어 (Play Wrapper)**: `iframe`을 활용한 내부 재생 환경 구축 및 플레이 횟수(`playCount`) 집계.
  - **사용자 경험**: 
    - 카테고리 필터링(Puzzle, AI 등) 및 실시간 인기순/최신순 정렬 추가.
    - `sessionStorage`를 활용한 필터 상태 유지(Persistence) 및 스켈레톤 UI 도입.
    - SNS 공유하기 버튼 및 동적 페이지 제목(`document.title`) 연동.
  - **운영 효율**: 관리자 전용 신규 제출 알림 배지(Pulse 애니메이션) 도입.
  - **보안**: `games` 컬렉션 보안 규칙 고도화 (일반 유저는 `playCount` 필드만 업데이트 가능).
- 영향 범위: 게임 센터 도메인 전체 및 전역 디자인 시스템.
- 검증:
  - `npm run test:unit` 전체 통과.
  - 실제 게임 플레이 후 `playCount` 증가 및 필터 상태 복구 확인.

### feat(search): realize hybrid real-time search engine
- 문제/증상:
  - 정적 인덱스 방식의 한계로 인해 새로 승인된 게임이 검색 결과에 즉시 반영되지 않음.
  - 검색 결과의 가독성이 낮고 정보량이 부족함.
- 변경:
  - **Hybrid Search**: 정적 `search-index.json`과 실시간 Firestore `games` 데이터를 병렬로 검색하여 결과 병합.
  - **Snippet & Highlight**: 검색 결과에 본문 요약(Description) 노출 및 제목/요약문 내 키워드 하이라이팅 적용.
  - **Home Integration**: 메인 화면 검색 드롭다운에도 하이라이팅 및 실시간 게임 데이터 연동 완료.
- 영향 범위: 사이트 전체 검색 시스템.
- 검증:
  - 신규 게임 승인 직후 검색 페이지에서 즉시 노출됨을 확인.

### feat(ui): restructure global navigation and home page hub
- 문제/증상:
  - 파편화된 개별 서비스들이 사이트의 전체적인 브랜드 이미지를 저해함.
- 변경:
  - **Restructuring**: GNB 및 홈 화면을 '게임 센터'와 'AI 용어사전' 허브 중심으로 전면 재편.
  - **i18n**: 오늘 추가된 모든 신규 기능을 포함하여 다국어 번역 키 완벽 동기화.
- 영향 범위: 사이트 전체 레이아웃 및 브랜딩.

# Change Log (AI Collaboration)

이 문서는 Gemini CLI/Codex 같은 AI 에이전트가 빠르게 맥락을 파악하도록, 변경 의도와 영향 범위를 요약합니다.

(이하 생략 - 기존 내용 유지됨)
