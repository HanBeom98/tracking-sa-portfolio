# 리플레이 화면 상태와 수명주기

`src/domains/stats/sudden-attack/replay/main.js`는 입력·분석·결과 렌더링·재생을 연결한다. 계산 규칙은 기존 domain 모듈에 유지한다. 홈의 `trySample`, `openReplayFiles`, `pauseReplayPlayback`도 같은 진입점을 사용한다.

| 소유 모듈 | 상태와 책임 | 무효화·해제 시점 |
| --- | --- | --- |
| `application/replay-workspace-session.js` | 현재 파일, 분석 결과, 샘플 여부, 파일/샘플 작업 번호. DOM 접근 없음 | 새 파일·초기화·페이지 종료에서 오래된 작업을 무효화. 선수 변경은 분석만 비움. 비교로 이동할 때 완성된 한 경기 결과 유지 |
| `ui/replay-forecast-controller.js` | 선택적 경기 유형/전력 조회, 진행 상태, 해당 파일의 메모리 캐시 | 새 파일·초기화에서 캐시 비움. 결과 갱신은 현재 파일·유형·작업 번호 확인 후 전력 패널만 교체 |
| `ui/replay-output-controller.js` | 이미지 생성 작업, PNG 미리보기, 인쇄/PDF 미리보기 | 파일/선수/결과 변경·초기화·페이지 종료에서 작업 취소와 창 해제. 늦게 끝난 작업이 새 작업 버튼을 복구하거나 창을 다시 열지 못함 |
| `ui/replay-preview-controller.js` | 로컬 모의 해설, 복기 근거와 재생 위치, API 어댑터, 로컬 구매 흐름 | 복기 화면은 결과 변경 때 정리. 요청 번호 기록과 구매 흐름은 같은 페이지에서 유지. 페이지 종료 때 구독/화면/기록 해제 |

파일을 읽으면 기본 분석을 즉시 사용할 수 있고, 전력 조회 완료를 기다리지 않는다. 전력 정보가 없거나 조회에 실패해도 무료 분석·재생은 계속 동작한다. 이전 파일·선수의 비동기 결과는 현재 분석에 붙이지 않는다.

`pagehide`의 `persisted: true`는 브라우저 뒤로 가기 캐시이므로 세션을 폐기하지 않는다. `persisted: false`에서 모든 컨트롤러와 재생을 해제한다. 종료 후 늦게 로딩된 모의 해설·구매 모듈도 화면에 연결하지 않는다.

로컬 기능의 기존 허용 조건은 유지한다. 정상 배포 페이지는 로컬 해설·구매 모듈을 동적 import하지 않는다. 복기 테스트는 정확히 `http://127.0.0.1:4173`의 `coaching=review`, API 어댑터는 `transport=api`, 구매 흐름은 추가로 `purchase=flow`를 요구한다. 이 정리는 실제 판매나 유료 AI 실행을 활성화하지 않는다.

검증은 `tests/unit/replay-workspace-lifecycle.test.js`의 상태·비동기 작업 소유권 검사와 `tests/e2e/replay-fast-start.spec.js`, `replay-lazy-loading.spec.js`, `replay-print-report.spec.js`, `replay-polishing.spec.js`의 실제 브라우저 동작을 함께 사용한다. 재생·비교·로컬 복기/구매 전용 검사도 해당 설정으로 실행한다. 테스트는 고정 fixture와 모의 응답을 사용하며 실제 결제·DB·유료 AI를 요청하지 않는다.
