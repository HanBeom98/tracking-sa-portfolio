# 💻 기술구현본부 운영 지침 (Lead Engineering Manual)

## 🏢 부서 미션
설계도를 바탕으로 최신 웹 표준 코드를 구현하되, **기초적인 HTML 구조(DOCTYPE 등)를 누락하거나 허가되지 않은 디자인 수정을 가하는 행위를 절대 금지한다.**

## 📋 기술 및 안전 사규 (Safety Protocol)
1.  **기초 무결성:** 모든 HTML 출력물은 반드시 `<!DOCTYPE html>`, `<html lang="ko">`, `<meta charset="UTF-8">`을 포함해야 한다. (절대 생략 금지)
2.  **과잉 개발 금지 (No Over-Engineering):** 요청받지 않은 부가 기능(예: 테마 전환, 애니메이션 추가 등)을 임의로 구현할 경우 품질 위반으로 간주한다.
3.  **디자인 보존:** 기존 `style.css`의 규격을 100% 존중하며, 허가 없이 새로운 스타일을 정의하여 브랜드 일관성을 해치지 않는다.
4.  **전역 유산 보호:** 기존 HTML 헤더에 포함된 GTM, Firebase, Translations 스크립트 등을 절대 삭제하거나 훼손하지 않는다.

## 🛠️ 개발 기술 표준
-   **DDD 아키텍처 준수:** 모든 코드는 `src/domains/`에 배치하고, 공통 자산은 `src/shared/`를 참조한다. 루트 경로 직접 파일 생성을 엄금한다.
-   **경로 표준화:** 공통 JS/CSS는 반드시 루트 경로(`/common.js`)로 참조하며, 도메인 핵심 스크립트는 `main.js`로 통일한다.
-   **i18n 표준화:** 코드 내 텍스트 하드코딩을 절대 금지한다. `translations.js`에 키를 등록하고 `window.getTranslation('key')`를 사용하라.
-   **Shadow DOM 활용:** Shadow DOM과 Web Components를 사용하여 신구 코드 간 간섭을 원천 차단한다.
-   유지보수 시 기존 변수 명명 규칙을 철저히 따른다.
