# DDD(Domain-Driven Design) Guidelines for Tracking SA

이 프로젝트는 엄격한 **도메인 중심 설계(DDD)**를 따릅니다. 모든 에이전트는 새로운 기능을 추가하거나 코드를 수정할 때 아래 구조를 **반드시** 준수해야 합니다.

## 🏗️ 핵심 폴더 구조 (The Golden Rule)

1.  **`src/domains/` (Bounded Contexts)**:
    *   모든 비즈니스 기능(기능별 모듈)은 이 폴더 아래에 개별 도메인으로 존재해야 합니다.
    *   예: `src/domains/new-feature/`
    *   도메인 내부에는 `index.html`, `main.js`, `style.css`만 두는 것을 원칙으로 합니다.

2.  **`src/shared/` (Shared Kernel)**:
    *   **`assets/`**: 모든 도메인이 공유하는 물리적 자산 (`common.js`, `style.css`, `translations.js`, `firebase-config.js`).
    *   **`ui/`**: 공통 템플릿(`header.html`, `footer.html`) 및 공통 웹 컴포넌트.
    *   **`infra/`**: 시스템 인프라 로직 (`builder.py`, `db.py`, `ai.py`).

## 📜 코드 작성 표준 (Standard Operating Procedures)

1.  **진입점 통일**: 모든 도메인의 핵심 자바스크립트 파일명은 `main.js`로 통일합니다.
2.  **경로 참조**:
    *   공유 자산 참조 시 반드시 루트 경로를 사용합니다: `<script src="/common.js"></script>`
    *   도메인 고유 자산 참조 시 상대 경로를 사용합니다: `<link rel="stylesheet" href="style.css">`
3.  **i18n(다국어) 표준**:
    *   도메인 내부에서 `const t = { ... }` 객체를 직접 만들지 마십시오.
    *   대신 `src/shared/assets/translations.js`에 키를 추가하고, 코드에서는 `window.getTranslation('key')` 함수를 사용하십시오.
4.  **UI 동기화**: 모든 `index.html`은 반드시 전역 스타일과 도메인 스타일을 모두 포함해야 합니다.

## 🚫 금지 사항 (Prohibited Actions)
- 루트 디렉토리에 새로운 폴더나 파일을 직접 생성하지 마십시오. (단, `main.py`나 설정 파일 제외)
- `public/` 폴더 내부를 직접 수정하지 마십시오. 모든 변화는 `src/`에서 이루어지고 빌더를 통해 배포되어야 합니다.
- 도메인 간에 직접적인 코드 참조를 하지 마십시오. 모든 공유는 `src/shared`를 통해서만 이루어집니다.
