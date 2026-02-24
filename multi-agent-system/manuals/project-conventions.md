# Tracking SA Project Conventions

## 🏗️ Build-First Architecture (MUST READ)
우리 프로젝트는 단순한 정적 웹사이트가 아니라, **Python 빌드 엔진(`src/shared/infra/builder.py`)**이 Firestore 데이터를 읽어 HTML을 찍어내는 **SSG(Static Site Generation)** 시스템입니다.

### ⚠️ Critical Rules for Agents:
1.  **Source vs. Output**: 
    - `src/`는 **설계도**, `public/`은 **빌드 산출물**입니다.
    - `public/`를 직접 수정하지 말고, 반드시 `src/`를 수정한 뒤 빌드를 실행합니다.
2.  **HTML Generation Logic**:
    - 뉴스 목록, 기사 카드 등 반복되는 UI를 수정할 때는 반드시 `src/shared/infra/builder.py` 내부의 HTML 스트링 생성 로직을 함께 수정해야 합니다. 
    - **파일만 고치고 빌드 엔진을 무시하면 UI는 절대 바뀌지 않습니다.**
3.  **Class Name Sync**:
    - CSS에서 정의한 프리미엄 클래스명(`news-card-premium` 등)은 반드시 빌더의 HTML 렌더링 로직에도 동일하게 반영되어야 합니다.
4.  **Shadow DOM Encapsulation**:
    - 모든 신규 기능은 웹 컴포넌트 표준을 따르며, Shadow DOM 내부에 스타일을 가둡니다.

## 🧠 Agent Execution Guidance (교육용)
### 1) 요청 수신 시 필수 확인
- 작업 대상이 `src/`인지 확인하고, `public/` 직접 수정을 금지한다.
- 기존 스타일/구조를 먼저 읽고, "덮어쓰기"가 아닌 "병합"으로 진행한다.

### 2) 변경 전/후 체크리스트
- 변경 전: 관련 파일 1~2개만 먼저 열어 구조 확인.
- 변경 후: `python main.py --build-only` 실행.
- 산출 확인: `ls -R public/`로 파일 생성/경로 확인.

### 3) 자주 발생하는 실패 유형
- **경로 착각**: `core/` 기준으로 수정.
- **빌드 누락**: `public/`가 갱신되지 않음.
- **i18n 키 노출**: `data-i18n` 키가 그대로 보임.
- **전역 CSS 충돌**: `body`/`main`에 강한 스타일 주입으로 레이아웃 깨짐.

### 4) 안전한 패치 원칙
- 한 번에 하나의 문제만 해결한다.
- 최소 변경으로 원인을 고친다.
- UI 변경은 반드시 페이지별 스크린샷 체크 기준을 남긴다.

## 🎨 Design System
- **Color**: Exclusively use `oklch()` for depth and modern look.
- **Theme**: Premium Blue (#0052cc base) with high-contrast selections.
- **Typography**: Pretendard Variable as primary, with `-webkit-font-smoothing` always enabled.
