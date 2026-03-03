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
### 2026-03-03
- **서든어택 도메인 DDD 리팩토링 및 UX 고도화**:
  - **Strict DDD 아키텍처 완성**: 비즈니스 로직을 `SaService`(Application Layer)로 통합 관리하여 유지보수성 및 테스트 용이성 확보.
  - **세련된 로딩 경험 (Skeleton UI)**: 데이터 조회 중 실제 레이아웃과 유사한 반짝이는 플레이스홀더를 제공하여 체감 대기 시간 단축 및 시각적 안정성 향상.
  - **실시간 MMR 성장 그래프**: 내전 정산 시 MMR 히스토리를 자동으로 저장하고, 금색 성장 곡선으로 시각화(날짜 툴팁 포함).
  - **전적 비교 기능 (VS Mode) ⚔️**: 두 유저의 능력치 오각형 및 성장 곡선을 겹쳐서 보여주는 라이벌 대조 시스템 구축.

### 2026-03-01
- **서든어택 크루(Tracking Crew) 생태계 및 MMR 시스템 구축**:
  - **자체 랭킹 시스템**: Firestore 기반의 실시간 크루 랭킹 보드 구현. Elo 알고리즘을 커스텀하여 승패뿐만 아니라 K/D 활약도(ACE/버스/캐리)를 점수에 반영.
  - **AI 스마트 팀 밸런서**: 참여 인원의 MMR과 포지션(라플/스나)을 고려하여 양 팀의 실력 차이를 최소화하는 최적 조합 알고리즘 탑재.
  - **자동 내전 감지 엔진**: 매치 참여자 중 크루 멤버가 8인 이상일 경우 자동으로 '⚔️ 크루 내전'으로 분류 및 누적 전적 기록.
  - **운영진 전용 관리 콘솔**: 크루 신청 승인/거절, 전 멤버 최근 매치 일괄 스캔 정산, 시즌 초기화(MMR 리셋) 등 강력한 관리 도구 제공.

### 2026-02-28
- **서든어택 전적 검색(Sudden Attack Stats) 모듈 신규 구축**:
  - **넥슨 오픈 API 연동**: `ouid` 조회부터 상세 매치 정보까지 단계별 API 오케스트레이션 구현.
  - **Strict DDD 아키텍처 적용**: `Infra(Repository/Client)`, `Domain(Models)`, `Application(Service)`, `UI(Web Components)`의 4계층을 엄격히 준수한 참조 모델 확립.
  - **다크 테마 UI/UX**: 전문 전적 사이트 수준의 고대비 다크 모드 디자인 적용.

### 2026-02-27
- 아키텍처 안정성 회복 및 1:1 미러링 DDD 확립
- 게시판 UI 정전환 (Card to List) 및 애드센스 최적화 완료

## 🧭 Architecture Reality Check
- 전 도메인이 **안정적인 1:1 미러링 DDD 구조**를 갖추었으며, 특히 Games와 Search 도메인이 프로젝트의 아키텍처 표준으로 안착함.
- 실시간 데이터(Firestore)와 정적 자산(Build Artifacts)이 조화롭게 작동하는 하이브리드 모델 확립.

## Telescope Current Focus
- [ ] 서든어택 환상의 짝꿍 (시너지) 분석 기능 🤝 구현 (진행 중)
- [ ] 검색창 최신 데이터 새로고침(Refresh) 버튼 추가
- [ ] (Future) 유저 별점 및 리뷰 시스템 도입 검토
- [ ] (Future) 검색 결과 가상 스크롤(Virtual Scroll) 도입 (데이터 1,000건 이상 대비)

## ⚠️ Lessons Learned
- **데이터 구조의 중요성**: 날짜와 함께 객체로 저장하는 방식이 추후 데이터 시각화 시 훨씬 강력한 힘을 발휘한다.
- **연속성의 가치**: 필터 상태 유지나 스켈레톤 UI 같은 작은 디테일이 서비스의 '품격'을 결정한다.
- **보안의 정교함**: 단순 거부가 아닌 `affectedKeys()`를 활용한 정밀한 Firestore 규칙 설계가 기능과 보안의 균형을 맞추는 핵심이다.
- **데이터 통합**: 정적 사이트의 한계를 Firestore 실시간 검색으로 보완할 때 유저의 신뢰도가 가장 높아진다.
