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

## 🚦 Deployment & Operation Model (2026-03-04 업데이트)
- **배포 방식 (Local-First Build)**: GitHub Actions 무료 시간 최적화를 위해 **로컬 빌드(`npm run build`) 후 `public/` 직접 푸시** 방식을 권장합니다.
- **Actions 최적화**: `unit-tests.yml`, `site-deploy.yml`의 자동 트리거를 비활성화하고, 수동(`workflow_dispatch`) 또는 필수 예약 작업(뉴스 생성)만 가동합니다.
- 뉴스 자동 발행: GitHub Actions 스케줄 실행 유지.

## ✅ Completed Milestones
### 2026-03-04
- **서든어택 전적 검색 UX 고도화 및 분석 기능 강화**:
  - **지능형 분석**: MMR과 HSR(히든 스킬 레이팅) 간 괴리 분석 및 성향별 피드백(승부사형, 무력가형 등) 추가.
  - **위트 있는 게이미피케이션**: 내전 성적에 따른 다이내믹 라벨(똥싼 판, 기부천사, 역귀 등) 도입으로 유저 재미 요소 강화.
  - **UI 접근성 향상**: 독립 서비스인 서든전적 페이지 내 전용 홈 버튼 추가 및 K/D 표기 방식(%) 정규화.
  - **시스템 최적화**: GitHub Actions 무료 사용분 보존을 위한 워크플로 트리거 정리 및 ESM 모듈 환경 정규화.

- **서든어택 도메인 Strict DDD 완성 및 테마 통합**:
  - **도메인 모델 분리**: `models.js`를 `player.js`, `match.js`, `stats.js`로 완전히 분리하여 도메인 응집도 향상.
  - **공통 레이아웃 테마 통합**: `dark-mode` 클래스 적용을 통해 메인 사이트의 GNB/Footer와 서든어택 페이지의 디자인 통일성 확보.
  - **코드 클린업**: 하드코딩된 버전 파라미터 제거 및 `public_sync_map.txt` 최신화로 유지보수 환경 정규화.
  - **단위 테스트 구축**: `tests/unit/sa-domain.test.js`를 신설하여 핵심 비즈니스 로직(K/D, 플레이스타일 등) 자동 검증 체계 마련.

### 2026-03-03
- **디스코드 봇 통합 및 내전 관리 시스템 구축**:
  - **고성능 인터랙션 핸들러**: `context.waitUntil`과 지연 응답(Deferred Response)을 도입하여 3초 타임아웃 문제를 해결하고 초고속 응답 환경 구축.
  - **지능형 팀 밸런싱 엔진**: 웹사이트의 팀 밸런서 알고리즘을 이식하여 포지션(라플/스나) 균형 및 MMR 평균 최적화 자동화.
  - **멀티 서버 독립 세션 지원**: `guild_id` 기반 데이터 격리로 여러 디스코드 서버에서 충돌 없이 개별 모집 진행 가능.
  - **UX 기반 모집 프로세스**: 닉네임 입력 모달 -> 포지션 선택 버튼 -> 실시간 명단 업데이트 및 전원 멘션 알림으로 이어지는 매끄러운 유저 플로우 완성.
  - **실시간 내전 데이터 리포트**: `/전적검색` 시 내전 킬 퍼센트(%), 승률, MMR 등 크루원 전용 통계를 서든 유저 친숙한 방식으로 제공.
  - **보안 및 운영 최적화**: Firestore 보안 규칙 업데이트 및 10초 새로고침 쿨타임 적용으로 비용 효율적이고 안전한 운영 기반 마련.

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
