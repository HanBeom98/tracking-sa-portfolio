# 문제 해결 사례

## 캐시와 비동기 요청

**문제:** 반복 조회를 줄여도 캐시가 남거나 이전 요청이 늦게 끝나면 최신 결과가 다시 덮일 수 있습니다.

**처리:** 메모리·저장소 캐시의 무효화 경로를 연결하고 동일 요청은 진행 중 결과를 공유합니다. 실패 응답은 정상 캐시로 저장하지 않으며 결과를 반영할 때 현재 요청인지 확인합니다.

**구현·검증:** [프로필 조회](../src/domains/stats/sudden-attack/application/profile-query-service.js), [조회 테스트](../tests/unit/profile-query-service.test.js), [API 테스트](../tests/unit/nexon-api-client.test.js).

[개발일지의 150→5](https://blog.naver.com/hantiger24/224468800253)는 정해진 모의 조건에서 센 목록 요청 횟수이며 운영 속도나 요금의 개선율이 아닙니다.

## 기록 없음과 실제 0의 구분

**문제:** 이전 구간이 없을 때 최근 값을 복사하거나 조회 실패를 0으로 처리하면 비교 지표가 오해를 만듭니다.

**처리:** 빈 목록·일부 실패·전체 실패를 구분하고 검증되지 않은 경기 기록은 확정 통계에 섞지 않습니다. 실제 경기 수와 값의 출처를 표시합니다.

**구현·검증:** [경기 조회 규칙](../src/domains/stats/sudden-attack/domain/match-query.js), [비교 계산 테스트](../tests/unit/replay-comparison.test.js), [발견 계기와 화면 검증 기록](https://blog.naver.com/hantiger24/224481064331).

## 리플레이 파일 교체와 상태 관리

**문제:** A 파일 조회 중 B 파일로 바꾸거나 출력을 연속 요청하면 이전 작업이 현재 화면에 뒤늦게 반영될 수 있습니다.

**처리:** 파일·분석 세션, 추가 조회, 출력의 책임을 나누고 현재 세션·작업 번호를 검사합니다. 기본 분석은 선택적 전력 조회 완료를 기다리지 않습니다. 종료와 뒤로 가기 복원도 구분합니다.

**구현·검증:** [비교 세션](../src/domains/stats/sudden-attack/replay/application/replay-comparison-session.js), [단위 테스트](../tests/unit/), [로컬 브라우저 테스트](../tests/e2e/local-smoke.spec.js). 구현한 예외 처리와 실제 이용자가 겪은 장애를 같은 것으로 설명하지 않습니다.

## 같은 선수의 여러 경기 비교

선수 ID와 검증된 기록을 기준으로 범위를 제한하고 기준·이후 경기의 라운드 가중 지표를 집계합니다. [비교 계산](../src/domains/stats/sudden-attack/replay/domain/replay-comparison.js), [상황 계산](../src/domains/stats/sudden-attack/replay/domain/replay-context.js), [비교 테스트](../tests/unit/replay-comparison.test.js), [상황 테스트](../tests/unit/replay-context.test.js)를 연결해 확인할 수 있습니다.

## 검증과 배포

원본과 산출물 경로를 명세로 관리하고 검증에 통과한 커밋을 배포 대상으로 삼습니다. 이전 CI가 늦게 끝나 최신 배포를 되돌리는 상황도 방지합니다. 공개판에서는 운영 배포가 실행되지 않습니다.

**검증:** [워크플로 검사](../tests/unit/site-deploy-workflow.test.js), [산출물 검사](../scripts/check-build-artifacts.js), [원본 일치 검사](../scripts/check-source-of-truth.js). 이번 실행 결과는 [공개판 검증 기록](portfolio-verification.md)에 남깁니다.
