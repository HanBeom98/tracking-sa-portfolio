# AI 리플레이 해설용 근거 요약 v1

현재 단계는 **입력 데이터 준비**다. `analyzeReplay()`가 기존 분석과 함께 `coachingEvidence`를 메모리에 만든다. 생성형 AI 요청, API 키, 추가 네트워크 조회, 저장, 결제 및 사용량 차감은 구현하지 않았다. 화면의 기존 규칙 기반 해설도 유지한다.

## 데이터 계약

구현: `src/domains/stats/sudden-attack/replay/domain/replay-coaching-evidence.js`.

| 필드 | 의미 |
| --- | --- |
| `schemaVersion` | 현재 `1`. 향후 API와 화면이 해석할 계약 버전 |
| `status` | 전부 검증됨 `ready`, 일부 제외 `partial`, 검증 표본 없음 `insufficient_data` |
| `scope` | `selected_player_verified_rounds`: 선택한 선수의 검증된 라운드만 집계 |
| `coverage` | 전체·검증·제외 라운드 수. 미완전 상황 기록, 잘못된 번호, 중복 번호를 구분 |
| `metrics` | **모든 검증 라운드**의 킬·사망·생존·승리·첫 처치/사망·교환킬 후보·혼자 남은 상황. 표본이 없으면 `null` |
| `rounds` | 최대 6개 상세 장면. 번호·공수·결과·생존 시간·상황별 수치만 투영 |
| `detailSelection` | 선택 방식, 실제 포함·생략 수, 교환킬 예시 개수 제한 |
| `rules` | 5초 교환킬 후보 기준, 초 단위 시각, 생존 인원의 본인 포함, 동시 사건 순서 미확정 |
| `limitations` | 제외 표본·장면 선택·시야·의도·사후 처치·단일 경기 해석의 한계 |

`metrics.evidenceId`는 `verified-rounds`, 각 상세 장면은 `round-N`이다. 다음 화면 단계에서 이 근거 ID를 기존 `replayRound-N` 카드와 연결할 수 있다. 아직 AI 응답이나 그 응답의 검증기는 구현하지 않았다.

## 정확성과 크기 제한

- [상황 분석 기준](replay-context-analysis.md)의 `complete` 라운드만 사용한다. 제외된 라운드를 상황 0건으로 바꾸지 않는다. 검증된 무사망·무처치 라운드의 실제 0과 데이터 부족의 `null`을 구분한다.
- 집계는 상세 6개로 다시 계산하지 않는다. 예를 들어 12개 라운드 중 6개만 상세에 포함해도 집계의 분모는 검증된 12개다.
- 상세 장면은 첫 사망, 교환킬 후보 수행/수혜, 다수 상대와 혼자 남은 상황, 다수 처치, 첫 처치에서 서로 다른 라운드를 우선한다. 남은 자리는 사망·처치 기록이 있는 라운드부터 채우고 번호 순으로 정렬한다. 통계적으로 대표성 있는 표본이나 확정된 최고/최악 장면이라는 뜻은 아니다.
- 라운드의 교환킬 예시는 수행/수혜 각각 최대 2건이다. 전체 건수와 생략 건수를 별도 유지한다.
- 사망 이후 처치는 킬 집계에 남기되 `killsAfterDeath`로 구분한다. 동시 시각 처치에는 순서를 부여하지 않는다.
- 공수와 라운드 결과는 라운드별 팀을 따른다. 경기 전체의 고정 팀으로 판정하지 않는다.
- 닉네임·계정/경기 ID·맵/무기 자유 문자열·좌표·원시 타임라인·기존 해설 문구·외부 전력 예측은 포함하지 않는다. 객체를 통째로 복사하지 않고 허용된 수치와 고정 enum만 구성한다.
- 요약에는 검증된 교전·상황 근거를 우선 담는다. 경기 요약의 어시스트·피해량과 검증 라운드 집계를 혼합하지 않는다. 이 항목을 추가하려면 원본 누락 여부와 출처를 구분하는 별도 계약이 필요하다.

파일 크기와 토큰 수·청구 비용은 다르다. 현재는 상세 수를 제한하고 자유 문자열을 제외해 입력 크기를 억제한다. 모델별 토큰 측정·출력 길이 제한·서버 사용량 제한은 실제 연결 단계에서 구현할 항목이다. 향후 유료 API는 클라이언트가 보낸 집계를 신뢰하는 대신 서버에서 계약과 근거를 검증해야 한다.

## 합성 예시

`tests/fixtures/replay-context.js`의 2라운드 예시에서는 다음을 얻는다. 아래는 전체 객체의 일부다.

```json
{
  "schemaVersion": 1,
  "status": "ready",
  "scope": "selected_player_verified_rounds",
  "coverage": { "totalRounds": 2, "verifiedRounds": 2, "excludedRounds": 0 },
  "metrics": {
    "evidenceId": "verified-rounds",
    "rounds": 2,
    "kills": 1,
    "deaths": 2,
    "openingDeaths": 1,
    "tradeCandidatesMade": 1,
    "outnumberedSoloRounds": 1
  }
}
```

해당 예시의 `round-1`에는 1.6초에 0.6초 간격으로 발생한 교환킬 후보와 3초부터 1대2였다는 근거를 담는다. 2라운드가 재접속 때문에 보류되면 `status=partial`, `verifiedRounds=1`이 되며, 그 라운드의 첫 사망을 집계에서 제외한다.

## 검증

신규 단위 테스트는 실제 분석기 연결, 검증/제외 분모, 0과 null, 식별자 및 임의 문자열 제외, 동시 사건, 공수 전환, 사망 후 처치, 장면/교환킬 예시 제한, 참조 번호 충돌, 결정적 출력과 비변경성을 확인한다. 실제 사용자 파일은 저장소에 넣지 않는다.

```sh
node --test tests/unit/replay-coaching-evidence.test.js tests/unit/replay-context.test.js tests/unit/replay-analyzer.test.js
npm run build
npm run test:e2e:ci -- --grep "replay context"
npm run check:source-of-truth
npm run check:source-graph
```

[2단계 모의 해설 화면과 응답 형식](replay-coaching-preview.md)을 구현했다. 실제 AI 연결과 서버 재검증·구독·과금 제어는 후속 단계다.
