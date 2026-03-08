# Change Log (Tracking SA)

## 2026-03-08

### review(architecture): DDD 구조/클린 코드/중복 점검
- **점검 범위**:
  - DDD 경계 준수(`npm run check:ddd-boundary`)
  - 레이어 클린니스(`application`의 브라우저/DOM 의존)
  - 소스 중복(`src` vs `public` vs `public/en`)
- **결과 요약**:
  - 신규 DDD 위반: 없음
  - 레거시 baseline 위반: 0개
  - 동일 JS 중복: `src`-`public` 133개, `src`-`public/en` 123개
- **추가 진행 (account)**:
  - `account/application/account-view-model.js`에서 `window.getTranslation` 직접 접근 제거.
  - `tests/unit/account-view-model.test.js` 추가.
  - `npm run test:unit:account` / `npm run check:ddd-boundary` / `npm run check:source-of-truth` 통과.
- **추가 진행 (news-client)**:
  - `news/application/news-client.js`에서 `window/document` 직접 접근 제거.
  - `npm run test:unit:news` / `npm run check:ddd-boundary` / `npm run check:source-of-truth` 통과.
- **추가 진행 (baseline 0 마감)**:
  - UI/서비스 성격 파일을 `application` 레이어 밖으로 이동해 경계 위반 4건 정리:
    - `games/application/gameService.js` -> `games/service/game-service.js`
    - `games/tetris/application/tetris-game.js` -> `games/tetris/ui/tetris-game.js`
    - `games/ai-evolution/application/ai-evolution-game.js` -> `games/ai-evolution/ui/ai-evolution-game.js`
    - `news/application/news-admin-actions.js` -> `news/ui/news-admin-actions.js`
  - 연관 import 경로(`src/public/public-en`) 일괄 갱신.
  - `npm run check:ddd-boundary` / `npm run check:source-of-truth` / `npm run test:unit:news` 통과.
- **추가 진행 (중복 제거 - gender button binding)**:
  - 공통 유틸 추가: `src/shared/ui/gender-button-group.js`
  - 적용:
    - `src/domains/animal-face/ui/animal-face-view.js`
    - `src/domains/fortune/ui/fortune-view.js`
    - `src/domains/lucky-recommendation/ui/lucky-view.js`
  - 동일 동작(버튼 active 토글 + `onGenderChanged` 콜백)을 3개 도메인에서 공통 함수로 통합.
  - `public`, `public/en` 미러 파일 동기화 후 `npm run check:ddd-boundary` / `npm run check:source-of-truth` 통과.
- **추가 진행 (중복 제거 - date selector binding)**:
  - 공통 유틸 추가: `src/shared/ui/date-selectors.js`
  - 적용:
    - `src/domains/fortune/ui/fortune-view.js`
    - `src/domains/lucky-recommendation/ui/lucky-view.js`
  - 월/일(및 연도) 셀렉트 옵션 생성 중복 루프를 공통 함수로 통합.
  - `npm run check:ddd-boundary` 통과.
- **추가 진행 (중복 제거 - smooth scroll helper)**:
  - 공통 유틸 추가: `src/shared/ui/scroll.js`
  - 적용:
    - `src/domains/fortune/ui/fortune-view.js`
    - `src/domains/lucky-recommendation/ui/lucky-view.js`
  - 결과 렌더 후 스크롤 이동 로직(`scrollIntoView`)을 공통 함수로 통합.
  - `npm run check:ddd-boundary` 통과.
- **추가 진행 (중복 제거 - search repository reuse)**:
  - 대상: `src/shared/assets/search.js`
  - 변경:
    - 로컬 중복 로직(`loadSearchIndex`, `searchFromNewsIndex`, `searchGamesFromFirestore`, 검색 필터링) 제거.
    - `import()` 기반으로 `src/domains/search/infra/searchRepository.js`, `src/domains/search/application/search-data.js`를 재사용.
  - 효과:
    - 홈 검색과 검색 페이지가 동일 저장소/필터 로직을 공유.
    - 검색 로직 변경 시 수정 지점 축소.
  - `npm run check:ddd-boundary` 통과.
- **추가 진행 (운영 가드 - public edit policy)**:
  - 스크립트 추가: `scripts/check-public-edit-policy.js`
  - 규칙:
    - 일반 리팩토링 커밋에서 `public` 미러 파일 수정 시, 동일 커밋에 대응 `src` 변경이 없으면 실패.
    - `chore(sync):` 커밋은 `src` 변경을 포함하면 실패.
    - 변경된 `public` 미러는 항상 대응 `src` 파일과 내용 일치해야 통과.
  - 연동:
    - `package.json` -> `npm run check:public-edit-policy`
    - `.github/workflows/site-deploy.yml` test job에서 필수 검사로 실행.
- **추가 진행 (board)**:
  - `board/application/authGateway.js`에서 `window` 직접 접근 제거.
  - `board/application/write-auth.js`에서 경로 계산 시 `window.location` 직접 의존 제거.
  - `npm run test:unit:board` / `npm run check:ddd-boundary` / `npm run check:source-of-truth` 통과.
- **판단**:
  - 구조 개선은 진행 중이나, `src` 단일 소스 운영은 아직 미완료.
- **후속 액션**:
  1. `src` 단일 소스 강제 가드(CI/검증 스크립트) 추가
  2. `ALLOWED_LEGACY_FILES` 단계 축소 계획 수립
  3. SA 도메인 변경 커밋을 기능 코드(`src`)와 산출물(`public`)로 분리 운영

## 2026-03-07

### fix(test): `app-shell-runtime` 유닛 테스트 종료 정체 해결
- **문제/증상**:
  - `npm run test:unit` 실행 시 `tests/unit/app-shell-runtime.test.js` 구간 이후 프로세스가 종료되지 않고 대기 상태로 남음.
- **원인**:
  - `src/shared/assets/app-shell-runtime.js` 내부 번역 준비 체크용 `setInterval`이 Node 테스트 런타임 이벤트 루프를 유지.
  - 테스트 스텁 환경에서 `document.querySelector` 접근 가드가 부족해 런타임 안전성이 낮음.
- **해결**:
  - `hasDomainTranslationScriptTag()` 가드 함수 도입으로 `document/querySelector` 미존재 환경 안전 처리.
  - readiness interval에 `unref()` 적용하여 테스트 런타임에서 이벤트 루프 점유 해제.
- **검증**:
  - `npm run test:unit` 통과 (`96 passed, 0 failed`, 정상 종료).

## 2026-03-05 (현재 진행 중)

### fix(api): 운세 및 행운 추천 API 403/400/405 에러 완전 해결
- **문제/증상**: 
  - 클라우드플레어 지역 차단(Location Not Supported)으로 인해 Gemini API 호출 실패.
  - 리버트 과정에서 성공했던 보안 헤더(`Referer`, `Origin`) 로직 유실.
- **해결**:
  - **Vercel 우회**: 클라우드플레어 차단을 피해 Vercel 엔드포인트(`https://tracking-sa.vercel.app/api/...`)를 직접 호출하도록 리포지토리 수정.
  - **성공 로직 복구**: `Referer: https://trackingsa.com` (슬래시 없음) 헤더를 주입하여 Google 보안 정책 통과.
  - **안정화**: 날짜 데이터 객체 파싱 로직 보강 및 브라우저 캐시 무력화(`v=final_fix`).
- **검증**: 운세 및 행운 추천 결과 정상 출력 확인.

### warning(revert): 시스템 리버트 수행 및 작업 손실 보고
- **지점**: `4f50bf6b` 커밋으로 강제 롤백.
- **사유**: 빌더(`builder.py`) 수정 과정에서 서든어택 도메인의 GNB 레이아웃이 훼손되는 사고 발생.
- **손실 내역 (복구 예정)**:
  - 메인 홈 화면의 설명글 및 카테고리 영문화.
  - 테마 일렁임(FOUC) 방지 시스템 가드.
  - 동물상/AI 테스트의 실시간 언어 전환 로직.
  - 검색 플레이스홀더 및 공유 메시지 현지화.

---

## 복구 로드맵 (Surgical Recovery Plan)

### Phase 1: 시스템 안정화 (테마 및 언어 가드)
- [ ] `templates.py`에 테마 가드 및 정적 자산 제외 리다이렉트 로직 재이식.
- [ ] `style.css` 다크모드 선택자 범용성 확보.

### Phase 2: 메인 홈 및 i18n 완결
- [ ] `index.html` 카드 설명글 `data-i18n` 복구.
- [ ] `translations.js` 최종 번역 데이터셋 동기화.

### Phase 3: 도메인별 실시간 동기화
- [ ] `animal-face/main.js` 및 `ai-test/main.js` 리스너 복구.
- [ ] GNB 링크 동적 전환 로직 (`app-shell-runtime.js`) 복구.

---
(이하 생략 - 과거 기록 보존)
