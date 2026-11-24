# 공개 전적 측정의 운영 수신 점검

작성일: 2026-10-23. 성장 체크리스트 5번. 점검 경로 구현·로컬 검증·배포·통제된 GA 실제 수신 확인 완료. 모든 기기·공유 경로가 검증됐다는 뜻은 아니며 아래 미종료 시도와 한계를 함께 해석한다.

## 2026-10-23 운영 확인 결과

- 코드 커밋 `2b977d5f426e1493b361f4077d209aaedc6ccc63`, [Site Deploy #703](https://github.com/HanBeom98/tracking-sa/actions/runs/39915658053) 성공. CI Node 570·Python 33·권한 48·일반 브라우저 25·인증 브라우저 11, 총 687개 통과. 공개 파일 검증 7개 통과. 게시판 이메일 정리 입력 none 및 단계 skipped.
- 점검 시간: 2026-10-23 **16:14:42~16:30:06 KST**. GA DebugView에서 제품 이벤트 9종 모두의 실제 수신과 `traffic_scope=verification`을 각각 확인했다. 표의 횟수는 이 통제된 점검의 관측값이며 일반 이용·전환율·개선 효과를 의미하지 않는다.

| 이벤트 | 수신 횟수 | 확인 내용 |
| --- | ---: | --- |
| sa_search_start | 3 | 버튼 검색·재검색·새 문서 직접 검색 |
| sa_search_first_result | 3 | 각 검색의 결과 표시 |
| sa_search_finish | 3 | 대표 완료: success / network / input_button, v1 |
| sa_summary_view | 2 | 실제 요약 카드 노출 |
| sa_favorite_change | 2 | 추가·해제 후 원상태 복귀. remove / result_button / unknown 확인 |
| sa_vs_start | 1 | 모달 비교 시작 |
| sa_vs_finish | 1 | modal / success / stale_cache |
| sa_share_start | 3 | 링크 1회·이미지 2회 |
| sa_share_finish | 2 | clipboard_link / success, clipboard_image / success |

제품 이벤트 20개 수신을 관측했다. 모든 종류에서 verification 표시를 확인했고, 대표 검색·공유의 version과 정규 page_location도 확인했다. 검색 완료 duration_ms 9650 및 이미지 완료 158은 각각 이 시험 한 번의 경과 시간이며 성능 기준값·개선율로 사용하지 않는다.

자동 page_view의 관측 주소에는 정규 URL과 `measurement_scope`, 마스킹된 `n=(redacted)`를 포함한 history URL 두 종류가 있었다. 제품 이벤트는 쿼리 없는 정규 URL이다. 자동 조회도 제품 이벤트와 동일하게 모든 query 키를 제거한다고 주장하지 않는다. GA의 일반 식별자·자동 속성 전체를 제거하거나 감사했다는 의미도 아니다.

### 이미지 첫 시도의 미종료

첫 이미지 복사는 PNG가 클립보드에 생성됐지만 버튼이 비활성이고 ‘공유 이미지를 만드는 중’ 안내가 계속되며 GA finish가 확인되지 않았다. 같은 시점 계급 이미지 프록시 3개는 HTTP 200이었다. 새 문서에서 재시도한 이미지 복사는 UI 완료 안내와 GA의 image_button / clipboard_image / success / verification / v1을 모두 확인했다. 첫 시도 원인은 아직 확정하지 않았으며 코드 수정으로 해결했다고 주장하지 않는다.

그래서 start 3개와 finish 2개를 억지로 맞추지 않는다. 첫 이미지 시도는 미완료/관측 누락으로 남기고 성공·실패로 채우지 않는다. 7번 모바일·공유 점검에서 우선 재현할 항목이다. 실제 iPhone/Android 공유 창·사용자 취소·PNG 대체의 운영 재현은 미확인이며 해당 경로의 로컬 fixture 검증과 구분한다.

즐겨찾기와 클립보드를 점검 전 상태로 복귀했고 외부 수신자에게 공유하지 않았다. URL 방식은 저장소 값을 남기지 않았으며 점검 후 쿼리 없는 새 검색 문서로 복귀했다. 기존 GA 필터·동의·광고 설정은 변경하지 않았다. 점검 시간의 자동 페이지 조회·engagement와 복귀 페이지 조회도 발생하므로 이 시간을 일반 행동의 성과로 해석하지 않는다. 일반 보고서용 맞춤 정의·production 조건은 6번에서 구성한다.

## 점검과 일반 이용의 구분

- 운영 공개 전적 검색을 `https://trackingsa.com/stats/sudden-attack/?measurement_scope=verification`로 새로 연다. 이 고정 파라미터는 점검 분류만 바꾸며 검색·인증·API 응답을 바꾸지 않는다.
- 점검 제품 이벤트에는 `traffic_scope=verification`, `measurement_version=v1`, `debug_mode=true`가 붙는다. 같은 문서의 GA config에도 이 값을 넣어 자동 이벤트를 구분한다. 일반 운영 제품 이벤트는 production이며 debug_mode 키를 보내지 않는다.
- URL 방식은 sessionStorage를 쓰지 않는다. 검색으로 URL이 바뀌어도 현재 문서는 점검 상태다. 종료할 때 쿼리 없는 주소로 새 문서를 열거나 점검 탭을 닫는다. 기존 콘솔 방식의 sessionStorage 설정을 사용했다면 별도로 해당 키를 제거해야 한다.
- DebugView 표시는 보고서 자동 제외와 다르다. 기존 Internal Traffic 필터는 테스트 상태였고 활성화하지 않는다. 점검 이벤트의 보고서 분리는 6번에서 production 조건으로 구성한다. 다른 페이지·이전 GA 세션 전체가 점검 분류로 바뀐다고 가정하지 않는다.

## 실제 UI 확인 순서

1. GA 속성 `522839539`의 DebugView를 연다. 웹 스트림 `13403321098`, 측정 ID `G-PORTFOLIO`를 사용한다.
2. 점검 주소로 공개 검색을 열고 실제 검색 버튼/Enter를 사용한다. `sa_search_start`, `sa_search_first_result`, `sa_search_finish`의 수신과 출처·완료 상태를 확인한다.
3. 요약 카드를 보이는 상태로 1초 이상 두어 `sa_summary_view`를 확인한다.
4. 기존 즐겨찾기 상태를 확인하고 추가/해제 후 원상태로 복귀한다. 목록 제한으로 기존 항목이 밀려나지 않게 한다. `sa_favorite_change`의 action·source·unknown 지속성을 확인한다.
5. 모달에서 다른 공개 선수를 비교해 `sa_vs_start/finish`의 수신·DOM 결과와 출처를 확인한다. 운영에서 고의 API 장애나 쓰기 작업을 만들지 않는다.
6. 링크/이미지 공유 UI를 사용하고 실제 도달한 경로의 `sa_share_start/finish`를 확인한다. 외부 수신자에게 전송하지 않는다. 취소·지원 여부는 실제 결과대로 적으며 다운로드 요청을 저장 완료로 보지 않는다.
7. DebugView의 제품 이벤트 매개변수에서 scope·version·정규 page_location·허용 필드를 확인한다. 닉네임·OUID·사진·원본 오류가 제품 매개변수에 없음을 확인한다. 브라우저의 전송 함수 호출만으로 GA 수신을 주장하지 않는다.
8. 점검 종료 시 탭을 닫고 시간·이벤트 종류·실제 확인 결과·한계를 기록한다. 정상 운영에서는 debug_mode를 false로 보내는 대신 키를 생략한다.

## 로컬 검증과 한계

기존 단위·브라우저 검사는 정상/실패·캐시/SWR·대체·중복·지연 SDK·차단·저장소 오류·공유 완료/취소/PNG 경로를 다룬다. 5번은 점검 URL의 정확한 값·공개 페이지 한정·저장소 차단·일반 복귀·개인정보 제외·지연 SDK 중 history 변경을 추가로 확인한다.

브라우저 추가 검사는 production hostname을 로컬 파일과 SDK fixture로만 응답한다. 이 테스트는 운영 접속·GA 전송을 하지 않으며 점검→일반 복귀를 실제 생성 모듈로 검증한다. 실제 모바일 OS 공유 창, 모든 브라우저와 차단 확장 환경을 확인했다는 의미는 아니다.

GA DebugView 수신은 해당 경로의 수집 확인이다. 일반 보고서의 맞춤 측정기준/지표·집계 지연·p50/p95·개선 효과는 별도 6번 이후 범위다. 점검 시간의 페이지 조회·이벤트 수를 성과로 해석하지 않는다.

## 공식 근거

- [DebugView에서 이벤트 확인과 debug_mode 해제](https://support.google.com/analytics/answer/7201382?hl=en)
- [개발자 트래픽 필터](https://support.google.com/analytics/answer/13296662?hl=en)
- [이벤트 매개변수와 맞춤 정의](https://developers.google.com/analytics/devguides/collection/ga4/event-parameters)

## 7번 로컬 모바일 점검 후속 기록

2026-10-23 [모바일 흐름 점검](mobile-flow-audit.md)에서 실제 카드 렌더링과 모의 clipboard/share API를 사용했다. 정상 응답은 완료되고, clipboard.write 응답을 보류하면 로딩·버튼 비활성·start만 남는 양상이 유지되며 응답을 풀면 성공 finish와 UI가 복구된다. 이는 가능한 대기 지점을 좁힌 것이며, 5번 운영 첫 시도의 실제 API가 보류됐다는 증거나 근본 원인 확정이 아니다. 운영 클립보드와 실제 iPhone/Android 공유 창은 이번 로컬 점검에서 사용하지 않았다. 공유 취소 후 생성 중 안내 잔류 등 별도의 UI 문제도 확인했으며 코드 수정은 아직 하지 않았다.
