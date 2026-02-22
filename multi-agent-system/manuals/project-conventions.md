# Project Conventions (Mandatory Rules)

## 1. HTML Standard Structure
모든 신규 `index.html` 생성 시 다음 요소를 반드시 포함해야 합니다:
- **SEO & Search Console**: `<meta name="google-site-verification" content="UutJ4-ti1UsLczEuiR85D-gDNWjA16nl3whr0TBqR4k" />`
- **AdSense Ready**: `<head>` 하단에 애드센스 주석 블록(`<!-- [Revenue] AdSense -->`)을 포함할 것.
- **Language Support**: `translations.js` 및 `common.js`를 로드하고 `data-i18n` 속성을 활용할 것.
- **Semantic Layout**: `<header>`, `<main>`, `<footer>` 구조를 유지할 것.

## 2. Web Component Design
- 모든 UI 요소는 `test-button`과 같이 독자적인 커스텀 엘리먼트(`Custom Elements`)로 개발하라.
- **Shadow DOM**을 사용하여 외부 스타일과의 간섭을 차단하라.

## 3. Styling Rules
- **Colors**: `oklch(L C H)` 형식을 최우선으로 사용하라.
- **Layout**: `:has()` 선택자와 **Container Queries**를 사용하여 극강의 반응형 디자인을 구현하라.
- **Depth**: 다중 `box-shadow`를 사용하여 공중에 뜬 듯한 입체감을 연출하라.

## 4. File Management
- 모든 정적 에셋(이미지, 폰트)은 상대 경로를 사용하라.
- `folder: [name]` 명령어로 지정된 폴더 안에 `index.html`, `style.css`, `script.js`를 모두 생성하라.
