# 개발·검증 가이드

2026-11-07 갱신. [현재 상태](current-status.md) · [유지보수 결과](maintenance-2026-11-07.md) · [문서 목차](README.md).

## 실행 환경

| 작업 | 기준 | 근거 |
|---|---|---|
| 사이트 개발·일반 CI | Node.js 24 | validate.yml, site-deploy.yml |
| 정적 사이트 생성·Python 검사 | Python 3.11 이상(3.x) | CI 3.11, datetime.UTC 사용 |
| Firebase 서버 함수 | Node.js 22 | cloud-functions/package.json, firebase.json |
| 로컬 권한·인증 통합 검사 | Java 21 + 선택 설치한 Firebase 도구 | tests/emulator/README.md |
| 브라우저 | 잠금 파일에 맞춘 Playwright Chromium | npm ci 후 npx playwright install chromium |

사이트 개발용 Node와 Firebase 함수 런타임은 용도가 다르다. 이번 정리는 서비스의 런타임 버전을 변경하지 않는다. 일반 CI는 운영 비밀 키 없이 실행된다.

## 처음 설치하기

저장소 루트에서 실행한다. 의존성 버전은 잠금 파일을 따르며 npm ci를 사용한다.

~~~sh
npm ci
python -m venv .venv
~~~

Windows PowerShell:

~~~powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
npm.cmd run build
npm.cmd test
npm.cmd run test:python
npx.cmd playwright install chromium
npm.cmd run test:e2e
~~~

Linux/macOS에서는 .venv/bin/python -m pip install -r requirements.txt로 Python 의존성을 설치하고 npm/npx를 사용한다. Python 실행기는 .venv, venv의 Windows/Unix 인터프리터, python, python3, py -3 순서로 실제 실행 가능 여부와 3.11 이상 버전을 확인한다. 실행 실패나 구버전이면 다음 후보를 검사하며, 지원 인터프리터가 없으면 설치 안내와 함께 실패한다. 빌드와 Python 검사는 UTF-8 모드로 실행한다.

Java/Emulator는 별도 통합 검사를 실행할 때 준비한다. 테스트 도구 설치와 로컬 포트는 [권한 검사 안내](../tests/emulator/README.md), 인증 브라우저 SDK 설치는 [브라우저 검사 안내](../tests/e2e/README.md)를 따른다. 두 문서에 명시한 도구 버전을 사용하며 운영 Firebase 키는 필요하지 않다.

## 원본과 배포 파일

| 경로 | 역할 |
|---|---|
| src/domains/ | 게임·계정·게시판 등 기능 소스 |
| src/shared/ | 공통 화면 자산·Python 빌더 |
| src/static/ | 그대로 배포하거나 보관하는 정적 원본 |
| index.html 등 루트 자산 | 빌더가 읽는 기존 홈·PWA·배포 설정 원본 |
| functions/ | Cloudflare Pages Functions 공개 API 핸들러 |
| cloud-functions/ | Firebase 서버 함수 |
| public/ | 다시 만들 수 있는 생성 결과 |

public을 직접 고치지 않는다. npm run build는 기존 public을 비우고 원본에서 다시 생성한다. 복사 경로·개별 파일 미러·제외 규칙·통합 가이드 목록은 scripts/deployment-artifacts.json을 원본으로 한다. Node 검사는 기존 deployment-artifacts.js 경로를 통해 이 JSON을 읽고, Python 빌더도 실행 위치와 무관하게 같은 파일을 읽는다.

copyRoots는 공통 자산→공통 UI→도메인→정적 원본 순서로 복사한다. 도메인 루트 아래 새 하위 도메인도 자동으로 포함하므로 board/write 같은 하위 경로를 별도로 등록하지 않는다. htmlProcessingRoots에 해당하는 도메인 원본 HTML에만 공통 화면 처리를 적용하며, 공통 UI 템플릿·offline 페이지·src/static HTML은 다시 가공하지 않는다. 개별 파일은 fileCopies, 루트 자산은 rootAssets, 제외 파일·캐시·보관 사본은 copyPolicy를 따른다.

새 JS/CSS와 배포 경로를 추가하면 JSON의 검사 대상도 확인한다. scripts/public_sync_map.txt는 명시적인 경로 호환 검사를 위해 유지한다. 통합 가이드 원본은 배포에서 제외되고 기존 301 목적지로 이동한다. 실제 플랫폼 설정인 _redirects와 firebase.json은 이 정리에서 변경하지 않았으며, 기존 리다이렉트 회귀 검사를 유지한다.

전적 요약의 `stats-summary-renderers.js`는 프로필·VS·관계/리그 렌더러의 사용 중인 재내보내기 경로를 유지한다. 스타일은 `stats-summary-styles.js`, 폼 라벨은 `stats-summary-relationships.js`의 실제 구현을 사용하며 이 두 helper를 facade에서 다시 내보내지는 않는다. `public-search-presenters.js`는 구간·분석 문구·카드·VS 비교 데이터를 만들고, `public-search-view.js`는 화면과 전환을 조정한다. `getSeasonView`는 presenters에서 직접 가져오며 view에서 재내보내지 않는다. 로딩 진행률·타이머는 `public-search-loading.js`, 경기 유형 탭·더 보기·이전 응답 무효화는 `public-match-history.js`가 맡는다. 상세 범위는 [VS 계약](vs-comparison.md)을 따른다.

`NexonApiClient.getMatchList`는 OUID·유형·모드별 동일 요청을 합치고 정상 목록을 30초·최대 32키의 메모리에 보관한다. 활동·더 보기·리플레이 당시 전력은 같은 공급자 범위에서 필요한 기록을 선택한다. 전체 실패·일부 유형 실패·정상 빈 기록을 구분하고, 불완전한 집계를 정상 캐시로 확정하지 않는다. [조회·캐시·재시도 계약](match-list-queries.md)을 기준으로 수정하며 리그 정산·게임 닉네임 이력과 구분한다.

경기 컴포넌트에는 `sa-match-list.matchRecords`로 배열을 전달한다. `null`은 로딩, `[]`은 빈 목록이다. `matches(selector)`는 브라우저의 원래 DOM 메서드이므로 데이터 setter로 덮어쓰지 않는다. 도메인/프로필의 `matches` 배열은 별개의 계약이다.

컴포넌트 등록은 페이지 진입점에서 나눈다. 공개 검색의 home-main.js는 register-common.js로 플레이어 카드·전적 요약·레이더·시너지·매치 목록을 등록한다. 리그의 main.js는 register-league.js로 공통 컴포넌트와 MMR 성장 그래프·맵 숙련도·MVP·하이라이트·팀 보드·랭킹을 등록한다. 공개 검색에서도 사용하는 시너지와 레이더는 공통에 둔다. 등록 진입점은 컴포넌트 등록을 담당하며, 데이터 입력은 위의 `matchRecords` 등 개별 계약을 따른다. 테스트에서 한 페이지에 다른 화면의 컴포넌트를 생성하려면 해당 등록 진입점을 먼저 import한다.

공유 카드의 기존 진입점 share-card.js는 DOM 미리보기·공유/복사·다운로드 복구 흐름을 조정한다. share-card-model.js는 기존 전적에서 모델과 표시 수치를 만들고, share-card-canvas.js는 카드 그리기·장식 이미지 로딩·PNG 생성을 맡는다. share-profile-image.js는 임시 사진 검증·미리보기 배치·확대/드래그·초기화·object URL 해제를 맡는다. 기존 export 경로와 팩토리 옵션·반환 API는 유지하며, 공유 시작 시 선택한 사진과 조정값을 복사해 이후 편집과 구분한다. 사진·조정값을 서버나 브라우저 저장소에 저장하지 않는다.

CrewRepository는 기존 import 경로·설정값·정산 진입점·밸런싱 동작을 유지하고 기능별 메서드를 조합한다. crew-member-methods.js는 멤버 조회·랭킹·닉네임 이력·레거시 OUID 이전, crew-application-methods.js는 가입 신청·승인/거절, crew-match-methods.js는 기록·대기 명단·수동 탈주 보완을 담당한다. 시즌 초기화·현재 시즌 HSR 재시드·데이터 복구는 기존 crew-season-methods.js에 모았다. 기존 시즌 모듈과 같은 property descriptor 복사 방식으로 프로토타입 메서드와 this 호출·비열거 속성을 유지한다. 정산 계산은 domain/crew-settlement.js, 실제 트랜잭션 저장은 crew-settlement-store.js에 둔다. 닉네임 조회 순서·과거 이름 보존·수동 이름 변경 정책·DB 호출 횟수는 이번 분리에서 변경하지 않는다.

## 리플레이·Discord 진입점

리플레이 `replay/main.js`는 입력·분석·렌더링·재생을 연결한다. DOM 없는 `application/replay-workspace-session.js`가 파일·샘플·현재 분석과 작업 번호를 소유하고, `ui/replay-forecast-controller.js`는 선택적 전력 조회, `replay-output-controller.js`는 PNG/PDF 작업과 창, `replay-preview-controller.js`는 로컬 모의 해설·복기/API·구매 흐름을 관리한다. 파일/선수 변경·초기화·최종 종료 시 이전 비동기 결과를 무효화하고 자원을 해제한다. BFCache의 `persisted: true`는 세션을 유지한다. 홈의 파일·샘플 진입점과 로컬 기능의 기존 opt-in 조건은 [수명주기 계약](replay-workspace.md)을 따른다.

Discord `functions/api/discord-interaction.js`는 크기·원본 서명·시각·앱 ID 검증과 v2 우선 라우팅을 담당한다. `functions/discord/bot.js`가 새 명령·선수 선택을 처리한다. 운영 v2의 구형 요청은 비공개 전환 안내로 끝나며, 원복용 `functions/discord/legacy-handler.js`는 검증된 구형 경로에서만 지연 로딩한다. 원래 Request·본문을 그대로 세션 RPC에 전달한다. 구형 명령 등록·서비스·DB 보존 및 원복은 [봇 명세](discord-bot-renewal.md)를 따른다. 파일 분리를 이유로 운영 데이터나 인증 호환 모듈을 삭제하지 않는다.

SOOP 정규화·정렬 구현은 `src/domains/home/soop-broadcasts.js`에 둔다. API 핸들러에서 사용하지 않는 helper를 다시 내보내지는 않는다. 실제 caller가 있는 facade·호환 별칭·테스트 초기화 export는 사용 범위를 확인하고 유지한다.

## 명령별 검사 범위

| 명령 | 대상과 범위 |
|---|---|
| npm test / npm run test:unit | 전체 Node 단위 검사, 운영 서버 호출 없음 |
| npm run test:rules | 단위 검사에 포함된 규칙 정적 점검; 실제 DB 검사는 test:emulator |
| npm run test:python | 메타데이터·검색·빌드·자산 버전 회귀 검사 |
| npm run check:source-of-truth | 현재 원본과 생성 JS/CSS 미러 일치 |
| npm run check:build-artifacts | 빌드 후 페이지·이미지·설정·검색/RSS/사이트맵·커밋 검사 |
| npm run check:public-edit-policy | HEAD 커밋의 원본/생성 파일 변경 정책 |
| npm run check:application-browser-boundary | application JS의 지정된 window/document·대화상자·innerHTML 구문 검사; AST 사용 |
| npm run check:ddd-boundary | 위 브라우저 구문 검사의 기존 명령 호환 별칭 |
| npm run check:source-graph | 배포 대상 브라우저 JS의 문자로 확인되는 연결·누락·연결 없는 후보·일부 계층 참조·모듈 순환 검사 |
| npm run test:e2e / test:e2e:ci / test:e2e:smoke | 127.0.0.1:4173의 기본 브라우저 검사; 외부 요청 차단 |
| npx playwright test --config tests/e2e/replay-playback.config.js | 기본 CI와 별도인 재생·비교 브라우저 검사; loopback·모의 응답 |
| npx playwright test --config tests/e2e/playwright.review.config.js | 로컬 복기/API·구매·심사용 TEST 모의 브라우저 검사; 실결제/유료 AI 활성화와 별개 |
| npm run test:emulator | demo 프로젝트의 실제 Firestore/Storage 권한·동시성 |
| npm run test:e2e:auth / test:e2e:auth:local | 로컬 Auth/Firestore/Storage + Firebase 8.10.1 SDK로 로그인·작성 흐름 |
| npm run test:e2e:production | 명시적으로 선택한 배포 사이트의 기존 guest/read-only smoke; 일반 검증에서 자동 실행하지 않음 |
| npm run test:smoke:release | 기존 배포 사이트 HTTP 점검 스크립트; 로컬 검사와 별개 |

기본 CI의 브라우저 대상은 `tests/e2e/playwright.ci.config.js`의 `testMatch`로 확인한다. 모든 개별 spec이 기본 CI에 들어가는 것은 아니다. 재생·비교·로컬 복기/구매 경로를 바꾸면 관련 전용 설정도 실행한다. 같은 4173 포트를 사용하는 브라우저 설정은 순서대로 실행한다.

직접 npx playwright test를 실행해도 루트 설정은 로컬 기본 검사다. 운영 smoke는 tests/e2e/playwright.production.config.js를 명시하며 TRACKING_SA_BASE_URL은 이 설정에서만 읽는다. 기본·인증 로컬 설정의 고정 loopback 주소에는 이 환경 변수가 적용되지 않는다. 운영 smoke의 기본 주소는 https://trackingsa.com이며 운영 테스트는 사용자 요청에 따라 별도로 실행한다.

검사용 Acorn 8.15.0은 개발 의존성으로만 설치하며 웹 배포에 포함하지 않는다. application 검사는 주석·문자열·정규식의 예시를 실제 접근과 구분하고 computed/optional member도 확인한다. 별칭·구조분해·지역 바인딩의 실제 전역 여부·모든 DOM API를 추적하는 분석은 아니다. 계정 번역의 기존 globalThis["window"] 표현 한 개만 정확한 파일/표현/이유로 예외 처리하고, 중복·추가 접근이나 사용하지 않는 예외는 실패한다.

연결 검사는 deployment-artifacts.json의 복사 경로를 기준으로 원본 HTML·공용 HTML 조각·Python의 script 태그, ESM import/reexport·문자열 dynamic import·로컬 JS 경로 문자열을 연결한다. head의 미확장 FIREBASE_CONFIG 값은 구문 분석 시에만 null로 취급한다. 주석·JSON-LD·테스트·스크립트 도구를 브라우저 진입점으로 사용하지 않는다. native browser에서 매핑되지 않은 bare import는 실패하며 import map은 지원하지 않는다. domain→application/infra/ui 및 application→infra/ui의 문자로 확인되는 모듈 참조를 막는다. 기존 stats 앱 조립 파일의 생성자 import 3개와 게시판 인증 호환 재내보내기 1개는 정확한 파일 쌍만 허용하고 오래된 예외도 실패한다. infra/ui의 모든 참조 방향을 강제하는 전체 DDD 검사는 아니다.

연결이 없는 파일은 삭제 지시가 아닌 검토 후보이며 검사가 자동 삭제하지 않는다. 외부 URL·서버 API/함수 진입점·계산된 로더 경로·전역 콜백·실행 조건·미사용 선언/개별 export까지 검증하지 않는다. 계산된 dynamic import는 별도 검토 경고를 출력한다. 문자열 경로는 실행되지 않는 분기에도 있을 수 있으므로 연결됨이 실제 사용을 증명하지 않는다. 정적 연결 그래프와 브라우저/Emulator 검사를 함께 사용한다.

## 변경 후 검증 순서

1. 제품 소스 변경은 수정한 기능의 가장 좁은 검사를 먼저 실행한다. Markdown만 바뀌면 아래 문서 전용 절차를 따른다.
2. npm run build로 public을 생성한다.
3. 소스/산출물/계층 검사, 전체 단위 검사, npm run test:python을 실행한다.
4. npm run test:e2e:ci를 실행한다. 인증·게시판·리그·규칙 변경에는 Emulator와 인증 브라우저 검사도 실행한다.
5. 원본과 생성 파일을 함께 커밋하고 npm run check:public-edit-policy로 해당 커밋을 검사한다.
6. main에 푸시하면 Site Deploy가 공통 검증을 호출하고, 모두 성공한 뒤 해당 커밋을 운영 배포한다. 수동 실행은 main에서 선택하며 같은 검증을 거친다.

빌드가 public을 다시 만드는 동안 브라우저 검사나 public을 읽는 단위 검사를 동시에 실행하지 않는다. Python 빌드 회귀 검사는 임시 디렉터리를 사용한다. 기본/인증 브라우저는 4173을, 규칙/인증 통합 검사는 같은 Emulator 포트를 공유하므로 서로 순서대로 실행한다. 운영 Firestore·게시판·이미지·리그 정산을 테스트 데이터로 사용하지 않는다. 테스트 로그/리포트와 .venv·node_modules는 커밋하지 않는다.

## 자산 버전과 재현성

JS/CSS 등의 버전값은 내용 해시와 JS 의존성 해시로 만든다. 알려진 텍스트 확장자는 CRLF를 LF로 정규화한 바이트를 해시하므로 Windows/CI의 줄바꿈만 달라도 같은 버전이다. 실제 코드 변경은 해당 파일과 이를 가져오는 상위 모듈의 버전을 바꾸며, 관계없는 모듈 버전은 유지한다. PNG 등 바이너리 파일은 원시 바이트를 사용한다. 폴더 기반 fallback 버전은 __pycache__, .pyc, README.md와 .full 보관 파일을 제외한다. 원본 파일 자체를 일괄 변환하지는 않는다.

같은 소스와 같은 공개 설정으로 생성한 파일은 일치해야 한다. build.txt의 빌드 시각/커밋, RSS lastBuildDate, 검색 색인의 generated_at, 배포 환경의 Firebase 설정 등은 별도로 비교한다. 파일 수정 시각을 콘텐츠 게시일·수정일로 대신하지 않는다.

## 현재 CI와 검사 한계

main push의 Site Deploy는 Project Validation을 재사용하고, PR과 독립 수동 검증은 Project Validation을 직접 실행한다. main에서 같은 검증을 이중으로 실행하지 않는다. 전체 단위 검사와 경계 검사가 성공하면 빌드/Python/기본 브라우저와 규칙/인증 브라우저를 검사하며, 운영 배포는 모두 성공해야 진행된다. 검사 작업에는 운영 비밀값을 전달하지 않는다. 테스트 수는 고정된 목표가 아니므로 최신 실행 결과를 기준으로 확인한다.

11월 7일 운영 설정에서 Cloudflare Pages의 main Git 자동 배포 비활성과 Preview 설정 `none`을 확인했다. GitHub Actions의 검증 후 Wrangler 업로드를 운영 경로로 사용한다. 기존 사이트·도메인·환경 변수는 보존한다. 수동 우회 업로드는 검증을 자동으로 보장하지 않으므로 정상 배포 절차로 사용하지 않는다. 전환 적용 여부는 Cloudflare 설정과 실제 Site Deploy 실행을 확인한다.

배포 직전 원격 main의 SHA를 확인해 오래된 실행의 배포를 중단하며, 새 main 실행은 이전 배포 실행을 취소한다. 자동 push에서는 정적 사이트와 Pages Functions만 배포한다. 기존 Firebase 규칙/인덱스·Storage 규칙 배포는 Site Deploy의 수동 실행에서만 수행하고, 게시판 이메일 정리는 수동 입력을 audit/apply로 지정한 경우에만 실행한다. 회원 데이터 정리나 유료 AI/실결제 활성화는 자동 배포 작업에 포함하지 않는다.

브라우저 통합 검사는 로그인·세션 복원·닉네임·글/댓글·공지·이미지 정리와 주요 검색 화면을 다루지만 전체 서비스의 모든 입력 조합을 보장하지는 않는다. 회원가입 폼 제출, 외부 NEXON/SOOP의 실제 데이터 변동, 실제 Discord 채널 전송, 운영 트래픽 성능은 현재 로컬 검사 범위에 포함되지 않는다. 이런 범위를 확인할 때는 별도 시나리오와 대상 환경을 정한다.


## 문서만 변경하는 경우

문서 진입점은 [전체 목차](README.md), 기능·활성화 상태는 [현재 상태](current-status.md)에서 관리한다. README에는 현재 소개와 링크를 유지하고 상세 실험·릴리스 이력을 계속 덧붙이지 않는다. 현재 명세와 날짜별 검증 기록은 구분하며 과거 수치를 최신 성능이나 판매 상태로 표현하지 않는다.

Markdown만 수정했다면 상대 링크·이미지 경로·앵커·목차 누락과 실제 소스의 상태를 대조한다. 제품 HTML·JS·CSS·빌더·설정을 변경하지 않은 문서 정리에는 로컬 사이트 재생성·브라우저 전체 검사·수동 운영 배포가 필요하지 않다. 문서 변경의 검증 근거는 링크와 코드 대조로 기록하고, 이전 제품 릴리스의 테스트 수를 이번 문서 변경에서 새로 실행한 것처럼 쓰지 않는다.

현재 Site Deploy에는 경로 필터가 없어 **문서만 바뀌어도 main push 시 기존 전체 검사·자동 배포가 실행된다.** 문서 작업을 이유로 이 게이트를 건너뛰거나 별도 우회 업로드하지 않는다. 제품 소스가 함께 바뀌면 위의 기능별 검증 절차를 적용한다.
