# TrackingSA 핵심 API 명세

[프로젝트 소개](../README.md) · [구조·데이터 모델·유저 플로우](portfolio-system-design.md)

기준: 2026.11.24 확인한 원본 커밋 `1df8890`. 실제 핸들러의 계약을 정리했습니다. 예제 닉네임·OUID·이미지 ID는 설명용 가상 값이며 운영 응답을 수집한 것이 아닙니다. 아래 요청 예시는 실행하지 않았습니다.

## API 목록

운영 서비스와 같은 출처의 `/api` 경로입니다. 공개 저장소를 정적 서버로 실행하면 Functions가 자동 실행되지는 않습니다.

| 메서드·경로 | 용도 | 인증 | 응답 |
| --- | --- | --- | --- |
| `GET /api/sa-proxy` | 허용된 NEXON 전적 API 중계 | 이용자 로그인 불필요. 서버에서 NEXON 키 부착 | 외부 API JSON과 상태 전달 |
| `GET /api/sa-image` | 허용된 서든어택 이미지 중계 | 로그인 불필요 | 이미지 바이트 |
| `GET /api/soop-live` | SOOP 서든어택 방송 목록 | 로그인 불필요 | 준비·정상·오래된 캐시·실패 상태 |
| `POST /api/discord-interaction` | Discord 명령 수신 | Discord Ed25519 서명 | Discord Interaction 프로토콜 |
| `POST /api/discord-sa` | 운영진 Discord 알림 중계 | Firebase ID 토큰·운영진 검사 | 성공 여부 |

Auth·게시판·크루는 [Firebase SDK 계약](#firebase-sdk-계약)으로 처리합니다. 대응하는 `/api/users`나 `/api/board` REST 경로를 별도로 구현한 구조는 아닙니다. 유료 AI·결제 준비 경로는 이 핵심 공개 기능 명세에서 제외했습니다.

## GET /api/sa-proxy

### 요청

`path`는 필수입니다. 단일 `/`로 시작하며 아래 허용 목록의 정확한 경로여야 합니다. 서버가 고정된 NEXON 호스트로만 요청하고 `path` 이외의 쿼리를 전달합니다. 이용자 브라우저에 NEXON 키를 전달하지 않습니다.

| `path` | 클라이언트가 전달하는 주요 쿼리 | 용도 |
| --- | --- | --- |
| `/suddenattack/v1/id` | `user_name` | 닉네임 → OUID |
| `/suddenattack/v1/user/basic` | `ouid` | 기본 프로필 |
| `/suddenattack/v1/user/rank` | `ouid` | 랭크 |
| `/suddenattack/v1/user/tier` | `ouid` | 티어 |
| `/suddenattack/v1/user/recent-info` | `ouid` | 최근 정보 |
| `/suddenattack/v1/match` | `ouid`, `match_type`, `match_mode` | 경기 목록 |
| `/suddenattack/v1/match-detail` | `match_id` | 경기 상세 |
| `/static/suddenattack/meta/grade` | — | 계급 메타데이터 |
| `/static/suddenattack/meta/season_grade` | — | 시즌 계급 메타데이터 |
| `/static/suddenattack/meta/tier` | — | 티어 메타데이터 |

```http
GET /api/sa-proxy?path=/suddenattack/v1/id&user_name=DemoPlayer
```

성공 응답의 형태를 보여주는 가상 예시:

```json
{"ouid":"example-ouid"}
```

프록시는 별도 통합 응답 스키마로 재가공하지 않습니다. 경기 목록의 정상 빈 응답 예시는 `{"match":[]}`이며 클라이언트가 배열 여부와 실패 상태를 구분합니다. 허용 경로의 추가 파라미터 유효성은 외부 API의 응답에도 영향을 받습니다.

### 캐시

성공 응답만 재사용합니다. 메모리·Cloudflare Cache API와 진행 중 요청 공유를 사용하며, 메모리 캐시는 최대 1,000개 항목입니다.

| 리소스 | 브라우저 `max-age` | 서버 캐시 TTL·`s-maxage` |
| --- | --- | --- |
| `id` | 60초 | 600초 |
| `user/basic` | 60초 | 300초 |
| `user/rank`, `user/tier` | 30초 | 120초 |
| `user/recent-info` | 15초 | 60초 |
| `match` | 10초 | 30초 |
| `match-detail` | 300초 | 86,400초 |
| 정적 메타데이터 | 3,600초 | 86,400초 |

`stale-while-revalidate`에는 서버 캐시 TTL과 같은 초 단위를 설정합니다. `X-SA-Cache`는 `HIT`, `EDGE_HIT`, `COALESCED`, `MISS`로 재사용 경로를 표시합니다. 프론트엔드의 프로필 5분 캐시·경기 목록 30초 캐시는 이 HTTP 캐시와 별개입니다.

### 오류와 공통 헤더

| 상태 | 조건 |
| --- | --- |
| 204 | `OPTIONS` |
| 400 | `path` 누락·허용되지 않은 경로·외부 호스트 |
| 405 | GET·OPTIONS 이외 메서드 |
| 503 | 서버 `NEXON_API_KEY` 미설정, `code: NEXON_API_KEY_MISSING` |
| 외부 API 상태 | 외부 API의 비정상 응답 전달 |
| 504 / 502 / 500 | 시간 초과 / 외부 요청 실패 / 기타 내부 오류 |

외부 요청 실패 응답에는 `no-store`를 적용합니다. CORS 허용 출처는 `https://trackingsa.com`이며 요청 추적용 `X-Request-ID`를 제공합니다. CORS 설정 자체를 이용자 인증으로 취급하지 않습니다.

근거: [핸들러](../functions/api/sa-proxy.js), [공용 캐시](../functions/infra/public-response-cache.js), [캐시 테스트](../tests/unit/sa-proxy-cache.test.js), [클라이언트 테스트](../tests/unit/nexon-api-client.test.js).

## GET /api/sa-image

| 항목 | 계약 |
| --- | --- |
| 필수 쿼리 | `path` |
| 허용 형태 | `/static/suddenattack/img/` 뒤에 32자리 16진수. 대소문자 구분 없음 |
| 응답 | 외부 응답이 이미지 MIME일 때 이미지 바이트 반환 |
| 캐시 | 브라우저 86,400초, 공유 캐시 604,800초, stale-while-revalidate 2,592,000초 |
| 주요 상태 | OPTIONS 204, 잘못된 경로 400, 메서드 405, 시간 초과 504, 외부 오류 상태 또는 502 |

```http
GET /api/sa-image?path=/static/suddenattack/img/00000000000000000000000000000000
```

위 ID는 가상 값입니다. 임의 URL을 받아 전달하는 범용 프록시가 아닙니다. 실패 응답은 캐시하지 않습니다.

근거: [핸들러](../functions/api/sa-image.js), [허용 경로·MIME·실패 테스트](../tests/unit/sa-image-proxy.test.js).

## GET /api/soop-live

`page`는 선택이며 1~10 정수 하나만 허용합니다. 생략하면 기본 조회 흐름을 사용합니다.

| 상태 | 의미 |
| --- | --- |
| HTTP 200, `status: pending` | 서버 연동 설정이 없는 준비 상태. `broadcasts: []`만 보고 실제 방송 0개라고 확정하지 않음 |
| HTTP 200, `status: ready` | 정상 목록. `broadcasts`, `updatedAt` 등 제공. 페이지 요청에는 `mode: page`, `page`, `pageCount` 포함 |
| HTTP 200, `stale: true` | 외부 조회 실패 시 재사용 가능한 이전 캐시 반환 |
| 400 / 405 | 잘못되거나 중복된 페이지 쿼리 / 허용하지 않은 메서드 |
| 502 / 504 | 재사용할 캐시 없는 외부 요청 실패 / 시간 초과 |

캐시는 30초, 실패 시 재사용 가능한 오래된 캐시 범위는 5분입니다. 브라우저 캐시는 15초입니다. `X-SOOP-Cache`는 `HIT`, `EDGE_HIT`, `MISS`, `STALE`, `DISABLED`, `ERROR` 상태를 구분합니다. OPTIONS는 204입니다.

근거: [핸들러](../functions/api/soop-live.js), [API 상태 테스트](../tests/unit/soop-live-api.test.js), [페이지 테스트](../tests/unit/soop-live-paging.test.js).

## POST /api/discord-interaction

일반 웹 이용자의 Bearer 토큰 대신 Discord가 서명한 원문 요청을 검증합니다.

| 항목 | 계약 |
| --- | --- |
| 헤더 | `x-signature-ed25519`: 128자리 16진수, `x-signature-timestamp`: 숫자 1~12자리 |
| 검증 | Ed25519 원문 서명, 타임스탬프 5분 범위, 애플리케이션 ID |
| 본문 제한 | 64KiB |
| PING | `{"type":1}` 응답 |
| 명령 | `/전적`, `/리플레이`, `/도움말`. 즉시 응답 또는 지연 응답·후속 메시지 등 Discord 프로토콜 사용 |
| 주요 오류 | 설정 누락 500, 서명·애플리케이션 불일치 401, JSON·Interaction 오류 400, 크기 초과 413, 메서드 405 |

Discord 리플레이 경로는 제한된 파일 헤더·요약과 웹 분석 진입을 연결합니다. 웹의 전체 기본 분석을 Firebase 서버 함수가 수행한다는 의미는 아닙니다. 구형 세션 RPC와 현재 명령 경로도 구분합니다.

근거: [진입점](../functions/api/discord-interaction.js), [서명 테스트](../tests/unit/discord-native-signature.test.js), [명령 테스트](../tests/unit/discord-bot-v2.test.js), [리플레이 헤더 테스트](../tests/unit/discord-replay-header.test.js).

## POST /api/discord-sa

```http
Authorization: Bearer <Firebase ID token>
Content-Type: application/json
```

```json
{"embeds":[{"title":"예시 경기 요약","description":"문서용 가상 메시지","fields":[]}]}
```

이 예시는 메시지 전송을 실행하지 않습니다.

| 항목 | 계약 |
| --- | --- |
| 인증 | Firebase ID 토큰의 서명·발급자·대상·만료 등 검사 후 운영진 허용 목록 확인 |
| 입력 | `embeds` 배열 1~3개. `JSON.stringify(body).length` 기준 12,000 이하 |
| 정제 | 제목·본문·필드 길이와 개수 제한, 시간·푸터 서버 설정, `allowed_mentions.parse: []` |
| 성공 | HTTP 200, `{"success":true}` |
| 실패 | 인증·권한 401, 웹훅 설정 없음 503, 크기 초과 413, 입력 오류 400, 메서드 405, Discord 실패 상태 전달 |

크기 제한은 현재 구현의 JavaScript 문자열 길이 검사이며 UTF-8 바이트 수와 같다고 가정하지 않습니다. 웹훅 주소는 서버 환경변수에만 둡니다.

근거: [핸들러](../functions/api/discord-sa.js), [ID 토큰 검증](../functions/security/firebase-id-token.js), [웹훅 보안 테스트](../tests/unit/discord-webhook-security.test.js).

## Firebase SDK 계약

회원·게시판·크루 기능은 Firebase SDK 호출과 Rules가 함께 계약을 이룹니다. 서버리스 API의 공통 Bearer 인증을 거치는 구조로 표현하지 않습니다.

| 기능 | 저장 경로·처리 | 핵심 제약 |
| --- | --- | --- |
| 프로필·닉네임 | `users/{uid}`, `nicknames/{nickname}` | 본인 UID, 허용 필드, 닉네임 예약 트랜잭션·변경 간격 |
| 게시글 | `board_posts/{postId}` | 공개 조회, 로그인·닉네임 검증, 작성자·운영진 권한 |
| 댓글 | 게시글 하위 `comments/{commentId}` + `comment_rate_limits/{uid}` | 자유게시글, 한 단계 답글, 본인 작성, 10초 간격 |
| 이미지 첨부 | Storage `board-images/{uid}/{imageId}` | WebP·5MB 이하·소유자 메타데이터 |
| 크루 신청 | `sa_crew_applications/{uid}` | 본인 신청은 PENDING으로 생성, 운영진 승인·거절 |
| 정산 | 멤버·정산 영수증·세션 | 운영진 쓰기, 트랜잭션·경기 ID로 중복 정산 제어 |

전체 필드·식별자 관계와 코드 링크는 [데이터 모델](portfolio-system-design.md#2-firestore-데이터-모델), 실제 권한 조건은 [Firestore Rules](../firestore.rules)와 [Storage Rules](../storage.rules)를 기준으로 확인할 수 있습니다.
