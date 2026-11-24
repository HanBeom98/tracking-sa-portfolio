# 공개 전적 검색의 제품 측정 명세 v1

작성일: 2026-10-22. 갱신일: 2026-10-23. 성장 체크리스트 1번의 설계 산출물이다. **정의·2번 공통 전송 기반·3번 공개 검색·4번 즐겨찾기/VS/공유 연결·5번 통제된 GA 수신 확인 완료** 상태다. [운영 점검 기록](product-measurement-verification.md)에 이벤트 9종 수신과 이미지 첫 시도 미종료·재시도 성공 등 한계를 남겼다. 6번은 [맞춤 정의·탐색 설정](product-measurement-reports.md)을 저장했고 처리된 일반 이용 표본 확보 전이므로 진행 중이다. 2026-10-23 사용자가 추가 과금 없는 운영을 필수 조건으로 지정해 [무료 운영 원칙](free-operation-policy.md)을 적용했다. BigQuery 연결안은 철회했으며 p50/p95·순서 있는 세션 비율은 현재 범위에서 미산출로 남기고 완료 필수 조건에서 제외한다. 구현된 API와 설정 범위는 [전송 기반 가이드](product-analytics-runtime.md)를 참고한다.

## 목적과 범위

모바일 전적 검색에서 결과를 확인할 수 있었는지, 얼마나 기다렸는지, 이후 즐겨찾기·VS·공유를 사용했는지를 판단한다. 기능 수정 전후에 같은 정의로 비교할 수 있게 한다.

v1 대상은 `/stats/sudden-attack/`의 공개 검색과 해당 결과의 즐겨찾기·VS·공유다. 리그 정산, 리플레이 파일 분석, 사이트 내부 문서 검색, 로그인, 개별 API 호출은 이 검색 지표에 합산하지 않는다. 기존 `recordOperation()`의 콘솔 진단과 GA 제품 이벤트는 목적과 집계 단위가 다르다.

게임의 위장 닉네임·OUID·이전 이름 정책, 정상적인 0승 0패, MMR/HSR 계산, 기존 영문 제목·키워드는 변경하지 않는다.

## 1. 집계 단위와 진입점

**검색 시도**는 빈 값 검증을 통과하고 `handleSearch()`가 새 화면 요청을 시작하는 한 번이다. 같은 닉네임도 사용자가 다시 실행하면 새 시도다. 버튼 더블클릭 등으로 실제 핸들러가 두 번 수락되면 두 시도이며, 한쪽이 대체되었다는 결과를 남긴다. 이벤트 전송을 줄이려고 서로 다른 실제 시도를 임의로 합치지 않는다.

| `entry_point` | 의미 | 현재 연결 위치 |
| --- | --- | --- |
| `input_button` | 검색 버튼으로 수락한 검색 | `home-main.js` 검색 버튼 리스너 |
| `input_enter` | 입력창 Enter로 수락한 검색 | 같은 파일 keypress 리스너 |
| `recent` | 최근 검색 칩 | `renderSearchCollections()` → `renderRecentSearches()` |
| `favorite` | 즐겨찾기 검색 칩 | 같은 함수 → `renderFavoriteSearches()` |
| `direct_link` | 초기 URL의 `n`으로 시작 | `public-search-history.js` 초기 실행 |
| `history` | 뒤로/앞으로 가기로 실행 | 같은 파일 popstate |
| `in_page` | 페이지 내부의 `sa-request-search` | 같은 파일 커스텀 이벤트 |
| `refresh` | 최신 데이터 강제 갱신 | `handleRefresh()` |

빈 입력, 실행 조건 미충족, 비활성 버튼 클릭은 검색 시도로 세지 않는다. VS 대상 조회는 `sa_vs_*`로만 집계한다. 경기 탭 변경·더보기·날짜별 활동 조회·최근/이전 구간 전환·SWR 콜백은 새 검색 시도가 아니다.

검색/VS/공유 작업마다 **페이지 메모리 안에서만** 작업 문맥을 만든다. 문맥은 중복 방지·첫 표시·종료·대체 처리를 위한 것이며 닉네임/OUID로 만들지 않는다. 작업 ID를 GA에 보내거나 저장소·URL에 기록하지 않는다.

## 2. 이벤트 목록

자동 수집 또는 기존 권장 이벤트만으로 캐시/SWR/화면 대체와 기능 완료 의미를 구분하기 어려워 `sa_` 접두사의 사용자 정의 이벤트를 사용한다. 기본 GA `page_view`, `form_submit`, `click`을 검색 성공 이벤트로 재해석하지 않는다.

| 이벤트 | 발생 시점 | 횟수·판단 기준 |
| --- | --- | --- |
| `sa_search_start` | 유효한 공개 검색 시도를 수락할 때 | 시도당 1회 |
| `sa_search_first_result` | 현재 시도의 유효한 결과 DOM을 반영하고 브라우저가 그릴 기회를 얻었을 때 | 시도당 최대 1회. 캐시→최신 갱신으로 재발생하지 않음 |
| `sa_search_finish` | 검색이 성공·부분 성공·실패·대체·취소로 종료될 때 | 시도당 최대 1회. 오래된 응답이 뒤늦게 끝나도 재발생하지 않음 |
| `sa_summary_view` | 현재 검색의 핵심 통계 제목/요약 기준 요소가 뷰포트에 50% 이상, 보이는 탭에서 연속 1초 노출 | 시도당 최대 1회. 긴 통계 패널 전체를 기준으로 삼지 않음 |
| `sa_favorite_change` | 추가/해제 후 현재 페이지의 목록·버튼 상태 반영을 확인했을 때 | 실제 상태 변경당 1회. 현재 페이지 사용 가능과 영구 저장 성공은 구분 |
| `sa_vs_start` | 유효한 대상과 기준 프로필로 비교를 시작할 때 | 비교 작업당 1회 |
| `sa_vs_finish` | 비교 결과 반영 또는 오류·대체·취소로 종료할 때 | 비교 작업당 최대 1회 |
| `sa_share_start` | 결과 링크 복사 또는 카드 공유 요청을 수락할 때 | 공유 작업당 1회 |
| `sa_share_finish` | 공유 API/클립보드 결과, 취소, 오류 또는 다운로드 요청을 확인할 때 | 공유 작업당 최대 1회. PNG 대체 경로를 새 공유 시도로 세지 않음 |

`first_result`는 렌더링 완료의 근사 지점이며 사용자가 내용을 읽었다는 뜻은 아니다. 숨겨진 탭은 표시 기록을 보류하고, 탭이 보일 때도 해당 시도가 현재인지 재검사한다. 수치·표본이 0인 유효한 결과도 결과다. 로딩·오류 안내만 표시한 것은 결과가 아니다. 사용자 화면 밖에 있는 통계의 실제 접근은 별도 `sa_summary_view`로 본다.

`summary_view`는 7~9번 화면 점검/개선에서 사용할 추가 관찰점이다. 3번 검색 측정에서 연결하되 현재·개선 후 모두 같은 의미의 요약 요소를 기준으로 유지한다. 보이지 않거나 1초를 채우지 않으면 보내지 않는다. 탭 숨김·시도 교체·초기화 시 노출 타이머를 초기화한다.

## 3. 검색 결과·캐시·화면 순서

공통 종료 값은 `outcome=success|partial|failure|superseded|cancelled`다. `result_shown=0|1`은 첫 결과 표시 여부다. 검색의 `result_source`는 `network|fresh_cache|stale_cache|none`이며 finish에서는 마지막으로 표시한 결과의 출처를 의미한다. `fresh_cache`는 앱 TTL 이내라는 뜻이고 실제 서버를 방금 조회했다는 뜻이 아니다.

`revalidation=not_needed|success|failure|interrupted`로 **오래된 캐시의 백그라운드 갱신** 결과를 따로 기록한다. 강제 새로고침의 foreground 네트워크 실패는 revalidation 실패로 세지 않는다.

| 시나리오 | 첫 결과 | 종료 |
| --- | --- | --- |
| 캐시 없음 → 네트워크 성공 | `network` 1회 | success / result_shown=1 / network / not_needed |
| TTL 이내 캐시 | `fresh_cache` 1회 | success / 1 / fresh_cache / not_needed |
| 오래된 캐시 → 최신 갱신 성공 | 처음 표시한 캐시 1회 | success / 1 / network / success |
| 오래된 캐시 → 최신 갱신 실패 | `stale_cache` 1회 | partial / 1 / stale_cache / failure. 오류 종류는 갱신 오류 |
| 캐시를 그리기 전에 최신 콜백 도착 | 실제 처음 그린 최신 데이터만 1회 | success / 1 / network / success |
| 결과 없음 → not-found·timeout 등 | 없음 | failure / 0 / none / not_needed |
| A 진행 중 B 검색 또는 VS 시작 | A는 실제 표시 여부만 보존 | A superseded 1회. A의 이후 응답·오류·finally는 무시 |
| 초기화·기본 화면으로 뒤로 가기 | 실제 표시 여부 보존 | 아직 종료하지 않은 작업만 cancelled 1회 |
| 종료 후 같은 결과 재렌더·구간 전환 | 추가 없음 | 추가 없음 |

SWR 콜백의 완료와 첫 화면 반영 순서는 고정되어 있지 않다. 첫 결과 이벤트가 pending 상태여도 완료 정보를 보관하고, 첫 표시/종료 이벤트가 올바른 순서로 한 번씩 기록되게 한다. 첫 표시를 기다리던 결과가 새 시도로 대체되면 해당 결과는 표시 성공으로 보내지 않는다. 현재 코드의 `isStale=false`만으로 fresh_cache와 network를 구분할 수 없으므로 구현 시 조회 경로의 명시적 출처 메타데이터를 연결한다. `cacheTime` 추정이나 `forceRefresh` 하나로 출처를 판정하지 않는다.

페이지 이탈 시 전송은 보장되지 않는다. pagehide에는 미종료 작업의 cancelled 기록을 best effort로 시도하고, BFCache 복귀에서 같은 작업을 재종료하지 않는다. 네트워크 요청 자체를 측정 때문에 취소하지 않는다. `start`만 남은 작업은 미완료/관측 누락으로 표시하며 실패로 채우지 않는다.

## 4. 즐겨찾기·VS·공유의 완료 의미

### 즐겨찾기

`action=add|remove`, `action_source=result_button|favorite_chip`을 보낸다. 현재 `ui-helpers.js`는 저장 실패 시 메모리 목록으로 동작하고 쓰기 결과를 호출자에게 공개하지 않는다. v1의 완료는 현재 페이지의 상태 반영이고 `persistence=unknown`이다. 영구 저장 성공으로 보고하지 않는다. 구현에서 명시적 저장 결과를 전달할 수 있게 된 경우에만 `persisted|page_only`를 사용한다. 단순 read-back만으로 영구 지속성을 보장하지 않는다.

### VS

`vs_source=modal|favorite_chip`을 구분한다. 빈 입력·기준 없음·문자열상 자기 자신은 시작 전 검증에서 제외한다. 조회 후 동일 OUID가 발견되면 이미 시작한 비교를 failure / `error_code=same_player`로 종료한다. 성공은 현재 요청의 `renderVs()` 결과가 화면에 반영된 경우다. 조회 성공 후 다른 검색이 시작되어 화면에 반영되지 않았다면 superseded다. 모달 열기·닫기는 비교 시작/완료가 아니다.

VS 대상 프로필이 stale cache여도 현재는 `onUpdate=null`로 조회하므로 비교 최신 갱신을 사용자에게 반영하지 않는다. 비교 종료에는 `result_source`를 남기고 캐시 기반 비교를 실시간 새 조회로 표현하지 않는다. v1 측정을 위해 VS 동작 자체를 변경하지 않는다.

### 공유

| 실제 도달한 경로 | finish의 method / outcome | 해석 |
| --- | --- | --- |
| `navigator.share()` resolve | native / success | 기기 공유 API 완료. 실제 수신·열람은 확인 불가 |
| `navigator.share()` AbortError | native / cancelled | 사용자 취소. 서비스 오류로 집계하지 않음 |
| `clipboard.write()` resolve | clipboard_image / success | 이미지 복사 완료. 실제 채팅 전송은 확인 불가 |
| `clipboard.writeText()` resolve | clipboard_link / success | 링크 복사 완료 |
| 이미지 복사 실패 후 PNG anchor click | png_download / download_requested | 다운로드 요청만 확인. 디스크 저장 완료·공유 성공으로 집계하지 않음 |
| 복사 실패 후 대체 경로도 실패 | 실제 마지막 경로 / failure | 사용자에게 실패가 안내된 작업 |

start의 `share_source=image_button|link_button`은 고정 진입점이다. 처음부터 최종 경로를 알 수 없으므로 start에서 method를 추측하지 않는다. 하나의 작업이 clipboard 실패 후 PNG로 넘어가면 finish는 download_requested 한 번이다. 사진 선택·확대·드래그·카드 뒤집기는 공유 성공이 아니다. v1은 링크 복사와 이미지 복사의 중복 실행 정책을 측정 목적으로 바꾸지 않는다.

## 5. 허용 필드와 전송 문맥

| 필드 | 허용 값/형식 | 적용 |
| --- | --- | --- |
| `measurement_version` | `v1` | 전체 |
| `traffic_scope` | `production` / `verification` | 전체. 일반 이용과 통제된 점검 구분 |
| `entry_point` | 1절의 고정 enum | 검색 이벤트·해당 결과 노출 |
| `outcome` | 이벤트별 고정 enum | 종료 이벤트 |
| `result_shown` | 0 또는 1 | 검색 finish |
| `result_source` | network/fresh_cache/stale_cache/none | 첫 결과·검색 finish·VS finish |
| `revalidation` | not_needed/success/failure/interrupted | 검색 finish |
| `duration_ms` | 0 이상 유한 정수 | 첫 결과·종료. 단조 시계 `performance.now()` 기준 |
| `error_code` | timeout/network/invalid_response/http/rate_limited/not_found/permission/same_player/unknown | 실패 또는 partial일 때만. 원본 오류 문자열 제외 |
| `action`, `action_source`, `persistence` | 4절 고정 enum | 즐겨찾기 |
| `vs_source` | modal/favorite_chip | VS |
| `share_source`, `method` | 4절 고정 enum | 공유 |

위 필드는 이벤트별 허용 목록으로 제한한다. 임의 객체 spread, 사용자가 입력한 문자열, 원본 오류 message/stack, 닉네임·OUID·이메일·인증/진단 요청 ID, 사용자 ID, 파일 이름·이미지 내용, 실제 검색어, 결과 링크를 전송하지 않는다. 작업 문맥은 로컬 전용이다. 기기·브라우저는 GA 기본 차원으로 분석하고 직접 fingerprint를 만들지 않는다.

`traffic_scope=verification`은 운영자 계정명이나 이메일로 판별하지 않는다. 테스트 하네스/명시적 점검 모드로 설정하고, 일반 실행은 production으로 기록한다. 운영자 평상시 이용을 완벽히 제외한다고 주장하지 않는다. 점검 모드 저장·진입 방식은 2번 구현에서 문서화하고 테스트한다.

### URL·자동 수집 경로 확인

현재 검색은 URL에 `n`을 넣으며 GA는 기본적으로 페이지 URL/제목을 수집할 수 있다. **커스텀 매개변수에서 이름을 빼는 것만으로 전송 문맥이 정리되지는 않는다.** 2번 구현에서 GA의 최초 config와 history 기반 page_view, 후속 이벤트의 `page_location`/`page_referrer`/제목과 향상된 검색·폼 측정 설정을 함께 확인한다.

이 공개 전적 페이지의 최초 config와 제품 이벤트 URL은 `https://trackingsa.com/stats/sudden-attack/`로 정규화하고 `n`·hash와 사용자 입력을 포함한 참조 쿼리를 보내지 않는다. 제목은 정적 서비스 제목을 쓴다. 향상된 자동 수집에는 GA 스트림의 `n` 값 가리기를 추가했다. 자동 수집 URL에는 `n=(redacted)`처럼 키와 가린 값이 남을 수 있으며 이를 제품 이벤트의 정규 URL과 구분한다. 다른 페이지의 config와 기존 향상된 측정/방문 기록 설정은 유지한다. 검색 시도마다 수동 page_view를 추가하지 않는다. 변경 전후 page_view 정책을 기록한다.

이는 이번 GA 측정의 구현 조건이다. 스트림 설정과 수정 미리보기는 확인했지만 기존 실제 GA 전송값 전체나 Microsoft Clarity/NEXON 수집값을 정밀 감사했다는 의미는 아니다. 기존 분석/동의 설정을 우회하거나 새로운 식별자를 도입하지 않는다.

## 6. 보고 지표와 분모

전송은 best effort이며 광고 차단·오프라인·이탈에 따른 누락이 있다. 이벤트 건수를 전체 이용자의 절대값으로 표현하지 않는다. 항상 기간·기기·measurement_version·traffic_scope·표본 수를 함께 표시한다. 임의의 목표 개선율은 아직 정하지 않는다.

| 지표 | v1 정의 | 주의 |
| --- | --- | --- |
| 수락 검색 수 | production `sa_search_start` 건수 | API 호출 수/페이지 조회 수가 아님 |
| 종료 관측 비율 | finish 건수 / start 건수 | 경계 기간·이탈·전송 누락으로 차이. 음수 보정이나 100% 강제 절삭하지 않음 |
| 종료 관측 검색의 결과 표시율 | finish 중 result_shown=1 / finish 전체 | 대체·취소도 분모 포함. 전체 시작 시도의 성공률과 구분 |
| 완료 검색의 성공/부분/실패 구성 | success·partial·failure 각각 / 이 세 outcome 합계 | 대체·취소 별도 건수. 캐시 부분 성공을 완전 실패에 섞지 않음 |
| SWR 갱신 성공률 | revalidation=success / success+failure | interrupted 별도 표시. TTL 내 캐시와 강제 새로고침은 분모 제외 |
| 첫 결과 표시 시간 | first_result의 경과 시간 합계·이벤트 수. 유효 duration 표본 수를 확인할 수 있을 때만 평균 | 캐시/네트워크, 모바일/데스크톱 분리. p50/p95는 미산출·현재 범위 제외. 실패/미표시는 별도 보고 |
| 핵심 요약 노출 빈도 | summary_view 건수와 first_result 건수 나란히 표시 | 기간 경계 누락 고려. 실제 이해 여부는 사용자 피드백 필요 |
| 즐겨찾기·VS·공유 후속 사용 | 동작·출처·결과별 관측 이벤트 수 | 반복 사용 포함. 순서 있는 세션 비율은 미산출·현재 범위 제외. 검색 시도별 전환으로 표현하지 않음 |
| 공유 완료 구성 | method별 success/cancelled/failure/download_requested 건수 | 다운로드 요청을 공유 성공에 포함하지 않음 |

후속 행동의 원시 건수/검색 결과 건수는 반복 사용 때문에 100%를 넘을 수 있으므로 고유 전환율로 부르지 않는다. 작업 ID를 수집하지 않는 v1에서는 여러 검색이 있는 세션의 행동을 개별 검색에 정확히 귀속할 수 없다. 순서 있는 세션 분석은 현재 무료 측정 범위에서 미산출로 남긴다. 후속 행동 건수로 대체해 전환율이라고 표시하지 않는다.

같은 시점에 여러 기능을 바꾸면 단순 전후 차이만으로 원인을 확정할 수 없다. 캐시 효과, 유입 변화, 표본 수를 함께 기록한다. 과거에 없던 이벤트는 ‘미측정’으로 두며 0으로 채우지 않는다. 2026-10-21까지의 과거 GA는 10월 22일 변경 효과를 증명하지 않는다.

## 7. 구현 위치와 후속 검증

| 구현 위치 | 연결할 내용 | 성장 항목 |
| --- | --- | --- |
| `src/shared/assets/analytics-loader.js`와 새 공통 모듈 | 지연 로딩·허용 필드·문맥 정규화·점검 구분·중복 없는 flush | 2 |
| `home-main.js`, `public-search-history.js` | 진입점·검색 작업 수명·대체/초기화·VS 두 경로 | 3, 4 |
| `application/profile-query-service.js` | 명시적인 cache/network 출처·SWR 단계 전달. 기존 계약 보존 | 3 |
| `ui/runtime/public-search-view.js` | 실제 결과 반영·보이는 탭·요약 기준 요소 노출 | 3 |
| `ui/utils/ui-helpers.js`, `home-main.js` | 목록 변경 확인, 메모리 fallback의 정확한 표현 | 4 |
| `ui/share-card.js` | API 완료·취소·PNG fallback별 한 번의 공유 종료 | 4 |

구현 후 최소 재현 시나리오:

1. 빈 입력 제외와 검색 버튼/Enter/최근/즐겨찾기/초기 URL/history/페이지 내부/refresh 출처 구분.
2. cold network, fresh cache, stale→성공/실패, cache render 전 빠른 SWR, 0경기 결과.
3. A→B, 검색→VS, 초기화, 늦은 성공/실패/finally에서 중복·잘못된 현재 성공 방지.
4. 숨긴 탭, 첫 그리기 전 대체, summary 노출 타이머 취소/재개, 구간 재렌더 중복 방지.
5. delayed SDK, SDK 차단·전송 실패·허용 필드 외 입력, 점검 모드, URL/참조/자동 수집 설정 확인.
6. 즐겨찾기 저장소 차단 시 현재 상태 변경과 영구 저장 미확인의 구분.
7. 두 VS 경로, 입력상 자기 자신·조회 후 같은 OUID, stale 비교, 대체된 비교.
8. native resolve/AbortError, 이미지/링크 복사 resolve/reject, PNG 대체 요청/실패에서 정확히 한 finish.
9. 로컬은 전송 spy/테스트 속성 등으로 검증하고 운영 시험 쓰기·Discord 발송 없이 통제된 읽기 점검. 운영 수신 확인은 5번에서 별도 수행.

GA에서 매개변수를 보낸 것과 보고서에서 분석 가능한 것은 다르다. 5~6번에서 필요한 enum의 이벤트 범위 맞춤 측정기준과 duration_ms 맞춤 측정항목의 등록·수신·보고 가능 여부를 확인한다. 임의 작업 ID·고유 사용자 값은 등록하지 않는다. p50/p95는 현재 무료 측정 범위에서 미산출로 남긴다. 이를 채우려고 BigQuery나 새 수집 서버·유료 내보내기를 도입하지 않는다. 기본 GA가 분위수를 제공하거나 평균에서 복원할 수 있다고 가정하지 않는다. 1번은 문서만 작성했고 2번에서 공통 기반과 GA 스트림의 `n` 값 가리기를 적용했다.

## 8. 1번 완료 조건

- 현재 공개 검색·캐시·history·즐겨찾기·VS·공유 흐름과 정의를 대조했다.
- 이벤트 이름·발생 시점·중복 범위·필드 enum·성과 지표의 분모를 정의했다.
- 캐시 부분 성공, 빠른 SWR, 이전 요청, 사용자 취소, 공유 대체 저장, 관측 누락을 구분했다.
- 후속 구현 위치와 검증 시나리오를 정리했다.
- 1번 완료 당시 제품 측정 수집은 미적용이었다. 후속 2번의 적용 범위와 3~6번의 미완료 상태는 문서 상단과 전송 기반 가이드에서 별도로 관리한다.

## 공식 참고 문서

- [GA4 이벤트 설정](https://developers.google.com/analytics/devguides/collection/ga4/events)
- [이벤트 매개변수와 맞춤 측정기준/항목 등록](https://developers.google.com/analytics/devguides/collection/ga4/event-parameters)
- [페이지 조회 측정과 자동/수동 중복](https://developers.google.com/analytics/devguides/collection/ga4/views)
- [page_location·page_referrer 기본값](https://developers.google.com/analytics/devguides/collection/ga4/reference/config)
- [입력값·URL·페이지 제목의 식별정보 방지](https://support.google.com/analytics/answer/6366371?hl=ko)

## 성장 8번 구현에 따른 해석

[모바일 흐름 개선](mobile-flow-improvements.md)에서 공유 대기/취소/PNG 요청 안내와 화면 순서를 수정했다. clipboard 응답 대기 안내만으로 finish를 보내지 않는다. 대기 중 사용자가 PNG 저장을 선택하면 원래 공유 시도를 download_requested로 한 번 끝내고 늦은 clipboard 응답을 중복 기록하지 않는다. 카드 생성 실패는 자동 재생성 없이 한 번 실패로 종료한다. 브라우저 공유 창은 사용자가 닫을 때까지 기다린다. 이 동작은 원래 운영 첫 시도의 원인 확정을 뜻하지 않는다.

핵심 요약 노출 조건은 유지하지만 정보 배치가 달라지므로 변경 시점·기간을 구분한다. 6번 일반 이용 표본은 아직 확보하지 못했으며 8번의 CSS 거리 비교를 사용자 속도·이탈·전환 효과로 대체하지 않는다. 새 배포의 운영 검증은 9번에서 진행한다.
