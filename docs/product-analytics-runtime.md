# 제품 이벤트 전송 기반

성장 2번 공통 기반·3번 공개 검색·4번 후속 행동 연결 구현. `src/shared/assets/product-analytics.js`·`analytics-loader.js`, 공개 페이지의 `ui/runtime/search-measurement.js`·`action-measurement.js`, `home-main.js`·`ui/share-card.js`가 담당한다. 5번에서 이벤트 9종의 운영 GA DebugView 수신과 점검 분류를 확인했다. [운영 점검 기록과 한계](product-measurement-verification.md)를 참고한다. 6번은 [맞춤 정의와 보고서 설정](product-measurement-reports.md)을 저장했으며 처리된 일반 이용 기준 표본을 기다린다. [무료 운영 원칙](free-operation-policy.md)에 따라 BigQuery 연결안을 철회했고 기존 GA 조회·수동 내보내기·로컬 집계로 범위를 조정했다. 정확한 분위수·순서 있는 세션 분석은 미산출로 남기며 현재 완료 필수 조건이 아니다.

## 공개 검색 연결

- head의 module 로더가 생성한 `window.trackingSaProductAnalytics` 클라이언트를 페이지에 주입한다. 두 module 스크립트는 async 없이 문서 순서대로 실행한다. 도메인 코드가 공통 파일을 다른 경로/캐시 버전으로 재수입하지 않아 로더와 같은 큐·중복 문맥을 쓴다. 로더가 없거나 차단돼도 검색은 계속 동작한다.
- 버튼·Enter·최근 검색·즐겨찾기 검색·직접 링크·history·페이지 내부 검색·refresh를 구분한다. 빈 입력은 시작하지 않는다. 즐겨찾기 칩으로 검색하는 진입점과 즐겨찾기 추가/삭제 행동 이벤트는 별개다.
- `ProfileQueryService`가 반환값의 `querySource`로 network/fresh_cache/stale_cache를 명시한다. 선택적 `onQueryState({source,revalidating})`는 조회 경로가 정해질 때 호출하며 오류는 격리한다. 관찰자는 하위 API에 전달하지 않고 메타데이터는 프로필 캐시에 저장하지 않는다. 기존 isStale/cacheTime와 캐시·dedupe·닉네임 정책은 유지한다.
- 결과 컴포넌트와 경기 목록의 DOM 반영 후 두 번의 requestAnimationFrame을 거쳐 첫 결과를 기록한다. 실제 픽셀 표시나 읽기 완료를 보장하는 신호는 아니다. 같은 화면 요청이 현재인지 재검사하고, 숨긴 탭은 보일 때까지 보류한다. 이때 duration_ms에는 숨긴 동안의 대기도 포함된다. 숨긴 탭의 지연을 순수 API 응답 시간으로 해석하지 않는다.
- 표시 전에 더 최신 렌더가 오면 이전 예약을 폐기한다. 첫 표시와 finish를 순서대로 한 번씩 기록한다. stale cache 후 갱신 성공은 network/success, 실패는 stale_cache/partial/failure다. 갱신이 첫 캐시 반환보다 빨라도 최신 결과와 종료 정보를 유지한다.
- 새 검색·유효한 VS 시작은 미종료 검색을 superseded, 초기화·기본 화면 이동·pagehide는 cancelled로 기록한다. 실제로 첫 표시한 출처만 보존하고 미완료 SWR는 interrupted다. pagehide는 best effort이고 BFCache 복귀에서 같은 작업을 재개하거나 재종료하지 않는다. 네트워크를 측정 때문에 취소하지 않는다.
- 핵심 요약의 기준 요소는 공개 결과의 승률 KPI 카드 `[data-measurement-summary]`다. IntersectionObserver의 50% 이상 노출과 보이는 탭에서 연속 1초를 확인한다. 숨김·교체·재렌더·기준 아래로 스크롤하면 노출 타이머를 초기화하며 시도당 한 번이다. IntersectionObserver가 없으면 노출을 추정하지 않는다. 이후 화면 개선에서도 같은 의미의 기준을 유지한다.
- 최근/이전 구간·매치 유형·더보기 재렌더는 새 검색/첫 결과/종료를 만들지 않는다. 실제 공개 검색 페이지에만 연결하며 리그 검색은 이 이벤트로 합산하지 않는다.

## 즐겨찾기·VS·공유 연결

- 즐겨찾기는 결과 버튼과 칩 삭제를 구분한다. 기존 도우미에서 변경 전/후 상태를 읽고 목록·버튼 렌더가 끝난 뒤 실제 상태가 달라졌을 때만 기록한다. 이미 삭제된 칩의 늦은 콜백은 추가 이벤트를 만들지 않는다. 저장 실패 시 메모리 목록도 현재 페이지의 상태로 취급하며 persistence는 unknown이다. 영구 저장 성공이나 재방문 보존을 주장하지 않는다. 8개 제한으로 밀려나는 다른 항목을 사용자가 직접 삭제한 행동으로 추가 집계하지 않는다.
- VS는 모달과 즐겨찾기 칩의 두 경로를 구분한다. 기준 없음·진행 중·빈 입력·입력상 자기 자신은 시작 전에 제외한다. 시작 후 같은 OUID가 확인되면 same_player 실패다. 현재 요청의 renderVs가 DOM을 반영한 뒤 querySource를 사용해 완료한다. 비교는 공개 검색의 first_result와 달리 별도 두 프레임/노출 조건을 추가하지 않으며 실제 읽기를 보장하지 않는다.
- 새 검색/VS가 이전 비교를 대체하면 superseded, 초기화/pagehide는 cancelled로 한 번 종료한다. 늦은 비교 응답·오류는 새 작업을 종료시키지 않는다. stale cache 비교는 현재 동작대로 갱신 콜백을 붙이지 않으며 stale_cache 완료를 최신 네트워크 비교로 표현하지 않는다.
- 기존 결과 화면 CSS가 즐겨찾기 목록 전체를 숨겨 칩 비교·삭제 경로에 접근할 수 없었다. 항목이 있을 때는 결과 화면에서도 기존 즐겨찾기 목록을 표시하도록 숨김 선택자 두 개를 조정했다. 최근 검색과 빈 즐겨찾기는 결과 화면에서 계속 숨긴다. 390px와 1280px에서 버튼 접근과 가로 넘침을 확인했다. 이는 7번 전체 모바일 점검을 완료했다는 의미는 아니다.
- 공유 컨트롤러의 선택적 startMeasurement 콜백에 공개 페이지의 측정기를 주입한다. start에는 진입점만, finish에는 실제 마지막 경로와 결과만 전달한다. 모델·닉네임·링크·사진·파일 이름·원본 오류는 제품 이벤트에 넣지 않는다. 콜백이 없거나 예외를 내도 기존 공유 처리를 계속한다.
- native share resolve, 이미지/링크 clipboard resolve 후에 success를 기록한다. native share의 AbortError는 cancelled다. 이미지 복사가 실패하거나 지원되지 않아 PNG anchor click에 도달하면 download_requested 한 번이며 실제 디스크 저장·타인 전달 완료가 아니다. 대체 경로도 실패하면 png_download/failure다. clipboard의 AbortError는 native 취소로 오인하지 않고 failure/unknown으로 기록하며 기존처럼 추가 PNG 요청 없이 끝난다.
- 공유 요청을 수락할 때 모델과 사진 배치 값을 캡처한다. 이미지 생성 중 다른 검색·초기화가 있어도 해당 요청의 파일 이름·링크·재생성은 처음 카드 기준이다. 링크/이미지 및 여러 프로그램 호출의 동시 실행을 측정 때문에 차단하거나 합치지 않는다. 각 요청은 독립 문맥이며 완료 순서대로 기록한다. 사용자가 이미 시작한 공유를 새 검색 때문에 취소한 것으로 기록하지 않는다.
- PNG object URL은 주입된 URL API로 만들고 anchor 생성/클릭이 실패해도 finally에서 해제한다. 기본 브라우저 동작과 복사 실패 후 PNG 대체 순서는 유지한다. 사진 선택·확대·위치 조절·카드 공개·VS 모달 열기/닫기는 공유/비교 완료 이벤트가 아니다.

## 전송과 중복 범위

- `getProductAnalytics(window, document)`는 같은 페이지에서 같은 클라이언트를 반환한다. 로더도 같은 인스턴스를 사용한다.
- 작업마다 `createContext()`로 비어 있는 불변 객체를 만들고 같은 작업의 start/first/finish에 재사용한다. 외부에서 임의로 만든 객체는 수락하지 않는다. 객체나 작업 ID는 전송·저장하지 않는다.
- `track(eventName, fields, context)`는 [v1 명세](product-measurement.md)의 이벤트별 허용 필드/enum과 결과 조합을 검사한다. 알 수 없는 필드·개인 식별값·페이지 덮어쓰기 값은 전송하지 않는다. 잘못된 알려진 필드/조합은 이벤트 전체를 거부한다.
- 같은 문맥에서 같은 이벤트 이름은 한 번만 수락한다. 서로 다른 시도는 서로 다른 문맥을 쓴다. 즐겨찾기 반복 변경과 별도 공유 요청도 각각 새 작업이다. 첫 결과와 종료의 실제 순서·현재 요청 판정은 3~4번 호출부의 책임이다.
- `track()`의 true는 전송 요청을 큐에 수락했다는 뜻이다. GA 수신·사용자 실제 열람을 보장하지 않는다.

## 대기·차단·실패

- 기존 사용자 상호작용 또는 load 후 4초의 SDK 시작 시점을 유지한다. 제품 이벤트 기록만으로 SDK를 즉시 로드하지 않는다.
- SDK가 실제 load 이벤트를 보낸 뒤에만 클라이언트 전송 함수를 연결한다. 큐는 최대 100개, 보관 기한 60초이며 넘치면 가장 오래된 항목을 버린다. 기한이 지난 항목은 이후 작업/flush/status 확인 시 제거한다.
- SDK 로딩 오류 또는 시작 후 10초 대기 초과이면 큐를 비우고 해당 페이지의 제품 전송을 중지한다. 늦은 load도 다시 전송하지 않는다. 별도로 설치된 SDK의 준비 상태를 추측하지 않는다.
- 큐 항목을 제거한 뒤 gtag를 호출한다. 전송 함수가 예외를 내도 재시도하지 않아 불확실한 중복을 피한다. 네트워크 수신 확인은 별도이며 자체 재시도·우회 전송은 없다.
- 실패가 검색·인증·화면 동작으로 전파되지 않으며 Clarity 초기화와 분리한다. 중복 초기화/SDK load는 추가 config나 중복 flush를 만들지 않는다.
- `getStatus()`는 pending/sent/dropped/duplicates/ready/disabled 개수·상태만 반환한다. sent는 gtag 호출이 예외 없이 끝난 횟수이고 GA 서버 수신 횟수가 아니다. 큐 내용이나 사용자 정보를 반환하지 않는다.

## URL과 기존 측정

제품 이벤트는 공개 전적 검색 경로에서만 수락한다. 최초 GA config와 제품 이벤트의 page_location은 origin + `/stats/sudden-attack/`, 제목은 고정 서비스 제목, referrer는 origin만 사용한다. 실제 검색어·query·hash·입력 제목을 제품 이벤트에 넣지 않는다. 이 정규 URL에는 UTM 쿼리도 포함되지 않으므로 캠페인별 분석이 필요하면 개인정보 없는 캠페인 처리 방식을 별도로 정의한다. 다른 페이지의 config는 기존 방식을 유지한다.

2026-10-22에 GA 웹 스트림의 설정도 읽어 확인했다.

- 스트림 `13403321098`, 측정 ID `G-PORTFOLIO`.
- 향상된 측정, 브라우저 방문 기록 기반 페이지 조회, 폼 상호작용이 켜져 있었다. 자동 사이트 검색의 쿼리 목록은 `q,s,search,query,keyword`이며 추가 목록은 비어 있었다. 이 설정들은 변경하지 않았다.
- 기존 이메일 값 가리기는 유지하고, URL 쿼리 값 가리기에 **`n` 한 개**를 추가했다. 수정 미리보기에서 `?n=measurement-test&utm_source=naver`가 `?n=(redacted)&utm_source=naver`로 표시되는 것을 확인한 뒤 저장했다.
- 이는 Google의 향상된 자동 수집에 포함될 수 있는 n 값에 대한 보완이다. 키 자체를 제거하거나 이미 수집된 데이터를 소급 삭제하지 않는다. 제품 이벤트의 정규 URL과 자동 수집의 마스킹 URL은 구분한다.
- 수동 page_view를 추가하지 않았다. 기존 자동 페이지 조회 횟수를 제품 검색 횟수로 해석하지 않는다. SDK 실전송값 전체 검증, 맞춤 측정기준·보고서·핵심 이벤트 설정은 이 단계의 완료로 주장하지 않는다.
- 기존 동의/광고 설정을 확대하거나 변경하지 않는다. Clarity·NEXON을 포함한 모든 외부 수집의 감사를 마쳤다는 의미는 아니다.

## 점검 모드

로컬/미리보기 등 `trackingsa.com`·`www.trackingsa.com` 이외 호스트는 제품 이벤트의 `traffic_scope=verification`이다. 운영 공개 검색에서는 전용 주소 `https://trackingsa.com/stats/sudden-attack/?measurement_scope=verification`로 진입한다. 정확한 값 한 개만 수락하며 별도 저장소 값을 쓰지 않는다. 같은 문서의 검색/history로 URL이 바뀌어도 초기 클라이언트의 점검 분류를 유지한다. 쿼리 없는 주소로 새 문서를 열면 기본 production으로 돌아간다.

기존 콘솔 방식도 유지한다. 해당 탭 sessionStorage에 `tracking_sa_measurement_scope_v1=verification`을 지정하고 새로고침한다. 이 방식으로 켰다면 같은 키를 제거하고 새로고침해야 해제된다. URL 방식은 저장소가 차단돼도 동작한다. 검증 파라미터는 공개 검색 페이지에서만 인식하며 권한·인증·API 응답을 바꾸지 않는다.

verification 제품 이벤트에만 `debug_mode=true`를 추가한다. 점검 공개 검색 문서의 최초 GA config에도 debug_mode·traffic_scope·measurement_version을 넣어 해당 문서의 자동 이벤트를 구분한다. 일반 운영 config/제품 이벤트에는 debug_mode 키 자체를 넣지 않는다. 점검 설정은 초기화 시 캡처하므로 지연 SDK가 시작되기 전 검색 history가 쿼리를 바꿔도 일치한다. 제품 이벤트의 정규 URL에는 검색어·점검 쿼리 모두 포함하지 않는다.

이 값은 분류용이며 GA 보고서에서 자동 제외하거나 모든 GA 세션·다른 페이지를 점검 트래픽으로 전환하지 않는다. DebugView 확인과 실제 제외 필터 설정은 별개다. 보고서는 `traffic_scope=production`을 사용하고 점검 시간·자동 이벤트 영향을 따로 기록해야 한다. 사용자 ID나 인증 계정 판별은 사용하지 않는다. 기존 GA의 내부 트래픽 필터 상태는 테스트이며 이번 확인을 위해 제외 필터를 활성화하지 않는다.

로컬 테스트는 SDK fixture와 전송 spy를 사용한다. 5번 운영 수신 점검에서는 실제 공개 페이지의 점검 주소로 진입해 UI로 검색·즐겨찾기·VS·공유를 실행하고 GA DebugView에서 이벤트 이름·허용 매개변수·verification 표시를 확인한다. 클라이언트의 sent나 수집 엔드포인트 응답만으로 GA 수신을 완료 처리하지 않는다. 결과·실제 확인 시간·미확인 경로는 별도 점검 기록에 남긴다.

## 검증 범위

단위 검사는 SDK 준비 전 큐, 용량/만료, 재진입/중복, 전송 예외, SDK 오류/timeout/늦은 load, 허용 필드·throwing getter, 결과 조합, 비정상 시간, 페이지/참조 정규화, 저장소 차단과 점검 모드를 다룬다.

로컬 브라우저는 생성된 실제 ES module과 캐시 버전 URL로 로딩하고, 가짜 Google SDK를 늦게 응답시켜 큐와 전송 내용을 확인한다. 다른 시나리오는 SDK를 차단한 채 검색 입력/버튼이 정상 사용 가능한지 확인한다. 외부 수집 서버로 시험 이벤트를 전송하지 않는다.

3번 검증은 실제 검색 핸들러의 진입점·대체·VS 전환·초기화·pagehide와, 결정적 시계/프레임/노출 관찰자를 사용한 숨김·연속 노출·캐시/갱신 순서를 다룬다. 실제 브라우저에서는 초기 링크와 fresh cache/0경기, cold network/강제 refresh, stale 갱신 성공/실패, 같은 head 클라이언트의 SDK 준비 전 큐와 개인정보 제외를 확인한다.

4번은 실제 상태 변경·두 VS 경로·같은 OUID·이전 비교의 성공/오류·pagehide/reset, 공유 API 미완료/완료/취소·PNG 대체/실패·모델 교체·중복/동시 요청·측정기 예외를 검사한다. 실제 브라우저의 카드 PNG 생성과 즐겨찾기/VS UI를 사용하되 clipboard/share API와 다운로드 anchor는 fixture로 대체한다. 운영 클립보드·외부 수신자·실제 디스크 저장을 건드리지 않으며, 390px Chromium에서 native API를 흉내 낸 검사는 실제 iPhone Safari/Android 공유 시트 검증을 대신하지 않는다.

공식 근거: [이벤트 매개변수](https://developers.google.com/analytics/devguides/collection/ga4/event-parameters), [페이지 조회 및 방문 기록 설정](https://developers.google.com/analytics/devguides/collection/ga4/views), [GA 데이터 수정의 적용 범위](https://support.google.com/analytics/answer/13544947?hl=ko), [DebugView와 debug_mode 해제](https://support.google.com/analytics/answer/7201382?hl=en), [개발자 트래픽 필터의 별도 적용](https://support.google.com/analytics/answer/13296662?hl=en).

## 성장 8번의 공유 복구와 화면 배치

[모바일 개선 구현](mobile-flow-improvements.md)에서 공유 상태와 결과 정보 순서를 갱신했다. 이벤트 이름·허용 필드·버전 v1은 유지한다. 복사 응답이 8초 이상 대기하면 안내와 PNG 저장 경로만 제공하고 실패/성공 finish를 만들지 않는다. PNG를 명시적으로 선택하면 기존 시도의 png_download/download_requested를 한 번 기록하며, 뒤늦은 원래 복사 응답은 추가 완료나 새 안내 덮어쓰기를 만들지 않는다. 원래 브라우저 쓰기가 끝날 때까지 중복 이미지 공유는 막고 링크 복사는 사용할 수 있다. 카드 생성 시간 제한은 기기 공유 창의 사용자 응답 시간 제한과 다르다.

공유 패널은 기본 접힘이며 KPI·최근 변화가 상세 프로필보다 먼저 나온다. summary_view의 대상과 50%/연속 1초 조건은 그대로지만 화면 위치 변경으로 노출 가능성은 달라진다. 6번 실제 기준 표본 미확보 상태에서 노출 증가를 이해도·전환 개선으로 단정하지 않는다. 원자료 내보내기·운영 DB 저장·새 GA 정의·추가 API/재시도는 도입하지 않았다.
