# Change Log (Tracking SA)

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
