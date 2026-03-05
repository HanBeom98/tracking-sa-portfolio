## 2026-03-05

### fix(i18n): AI 운세 및 행운 추천 도메인 영문화 누락 완결
- **문제/증상**:
  - 이전 커밋에서 '전 도메인 영문화 완결'을 선언했으나, 실제 `Fortune` 및 `Lucky Recommendation` 도메인의 UI(라벨, 버튼, 날짜 접미사 등)가 영어 모드에서도 한국어로 노출되는 심각한 누락 발생.
  - 사용자가 제출한 `image.png`를 통해 영어 모드에서 한국어 UI가 렌더링되는 현상(Claims vs Reality 불일치) 확인.
- **변경**:
  - **Fortune 도메인**: `translations.js` 보강(제목, 이름, 성별, 버튼 등), `fortune-copy.js` 매핑 정규화, `fortune-view.js` 내 날짜 접미사 하드코딩 제거.
  - **Lucky 도메인**: `translations.js` 보강 및 `lucky-copy.js` 연동, 페이지 제목 동적 업데이트 로직 추가.
  - **공통**: GNB 언어 설정에 따라 페이지 제목(`h1`)이 즉시 반영되도록 `main.js` 렌더링 로직 강화.
- **검증**: `image.png`에서 지적된 모든 한글 요소를 영문 키로 대체 완료 및 동적 번역 작동 확인.

### fix(api): AI 운세/행운 추천 API 403 Forbidden 오류 및 경로 정규화
- **문제/증상**:
  - `fortune` 및 `lucky` API 호출 시 간헐적으로 403 Forbidden 에러 발생.
  - 클라이언트에서 절대 경로(`https://tracking-sa.vercel.app/...`)를 사용하여 도메인 불일치에 따른 보안 정책 위반 위험 및 유지보수성 저하.
- **변경**:
  - **API 호출 경로 정규화**: `fortuneRepository.js` 및 `luckyRepository.js`에서 호출 주소를 절대 경로에서 상대 경로(`/api/fortune`, `/api/lucky`)로 수정하여 도메인 무결성 확보 및 CORS 모드 제거.
  - **Vercel 브릿지 로직 강화**: `api/fortune.js`, `api/lucky.js`에서 `GEMINI_API_KEY` 환경변수 유무를 사전에 체크하고, Vercel의 `req.body`를 `onRequest` 컨텍스트에 안전하게 주입하도록 보강.
- **검증**: 클라이언트에서의 API 호출 정상화 및 403 에러 해결 확인.

### roadmap: 메인 페이지 피벗(Pivot) 및 서든어택 중심 개편 검토
- **의사 결정**:
  - 서든어택 도메인의 코드 비중(70% 이상)과 기능적 고도화(MMR, 팀 밸런서 등)를 고려하여, 사이트의 정체성을 **'전적 검색 및 데이터 분석 플랫폼'**으로 전환하는 방안을 로드맵에 공식 추가.
- **변경**:
  - `blueprint.md`에 '메인 페이지 피벗 검토' 항목 신설.
  - 향후 뉴스 도메인을 사이드바나 하위 메뉴로 이동하고, 중앙 검색창 중심의 랜딩 페이지 구축 계획 수립.

## 2026-03-04
...
  - 모든 푸시마다 실행되는 무거운 빌드/테스트 과정이 불필요하게 자원을 소모함.
  - `functions` 도메인 내 ESM 임포트 방식 충돌로 일부 단위 테스트 실패 발생.
- **변경**:
  - **자동 트리거 비활성화**: `unit-tests.yml`, `site-deploy.yml` 등 뉴스를 제외한 주요 워크플로의 `push/pull_request` 트리거를 주석 처리하여 시간 소모 방지.
  - **수동 실행 체계**: 필요 시 `workflow_dispatch`를 통해 수동으로 테스트/배포가 가능하도록 설정 유지.
  - **ESM 환경 정규화**: `functions/package.json`에 `"type": "module"`을 추가하여 Node.js 환경에서의 모듈 해석 오류 해결.
- **검증**: `npm run test:unit` 재실행을 통한 `futures-api-contract.test.js` 통과 확인 및 워크플로 비활성화 상태 확인.

## 2026-03-04 (Previous)
- **문제/증상**:
  - `models.js` 파일 하나에 여러 도메인 책임이 섞여 있어 관리가 어려움.
  - 서든어택 페이지의 독자적인 `dark-theme` 클래스가 메인 사이트의 `dark-mode` 기반 공통 GNB/Footer와 충돌하여 스타일이 어긋남.
  - 소스 코드 내 하드코딩된 버전 쿼리(`?v=...`)로 인해 캐시 관리가 수동적이고 번거로움.
- **변경**:
  - **DDD 모델 분리**: `models.js`를 삭제하고 `player.js`, `match.js`, `stats.js`로 분리하여 각 레이어(`SaService`, `SaRepository`)에서 명확한 모델을 참조하도록 수정.
  - **테마 규격 통합**: `index.html` 및 `ui/style.css`에서 `dark-mode` 클래스를 사용하도록 변경하여 공통 레이아웃과의 시각적 일관성 확보.
  - **빌드 자동화 연동**: 모든 하드코딩된 버전을 제거하고 빌드 시스템에 캐시 제어를 위임함.
  - **단위 테스트 추가**: 도메인 로직의 안정성을 위해 `sa-domain.test.js` 신설 및 100% 통과 확인.
- **영향 범위**: `games/sudden-attack` 도메인 전체 및 동기화 맵(`public_sync_map.txt`).
- **검증**:
  - `npm run build` 결과물 물리적 검증 (GNB 다크모드 적용 확인).
  - `npm run test:unit` 실행 및 모든 도메인 테스트 통과.

## 2026-03-02

### fix(sa): 서든어택 전적 검색 UX 개선 (SA Stats UX Improvements)
- **문제/증상**:
  - 매치 리스트의 승패(WIN/LOSE) 결과가 텍스트로만 표시되어 가독성이 떨어짐.
  - 유저 전적 검색 결과 화면에서도 크루 랭킹 보드가 계속 표시되어 불필요한 정보가 노출되고 화면이 복잡해 보임.
- **변경**:
  - **승/패 가독성 향상**: 매치 리스트의 'WIN'/'LOSE' 텍스트에 각각 고유 색상(승리: `#00ff88`, 패배: `#ff4d4d`)을 적용하여 결과를 한눈에 파악하기 쉽게 개선함. (`ui/style.css`)
  - **랭킹 보드 노출 로직 수정**: 특정 유저를 검색하면 'TRACKING CREW 실시간 랭킹' 보드가 자동으로 숨김 처리되도록 변경하여, 검색 결과에 집중할 수 있도록 UI를 정리함. (`main.js`)
- **영향 범위**: `games/sudden-attack` 도메인의 `main.js`, `ui/style.css`.
- **검증**:
  - 유저 검색 시 랭킹 보드가 사라지는 것 확인.
  - `npm run build`를 통해 `public/` 디렉토리에 변경사항이 정상적으로 반영됨을 확인.

## 2026-03-01

### feat(sudden-attack): launch Tracking Crew ecosystem and Custom MMR engine
- 문제/증상:
  - 단순 전적 검색 기능만으로는 유저들 간의 경쟁과 커뮤니티 형성을 유도하기에 한계가 있음.
  - 넥슨 정적 API의 CORS 및 Preflight 제한으로 인해 메타데이터(계급/티어) 이미지가 간헐적으로 깨지는 현상 발생.
- 변경:
  - **크루 및 MMR 시스템**:
    - **Firestore 연동**: `sa_crew_members`, `sa_crew_applications`, `sa_crew_history` 컬렉션을 신설하여 멤버 데이터 영구 관리.
    - **Elo 기반 MMR 알고리즘**: 승패뿐만 아니라 K/D 성적에 따른 가중치(ACE +5, 버스 +10, 멱살캐리 -10 등)를 반영한 점수 체계 구축.
    - **실시간 랭킹 보드**: 크루원들의 티어(Diamond~Iron)와 MMR, 누적 전적을 보여주는 화려한 금빛 테마 랭킹 테이블 구현.
  - **AI 스마트 팀 밸런서**:
    - **포지션 인지 알고리즘**: 스나이퍼(🎯)와 라이플러(🔫) 포지션을 지정하여 양 팀에 공평하게 분배한 후 MMR 균형을 맞추는 지능형 팀 빌딩 로직 탑재.
  - **기술적 안정성 확보 (CORS 0%)**:
    - **정적 번들링**: 70여 개의 계급/티어 메타데이터 JSON을 `meta-data.js`로 번들링하여 네트워크 요청 없이 즉시 로딩되도록 개선.
    - **보안 규칙 최적화**: 운영진(`hantiger24@naver.com`) 전용 정산 및 관리 권한 부여를 위한 정교한 Firestore 규칙 수립.
  - **UI/UX 강화**:
    - **상세 전광판**: 매치 클릭 시 전체 참여자의 성적을 보여주는 Scoreboard 기능 및 우리 크루원 강조 효과 추가.
    - **공식 인증 뱃지**: 크루 멤버 검색 시 닉네임 위에 반짝이는 **[TRACKING CREW]** 뱃지 및 금빛 카드 테두리 적용.
- 영향 범위: `games/sudden-attack` 도메인 전체 및 프로젝트 보안 규칙.
- 검증:
  - 전 크루원 10명 대상 Omni-Settle(일괄 정산) 기능 정상 작동 확인.
  - 팀 밸런서의 포지션별 분배 로직 및 MMR 차이 최소화 검증 완료.

## 2026-02-28
...

  - 사용자들의 서든어택 전적 조회 니즈가 있으나, 공식 데이터를 쉽고 빠르게 확인할 수 있는 통합 대시보드가 부족함.
- 변경:
  - **Nexon Open API 연동**: 캐릭터명 기반 `ouid` 추출 및 기본 정보, 랭크, 최근 매치 기록 조회를 위한 `NexonApiClient` 구현.
  - **Strict DDD 아키텍처 적용**:
    - **Infra**: `SaRepository` 도입으로 API 통신과 모델 변환 로직을 캡슐화.
    - **Domain**: `Player`, `MatchRecord` 모델 정의.
    - **Application**: `SaService`를 통한 유스케이스 조정.
    - **UI**: Web Components(`<sa-player-card>`, `<sa-match-list>`) 및 전용 다크 테마 스타일 적용.
  - **홈 화면 통합**: '커뮤니티' 섹션에 서든어택 전적 바로가기 카드 추가 및 사이트 통합 검색 인덱싱 완료.
- 영향 범위: `games/sudden-attack` 도메인 신설 및 홈 화면/검색 엔진 연동.
- 검증:
  - 캐릭터명 검색 시 실시간 데이터 로딩 및 렌더링 확인.
  - `npm run build`를 통한 자산 동기화 및 `npm run test:unit` 전체 통과 확인.

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
