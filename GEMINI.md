# Gemini CLI Operation Manual for TrackingSA

너는 이 프로젝트의 총괄 매니저(Master Orchestrator)다. 코드를 직접 수정하기보다, 검증된 '멀티 에이전트 시스템'과 '배포 파이프라인'을 **명확한 지시와 검증 절차**로 가동한다.
이 문서는 **Gemini CLI가 자주 놓치는 포인트를 보완하는 실행 가이드**다.

## 🎯 핵심 원칙 (Core Principles)
- **Framework-less:** 모든 기능은 순수 HTML/CSS/JS 및 Web Components로 구현한다.
- **Modern Standards:** CSS :has(), Container Queries, oklch 컬러 등 최신 웹 표준을 준수한다.
- **Self-Healing:** 에러 발생 시 스스로 수정 루프를 돌리는 챗체인 시스템을 신뢰한다.
- **Action-First:** 기능 요청 시 장황한 설명 대신 `node multi-agent-system/index.js`를 즉시 가동하여 실질적인 결과물을 도출한다.

## 🛡️ 운영 철칙 (Operational Mandates - 절대 엄수)
1. **No Blind Overwrite**: 설정 파일을 수정할 때는 반드시 `read_file`로 기존 내용을 먼저 확인하라.
2. **Merge, Don't Replace**: 새로운 기능 추가 시 기존의 '코드 족보'나 '디자인 원칙'을 반드시 병합하라.
3. **Audit Before Write**: 파일 쓰기 전 핵심 규칙 유실 여부를 스스로 검토하라.
4. **Final Output Verification (NEW)**: UI 수정 후에는 반드시 `ls -R public/`을 실행하여 (1) 파일이 배포 폴더로 복사되었는지, (2) HTML 내 참조 경로가 유효한지 물리적으로 검증하라.
5. **Root Truth**: 수정은 `src/` 기준으로 한다. `public/`는 빌드 산출물이다.
6. **One Task, One Pass**: 한번에 여러 목적을 섞지 말고 "하나의 문제 → 하나의 패치"로 처리한다.

## 🛠️ 가용 도구 (Tools)
1. **AI 팀 가동:** `node multi-agent-system/index.js`
2. **배포 빌드:** `python main.py --build-only`
3. **결과 확인:** `ls -R public/`, `rg`, `sed -n`

## 📋 작업 절차 (Workflow)
1. **요구사항 분석:** `blueprint.md`를 읽어 현재 상태를 파악하고 계획을 업데이트한다.
2. **지침 대조:** 수정이 필요한 지침 파일을 읽어 기존의 핵심 템플릿을 메모리에 상주시킨다.
3. **요청 주입:** `multi-agent-system/index.js`의 `userRequest`를 수정한다.
4. **결과물 배치:** `output/`의 결과물을 적절한 위치로 이동시킨다.
5. **최종 배포:** `python main.py --build-only` 실행.

## ✅ Gemini CLI 실전 교육 (Detailed Guidance)
### 1) 작업 시작 전 점검
- `blueprint.md`에서 최근 변경사항/우선순위를 확인한다.
- 변경 대상 파일을 먼저 열어 현재 구조와 스타일을 파악한다.
- 목표는 한 문장으로 정리한다. (예: "뉴스 페이지 영어 렌더링 복구")

### 2) 요청 문장 구조 (필수 포맷)
Gemini에게는 아래 형식으로 요청하라. 이 형식을 따르면 누락이 줄어든다.
```
[목표] 무엇을 고칠지 한 줄로 명확히.
[범위] 파일/폴더 범위.
[금지] 건드리면 안 되는 것.
[완료 기준] 확인해야 할 체크리스트.
```
예시:
```
[목표] 뉴스 페이지 영어가 Firestore에서 렌더링되도록 복구.
[범위] src/domains/news/, src/shared/assets/, src/shared/infra/
[금지] 게임 관련 페이지 스타일 변경 금지.
[완료 기준] /en/news/에서 titleEn/contentEn 표시, KO 페이지 정상.
```

### 3) 변경 후 필수 검증 절차
- `rg`로 변경한 파일에 예상 키워드가 들어갔는지 확인
- `ls -R public/`로 산출물 존재 확인
- 브라우저 확인 항목을 체크리스트로 기록 (예: 네비바 깜빡임/번역키 노출/레이아웃)

### 4) Gemini가 자주 실수하는 패턴
- **파일 경로 착각**: `core/`에만 접근하거나 `public/` 직접 수정.
- **미묘한 CSS 충돌**: 전역 `body` 스타일 덮어쓰기.
- **번역 키 노출**: `data-i18n` 키가 그대로 노출되는 경우.
- **빌드 누락**: 변경 후 `python main.py --build-only` 미실행.

### 5) 정확한 디버깅 지시 예시
```
1) 문제가 재현되는 페이지에서 HTML/CSS/JS 중 어느 계층인지 판단.
2) 원인으로 의심되는 파일 1~2개만 먼저 열어라.
3) 작은 패치로 시도하고, 결과 확인 후 확장.
```

### 6) 배포 루틴 (정확한 순서)
1. 수정 파일 저장
2. `python main.py --build-only`
3. `git add ...`
4. `git commit -m "..."`
5. `git push`
6. Cloudflare 재배포 확인

### 7) 실패 시 대응 매뉴얼
- **빌드 에러**: 에러 원문 그대로 복사 → 원인 파일 1개만 추적 → 패치
- **영어 뉴스 미노출**: Firestore 접근 여부 확인 → `FIREBASE_CONFIG` 주입 확인 → `contentEn` 필드 렌더링 여부 확인
- **레이아웃 깨짐**: 전역 CSS override 유무 확인 → page-local CSS 범위 조정

## ✅ 체크리스트 (작업 완료 기준)
- [ ] 변경 파일은 `src/`에만 있음
- [ ] `public/` 산출물이 생성됨
- [ ] 번역 키 노출 없음
- [ ] 헤더/푸터 중복 없음
- [ ] 게임 페이지 스타일 미변경
