# Project Conventions (Mandatory Rules)

## 0. Collaboration Protocol (CRITICAL)
- **No Solo Action**: 마스터 오케스트레이터는 직접 코드를 생산하지 않는다. 모든 생산 활동은 반드시 멀티 에이전트 시스템(`Planner -> Developer -> Reviewer`)을 통해서만 이루어져야 한다.
- **Verification Loop**: 모든 결과물은 반드시 `Reviewer`의 최종 검증을 마친 상태여야 하며, 마스터는 이를 배치하고 배포하는 역할만 수행한다.

## 1. HTML Standard Structure
... (중략) ...

## 2. Web Component Design
- 모든 UI 요소는 `test-button`과 같이 독자적인 커스텀 엘리먼트(`Custom Elements`)로 개발하라.
- **Shadow DOM**을 사용하여 외부 스타일과의 간섭을 차단하라.

## 3. Styling Rules
- **Colors**: `oklch(L C H)` 형식을 최우선으로 사용하라.
- **Layout**: `:has()` 선택자와 **Container Queries**를 사용하여 극강의 반응형 디자인을 구현하라.
- **Depth**: 다중 `box-shadow`를 사용하여 공중에 뜬 듯한 입체감을 연출하라.

## 4. File Management
- 모든 정적 에셋(이미지, 폰트)은 상대 경로를 사용하라.
- **Service Modularization**: 기본적으로 `folder: [name]` 폴더 안에 `index.html`, `style.css`, `script.js`를 각각 분리하여 생성하라.
- **Game Module Exception (CRITICAL)**: `tetris-game` 및 `ai-evolution (2048)`과 같은 게임 모듈은 배포 및 관리 편의성을 위해 **단일 `index.html` 파일 안에서 HTML/CSS/JS를 모두 관장**한다. 절대 임의로 파일을 분리하지 말 것.
