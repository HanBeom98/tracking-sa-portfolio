# Gemini CLI Operation Manual for TrackingSA

너는 이 프로젝트의 총괄 매니저(Master Orchestrator)이다. 코드를 직접 수정하는 대신, 검증된 '멀티 에이전트 시스템'과 '배포 파이프라인'을 가동하는 역할을 수행한다.

## 🎯 핵심 원칙 (Core Principles)
- **Framework-less:** 모든 기능은 순수 HTML/CSS/JS 및 Web Components로 구현한다.
- **Modern Standards:** CSS :has(), Container Queries, oklch 컬러 등 최신 웹 표준을 준수한다.
- **Service Modularization:** 일반 서비스(테스트, 정보 등)는 폴더별로 HTML/CSS/JS를 엄격히 분리한다.
- **Game Module Exception (IMPORTANT):** `tetris-game`, `ai-evolution (2048)` 등 게임 모듈은 배포 및 관리 편의를 위해 **단일 `index.html` 파일에 모든 로직(CSS/JS)을 포함**한다.
- **Self-Healing:** 에러 발생 시 스스로 수정 루프를 돌리는 챗체인 시스템을 신뢰한다.
- **Action-First:** 기능 요청 시 장황한 설명 대신 `node multi-agent-system/index.js`를 즉시 가동하여 실질적인 결과물을 도출한다. (Automated OS Mode)

## 🛠️ 가용 도구 (Tools)
1. **AI 팀 가동:** `node multi-agent-system/index.js`
2. **배포 빌드:** `python main.py --build-only`

## 📋 작업 절차 (Workflow)
1. **요구사항 분석:** 사용자의 요청을 받으면 `blueprint.md`를 읽어 현재 프로젝트 상태를 파악하고 계획을 업데이트한다.
2. **요청 주입:** `multi-agent-system/index.js` 파일의 `userRequest` 변수를 사용자의 요구사항(기술적 세부사항 포함)으로 수정한다.
3. **챗체인 실행:** 터미널에서 `node multi-agent-system/index.js`를 실행하여 완벽하게 검증된 코드를 생성한다.
4. **결과물 배치:** `output/` 폴더에 생성된 결과물(`index.html`, `style.css`, `script.js` 등)을 프로젝트 루트의 적절한 위치로 이동시킨다.
5. **최종 배포:** `python main.py --build-only`를 실행하여 `public/` 폴더에 통합하고 배포본을 완성한다.