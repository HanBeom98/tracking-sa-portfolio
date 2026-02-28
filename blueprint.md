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
- 뉴스 자동 발행: GitHub Actions 스케줄 실행에서 `python main.py` 실행 후 `public/` 자동 커밋.

## ✅ Completed Milestones
### 2026-02-28
- **서든어택 전적 검색(Sudden Attack Stats) 모듈 신규 구축**:
  - **넥슨 오픈 API 연동**: `ouid` 조회부터 상세 매치 정보까지 단계별 API 오케스트레이션 구현.
  - **Strict DDD 아키텍처 적용**: `Infra(Repository/Client)`, `Domain(Models)`, `Application(Service)`, `UI(Web Components)`의 4계층을 엄격히 준수한 참조 모델 확립.
  - **다크 테마 UI/UX**: `3rd.supply`, `suddengg.com` 등 전문 전적 사이트 수준의 고대비 다크 모드 디자인 적용.
  - **검색 시스템 통합**: 사이트 통합 검색 엔진에 서든어택 전적 인덱싱 완료.
- **CI/CD 파이프라인 지능형 고도화 (Smart Testing)**:
  - **영리한 테스트 필터링**: `dorny/paths-filter` 기반 도메인별 선택적 테스트 실행 체계 구축.
  - **병렬 검증 가속화**: GitHub Actions Matrix 활용으로 대규모 테스트 부하 분산 및 빌드 시간 단축.
- **네비게이션 UX 간소화 및 도메인 정합성 확보**:
  - **허브 중심 동선 개편**: 개별 게임 드롭다운을 제거하고 게임 센터 직통 링크로 통합.
  - **불필요 도메인 정리**: 네비게이션에서 용어사전 메뉴를 제거하고 관련 번역 데이터를 최적화하여 DDD 아키텍처의 정합성 강화.
- **게임 센터(Game Hub) 완전체 및 운영 생태계 구축**:
...
  - **운영 프로세스 완비**: 사용자 제출 → 관리자 승인 대시보드 → 실시간 게시로 이어지는 워크플로우 완성.
  - **고도화된 유저 경험**: 내부 플레이어(Play Wrapper), 연관 게임 추천, 플레이 횟수 통계, 카테고리 필터링 구현.
  - **탐색 연속성(Persistence)**: `sessionStorage`를 통한 마지막 필터 상태 유지 및 세련된 **스켈레톤 UI** 도입.
  - **바이럴 및 공유**: SNS 공유하기 버튼 및 동적 메타 데이터(Title) 최적화.
  - **보안 및 권한**: `playCount` 업데이트를 위한 정교한 Firestore Rules 수립 및 관리자 전용 신규 알림 배지 도입.
- **검색 엔진(Search Engine) 기술적 완성**:
  - **실시간 데이터 통합**: 정적 검색 인덱스와 Firestore 실시간 게임 데이터를 통합 검색(Hybrid Search)하도록 로직 고도화.
  - **풍부한 검색 결과**: 검색어 하이라이팅(Highlighting), 본문 요약(Snippet) 미리보기 기능 전 영역 적용.
  - **유실 방지 UX**: 검색 결과가 없을 때 인기 서비스를 추천하는 '에러 제로' 동선 설계.
- **플랫폼 브랜딩 및 UI 최적화**:
  - **GNB 및 홈 화면 전면 개편**: '게임 센터'와 'AI 용어사전'을 핵심 서비스로 배치하여 허브 중심의 레이아웃 확립.
  - **다국어(i18n) 완벽 지원**: 오늘 추가된 20여 개의 신규 UI 텍스트에 대해 한/영 번역 키 전수 등록.

### 2026-02-27
- 아키텍처 안정성 회복 및 1:1 미러링 DDD 확립
- 게시판 UI 정전환 (Card to List) 및 애드센스 최적화 완료

## 🧭 Architecture Reality Check
- 전 도메인이 **안정적인 1:1 미러링 DDD 구조**를 갖추었으며, 특히 Games와 Search 도메인이 프로젝트의 아키텍처 표준으로 안착함.
- 실시간 데이터(Firestore)와 정적 자산(Build Artifacts)이 조화롭게 작동하는 하이브리드 모델 확립.

## Telescope Current Focus
- [x] 모든 핵심 현안 완료 (졸업 상태)
- [ ] (Future) 유저 별점 및 리뷰 시스템 도입 검토
- [ ] (Future) 검색 결과 가상 스크롤(Virtual Scroll) 도입 (데이터 1,000건 이상 대비)

## ⚠️ Lessons Learned
- **연속성의 가치**: 필터 상태 유지나 스켈레톤 UI 같은 작은 디테일이 서비스의 '품격'을 결정한다.
- **보안의 정교함**: 단순 거부가 아닌 `affectedKeys()`를 활용한 정밀한 Firestore 규칙 설계가 기능과 보안의 균형을 맞추는 핵심이다.
- **데이터 통합**: 정적 사이트의 한계를 Firestore 실시간 검색으로 보완할 때 유저의 신뢰도가 가장 높아진다.
