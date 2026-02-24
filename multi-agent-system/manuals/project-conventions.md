# Tracking SA Project Conventions

## 🏗️ Build-First Architecture (MUST READ)
우리 프로젝트는 단순한 정적 웹사이트가 아니라, **Python 빌드 엔진(`core/builder.py`)**이 Firestore 데이터를 읽어 HTML을 찍어내는 **SSG(Static Site Generation)** 시스템입니다.

### ⚠️ Critical Rules for Agents:
1.  **Source vs. Output**: 
    - `news/`, `fortune/` 등의 폴더에 있는 파일은 **설계도**입니다.
    - 실제 배포되는 파일은 `public/`에 있으며, 이는 빌드 엔진이 생성합니다.
2.  **HTML Generation Logic**:
    - 뉴스 목록, 기사 카드 등 반복되는 UI를 수정할 때는 반드시 `core/builder.py` 내부의 HTML 스트링 생성 로직을 함께 수정해야 합니다. 
    - **파일만 고치고 빌드 엔진을 무시하면 UI는 절대 바뀌지 않습니다.**
3.  **Class Name Sync**:
    - CSS에서 정의한 프리미엄 클래스명(`news-card-premium` 등)은 반드시 빌더의 HTML 렌더링 로직에도 동일하게 반영되어야 합니다.
4.  **Shadow DOM Encapsulation**:
    - 모든 신규 기능은 웹 컴포넌트 표준을 따르며, Shadow DOM 내부에 스타일을 가둡니다.

## 🎨 Design System
- **Color**: Exclusively use `oklch()` for depth and modern look.
- **Theme**: Premium Blue (#0052cc base) with high-contrast selections.
- **Typography**: Pretendard Variable as primary, with `-webkit-font-smoothing` always enabled.
