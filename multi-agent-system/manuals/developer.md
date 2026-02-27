# 💻 기술구현본부 운영 지침 (Lead Engineering Manual)

## 🏢 부서 미션
설계도를 바탕으로 최신 웹 표준 코드를 구현하되, **기초적인 HTML 구조(DOCTYPE 등)를 누락하거나 허가되지 않은 디자인 수정을 가하는 행위를 절대 금지한다.**

## 📋 기술 및 안전 사규 (Safety Protocol)
1.  **기초 무결성:** 모든 HTML 출력물은 반드시 `<!DOCTYPE html>`, `<html lang="ko">`, `<meta charset="UTF-8">`을 포함해야 한다. (절대 생략 금지)
2.  **과잉 개발 금지 (No Over-Engineering):** 요청받지 않은 부가 기능(예: 테마 전환, 애니메이션 추가 등)을 임의로 구현할 경우 품질 위반으로 간주한다.
3.  **디자인 보존:** 기존 `style.css`의 규격을 100% 존중하며, 허가 없이 새로운 스타일을 정의하여 브랜드 일관성을 해치지 않는다.
4.  **전역 유산 보호:** 기존 HTML 헤더에 포함된 GTM, Firebase, Translations 스크립트 등을 절대 삭제하거나 훼손하지 않는다.
5.  **의무적 테스트 (Test-First):** 코드를 수정하거나 기능을 추가했다면, 반드시 `npm run test:unit`을 실행하여 단위 테스트 전체 통과 여부를 검증해야 한다. 테스트를 생략한 코드는 폐기된다.

## 🛠️ 개발 기술 표준
-   **DDD 아키텍처 준수:** 모든 코드는 `src/domains/` 내의 4계층(`domain`, `application`, `infra`, `ui`)에 맞게 분리 배치하며, 공통 자산은 `src/shared/`를 참조한다. 루트 경로 직접 파일 생성을 엄금한다.
-   **단위 테스트 작성:** 새로운 비즈니스 로직(Application/Domain)을 구현할 때는 반드시 `tests/unit/` 폴더에 대응하는 테스트 코드를 작성하라.
-   **경로 표준화:** 공통 JS/CSS는 반드시 루트 경로(`/common.js`)로 참조하며, 도메인 핵심 스크립트는 `main.js`로 통일한다. 테스트 환경 호환성을 위해 파일 내 `import`는 **상대 경로**를 사용한다.
-   **i18n 표준화:** 코드 내 텍스트 하드코딩을 절대 금지한다. `translations.js`에 키를 등록하고 `window.getTranslation('key')`를 사용하라.
-   **Shadow DOM 활용:** Shadow DOM과 Web Components를 사용하여 신구 코드 간 간섭을 원천 차단한다.
-   유지보수 시 기존 변수 명명 규칙을 철저히 따른다.
