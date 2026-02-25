# Change Log (AI Collaboration)

이 문서는 Gemini CLI/Codex 같은 AI 에이전트가 빠르게 맥락을 파악하도록, 변경 의도와 영향 범위를 요약합니다.

## 2026-02-25

### fix(nav): stabilize dropdown interaction; tune animal upload box size (`e872480`)
- 문제/증상:
  - 상단 네비게이션 드롭다운이 마우스 이동 중 닫혀 하위 메뉴 클릭이 어려움.
  - 동물상 테스트 업로드 점선 박스가 과하게 크게 보임.
- 변경:
  - `src/shared/assets/common.js`
    - 드롭다운 닫힘 지연 시간 `140ms -> 320ms` 조정.
    - `.dropdown-content` 영역 진입/이탈 이벤트를 추가해 이동 중 닫힘 완화.
  - `src/domains/animal-face/main.js`
    - 업로드 박스 폭/패딩/간격 축소 (`width: min(100%, 520px)`, `padding: 22px 16px`, `gap: 10px`).
- 영향 범위:
  - 네비게이션 공통 동작(전체 페이지).
  - 동물상 테스트 업로드 UI 크기(동물상 페이지).
- 검증:
  - 빌드 성공 확인 (`npm run build`).
  - 드롭다운 메뉴 hover/click 이동 테스트 및 동물상 업로드 박스 크기 확인.

### fix(animal-face): use official tmimage runtime loading (`3be01e7`)
- 문제/증상:
  - 동물상 테스트 실행 시 `Uncaught ReferenceError: exports is not defined`, `tmImage not available`.
- 변경:
  - `src/domains/animal-face/index.html`
    - Teachable Machine 런타임을 정적 스크립트로 로드:
      - `@tensorflow/tfjs@latest`
      - `@teachablemachine/image@latest`
  - `src/domains/animal-face/main.js`
    - 동적 로더(`loadScriptOnce`, `ensureTmImageReady`) 제거.
    - `window.tmImage` 준비 대기 후 `tmImage.load(model.json, metadata.json)` 호출.
- 영향 범위:
  - 동물상 테스트 모델 로딩 경로만 변경.
  - 공통 스타일/다른 페이지 로직 영향 없음.
- 검증:
  - 빌드 성공 확인.
  - 동물상 테스트에서 이미지 업로드 후 결과 추론 정상 동작 확인.

### build/seo/search/nav 관련 직전 히스토리 요약
- `a1d21c1`: SEO/수익화/소셜 메타 복구(공통 head 주입 포함).
- `1a95d46`: 표준 빌드 스크립트 정리(`npm run build`, `build:full`).
- `004c479`: 검색 입력 Enter 시 결과 페이지 라우팅(포털형 검색 UX 기초).
- `568afa3`, `b5e0cb5`, `7af4a0d`: 네비게이션 드롭다운 안정화 1~3차 수정.

## 작업 규칙 (향후 AI용)
- 소스는 `src/*`를 먼저 수정하고, 반드시 `npm run build`로 `public/*`를 동기화한다.
- 커밋은 기능 단위로 작게 나누고, 아래 5가지를 남긴다:
  - 문제/증상
  - 변경 파일/핵심 로직
  - 영향 범위
  - 검증 방법
  - 남은 리스크/후속 과제
