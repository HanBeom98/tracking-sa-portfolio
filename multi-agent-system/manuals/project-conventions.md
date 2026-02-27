# Tracking SA Project Conventions

## 🏗️ Build-First Architecture & DDD (MUST READ)
우리 프로젝트는 단순한 정적 웹사이트가 아니라, **Python 빌드 엔진(`src/shared/infra/builder.py`)**이 Firestore 데이터를 읽어 HTML을 찍어내는 **SSG(Static Site Generation)** 시스템이며, 모든 기능은 **엄격한 4계층 DDD(Domain-Driven Design)** 구조로 관리됩니다.

### ⚠️ Critical Rules for Agents:
1.  **Test-First Mandate**:
    - 아무리 작은 코드 수정이라도, 배포 전 **반드시 `npm run test:unit`을 실행하여 100% 통과를 확인**해야 합니다. 테스트를 생략한 코드는 무효 처리됩니다.
2.  **Strict DDD Layers**:
    - 모든 코드는 `src/domains/{domain_name}/` 아래에 위치하며, `domain`(핵심 규칙), `application`(비즈니스/유스케이스), `infra`(데이터/API 접근), `ui`(렌더링/이벤트)의 4계층을 철저히 분리해야 합니다. 레이어 간 침범(예: infra에서 UI 조작)은 엄금합니다.
3.  **Source vs. Output**: 
    - `src/`는 **설계도**, `public/`은 **빌드 산출물**입니다.
    - `public/`를 직접 수정하지 말고, 반드시 `src/`를 수정한 뒤 빌드를 실행합니다.
4.  **HTML Generation Logic**:
    - 빌드 시점에 생성되는 UI를 수정할 때는 반드시 `src/shared/infra/builder.py`나 각 도메인의 `infra/` 렌더링 로직을 함께 수정해야 합니다. 
5.  **Shadow DOM Encapsulation**:
    - 모든 신규 기능은 웹 컴포넌트 표준을 따르며, Shadow DOM 내부에 스타일을 가둡니다.

## 🧠 Agent Execution Guidance (교육용)
### 1) 요청 수신 시 필수 확인
- 작업 대상이 `src/`의 올바른 DDD 레이어인지 확인하고, `public/` 직접 수정을 금지한다.
- 기존 스타일/구조를 먼저 읽고, "덮어쓰기"가 아닌 "병합"으로 진행한다.

### 2) 변경 전/후 체크리스트
- 변경 전: 관련 파일 1~2개만 먼저 열어 계층 구조 확인.
- 변경 후: **`npm run test:unit` 실행 및 전체 통과 확인 (필수!)**.
- 산출 갱신: `npm run build`(`python main.py --build-only`) 실행.
- 산출 확인: `ls -R public/`로 파일 생성/경로 확인.

### 3) 자주 발생하는 실패 유형
- **테스트 패싱**: 코드를 고치고 단위 테스트를 확인하지 않아 기존 시스템 붕괴.
- **경로/계층 착각**: `core/` 기준으로 수정하거나, UI 계층에서 API 직접 호출.
- **빌드 누락**: `public/`가 갱신되지 않음.
- **i18n 키 노출**: `data-i18n` 키가 그대로 보임.

### 4) 안전한 패치 원칙
- 한 번에 하나의 문제만 해결한다.
- 최소 변경으로 원인을 고치되, 반드시 단위 테스트를 수반한다.
- UI 변경은 반드시 페이지별 스크린샷 체크 기준을 남긴다.

## 🎨 Design System
- **Color**: Exclusively use `oklch()` for depth and modern look.
- **Theme**: Premium Blue (#0052cc base) with high-contrast selections.
- **Typography**: Pretendard Variable as primary, with `-webkit-font-smoothing` always enabled.
