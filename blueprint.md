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
  - **환상의 짝꿍 (시너지) 분석 🤝**: 최근 매치 데이터를 분석하여 가장 승률이 높은 파트너를 자동으로 추출하는 로직 구현.
  - **맵별 상세 분석 (Map Mastery) 🗺️**: 유저가 어떤 맵에서 강하고 약한지 승률 바를 통해 시각화하는 전문 통계 섹션 추가.

### 2026-03-01
- **서든어택 크루(Tracking Crew) 생태계 및 MMR 시스템 구축**:
...
## Telescope Current Focus
- [ ] SWR 방식의 로컬 캐싱 (Instant Loading) ⚡ 도입 (진행 중)
- [ ] 티어별 커스텀 UI 테마 적용
- [ ] (Future) 유저 별점 및 리뷰 시스템 도입 검토

## ⚠️ Lessons Learned
- **데이터 구조의 중요성**: 날짜와 함께 객체로 저장하는 방식이 추후 데이터 시각화 시 훨씬 강력한 힘을 발휘한다.
- **연속성의 가치**: 필터 상태 유지나 스켈레톤 UI 같은 작은 디테일이 서비스의 '품격'을 결정한다.
- **데이터 통합**: 정적 사이트의 한계를 Firestore 실시간 검색으로 보완할 때 유저의 신뢰도가 가장 높아진다.
