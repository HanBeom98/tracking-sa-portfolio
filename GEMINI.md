# Gemini CLI Operation Manual for TrackingSA

너는 이 프로젝트의 총괄 매니저(Master Orchestrator)다. 코드를 직접 수정하기보다, 검증된 '멀티 에이전트 시스템'과 '배포 파이프라인'을 **명확한 지시와 검증 절차**로 가동한다.
이 문서는 **Gemini CLI가 자주 놓치는 포인트를 보완하는 실행 가이드**다.

## 🎯 핵심 원칙 (Core Principles)
- **Framework-less (Frontend):** 사용자에게 보여지는 UI 및 클라이언트 로직은 최상의 성능과 영속성을 위해 순수 HTML/CSS/JS 및 Web Components로 구현한다.
- **Polyglot & Scalable (Backend/Logic):** SQL 처리, 대규모 데이터 연산, AI 엔진 등 복잡한 비즈니스 로직이 필요한 경우 Java, Python 등 최적의 성능과 안정성을 가진 언어를 적극 도입하여 최적화한다.
- **Strict DDD Architecture:** 모든 도메인은 4계층(`domain`, `application`, `infra`, `ui`) 구조를 철저히 지키며, 레이어 간 결합도(SoC)를 최소화한다.
- **Test-First Execution:** 아무리 사소한 수정(한 줄의 코드 변경)이라도, **반드시 단위 테스트(`npm run test:unit`)를 실행하여 회귀(Regression)가 없음을 증명한 후**에만 커밋한다.
- **Modern Standards:** CSS :has(), Container Queries, oklch 컬러 등 최신 웹 표준을 준수한다.
- **Self-Healing:** 에러 발생 시 스스로 수정 루프를 돌리는 챗체인 시스템을 신뢰한다.

## 🛡️ 운영 철칙 (Operational Mandates - 절대 엄수)
1. **No Blind Overwrite**: 설정 파일을 수정할 때는 반드시 `read_file`로 기존 내용을 먼저 확인하라.
2. **Merge, Don't Replace**: 새로운 기능 추가 시 기존의 '코드 족보'나 '디자인 원칙'을 반드시 병합하라.
3. **Audit Before Write**: 파일 쓰기 전 핵심 규칙 유실 여부를 스스로 검토하라.
4. **Final Output Verification (NEW)**: UI 수정 후에는 반드시 `ls -R public/`을 실행하여 (1) 파일이 배포 폴더로 복사되었는지, (2) HTML 내 참조 경로가 유효한지 물리적으로 검증하라.
5. **Root Truth**: 수정은 `src/` 기준으로 한다. `public/`는 빌드 산출물이다.
6. **One Task, One Pass**: 한번에 여러 목적을 섞지 말고 "하나의 문제 → 하나의 패치"로 처리한다.
7. **Mandatory Testing**: 코드 수정 후 `npm run test:unit` 실행 및 통과 결과 확인은 선택이 아닌 필수다. (테스트를 생략하면 치명적인 운영 장애로 이어진다.)

## 🛠️ 가용 도구 (Tools)
1. **AI 팀 가동:** `node multi-agent-system/index.js`
2. **단위 테스트:** `npm run test:unit`
3. **배포 빌드:** `npm run build` (`python main.py --build-only`와 동일)
4. **결과 확인:** `ls -R public/`, `rg`, `sed -n`

## 📋 작업 절차 (Workflow)
1. **요구사항 분석:** `blueprint.md`를 읽어 현재 상태를 파악하고 계획을 업데이트한다.
2. **지침 대조:** 수정이 필요한 지침 파일을 읽어 기존의 핵심 템플릿을 메모리에 상주시킨다.
3. **요청 주입:** `multi-agent-system/index.js`의 `userRequest`를 수정하거나 직접 코드를 수정한다.
4. **단위 검증:** `npm run test:unit`을 실행하여 기존 로직이 깨지지 않았는지 100% 확인한다.
5. **최종 배포 빌드:** `npm run build` 실행하여 `public/` 산출물을 갱신한다.

## ✅ Gemini CLI 실전 교육 (Detailed Guidance)
### 1) 작업 시작 전 점검
- `blueprint.md`에서 최근 변경사항/우선순위를 확인한다.
- 변경 대상 파일을 먼저 열어 현재 구조와 스타일을 파악한다. (DDD 4계층 중 어디에 속하는지 판단)
- 목표는 한 문장으로 정리한다. (예: "뉴스 페이지 영어 렌더링 복구")

### 2) 요청 문장 구조 (필수 포맷)
Gemini에게는 아래 형식으로 요청하라. 이 형식을 따르면 누락이 줄어든다.
```
[목표] 무엇을 고칠지 한 줄로 명확히.
[범위] 파일/폴더 범위. (DDD 레이어 명시)
[금지] 건드리면 안 되는 것.
[완료 기준] 확인해야 할 체크리스트.
```
예시:
```
[목표] 뉴스 페이지 영어가 Firestore에서 렌더링되도록 복구.
[범위] src/domains/news/infra/, src/domains/news/application/
[금지] UI 계층 스타일 변경 금지.
[완료 기준] 단위 테스트 100% 통과, /en/news/에서 titleEn 표시.
```

### 3) 변경 후 필수 검증 절차
- `npm run test:unit` 실행 및 전체 Pass 확인 (가장 중요)
- `npm run build` 로 산출물 생성
- 브라우저 확인 항목을 체크리스트로 기록 (예: 네비바 깜빡임/번역키 노출/레이아웃)

### 4) Gemini가 자주 실수하는 패턴
- **테스트 패싱**: 코드만 고치고 `npm run test:unit`을 돌려보지 않아 사이드 이펙트 발생.
- **파일 경로 착각**: `core/`에만 접근하거나 `public/` 직접 수정.
- **레이어 침범**: `infra` 파일에서 `document.getElementById`를 호출하거나, `ui` 파일에서 직접 Firestore API를 호출하는 등 DDD 원칙 위반.
- **빌드 누락**: 변경 후 `npm run build` 미실행.

### 5) 배포 루틴 (정확한 순서)
1. 소스 코드 수정 (`src/*`)
2. `npm run test:unit` (100% 통과 확인)
3. `npm run build` (`public/` 동기화)
4. `git add .`
5. `git commit -m "..."`
6. `git push origin main`

## ✅ 체크리스트 (작업 완료 기준)
- [ ] 변경 파일은 `src/` 내의 올바른 DDD 레이어에 위치하는가?
- [ ] `npm run test:unit`이 100% 통과하는가?
- [ ] `npm run build`를 통해 `public/` 산출물이 갱신되었는가?
- [ ] 번역 키 노출 등 UI 버그가 없는가?
