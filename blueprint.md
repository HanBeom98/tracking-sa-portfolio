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
- GitHub Actions 역할 고정:
  - `daily-news-post.yml`을 예약/수동 뉴스 생성 전용으로 단순화
  - push 트리거 및 `--build-only` 분기 제거
- 뉴스 에이전트 안정화:
  - Gemini 호출 재시도(backoff) 추가
  - 기획(JSON) 파싱 실패 시 재시도 + fallback plan
  - 모델/토큰/재시도 파라미터 환경변수화
  - `processed_articles.log` 회전 정책 추가
- 뉴스 본문 해시태그 렌더링 개선:
  - `##HASHTAGS##`를 제목이 아닌 작은 chip 컴포넌트로 렌더링
- 검색 기능 안정화 2차:
  - Firestore unavailable 시 즉시 뉴스 인덱스 fallback
  - DOMParser 실패 대비 HTML 정규식 파서 fallback
  - 메인 검색바/검색결과 페이지 양쪽 동기 반영
- 모바일 게임 UX 개선:
  - 테트리스: 헤더/하단 safe-area 고려 레이아웃 및 버튼 가림 방지
  - AI Evolution 2048: 단일 `index.html` 내 상단 네비게이션 내장 및 게임 영역 오프셋 적용

## 🧭 Architecture Reality Check
- `src/domains` 구조는 자리잡았지만, 도메인별 `domain/application/infra/ui` 레이어 분리는 아직 불균일
- 일부 페이지는 UI/데이터 접근/상태 로직이 단일 파일에 결합되어 있음
- 운영상 요구(SEO/색인/배포 속도)로 인해 일부 게임 페이지는 의도적으로 “단일 HTML 집중형” 유지

## 🔭 Current Focus
- [ ] 보드(`board`) 도메인 레이어 분리 파일 설계(파일 이동 최소화 방식)
- [ ] Firestore 규칙 정리(검색/뉴스 읽기 안정성 기준으로 최소 권한 재설계)
- [ ] 뉴스 생성 프롬프트 품질 관리(제목 품질, 중복 스타일, 과한 해시태그 억제)
- [x] 뉴스 상세 목록 복귀 버튼 반영
- [x] 검색 fallback 다중화 반영
- [x] 뉴스 에이전트 재시도/로그 회전 반영
- [x] 테트리스 모바일 safe-area 대응
- [x] 2048 단일파일 네비게이션 반영

## ⚠️ Lessons Learned
- `public/` 커밋 여부는 배포 반영 여부와 직결된다 (현 운영모드 기준)
- 검색은 Firestore 단일 의존으로 두면 장애 시 UX가 즉시 붕괴하므로 index fallback이 필수다
- 모바일 게임은 `100vh`보다 `100dvh` + safe-area 보정이 실효성이 높다
- 뉴스 본문 마크다운 규칙(`##`)은 SEO/가독성에 직접 영향이 있으므로 포맷 태그를 별도 렌더링 규칙으로 분리해야 한다
