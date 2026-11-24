# Vercel 운영 의존성 정리

확인일: 2026-10-25 (KST). 광고 수익화를 준비하면서 Vercel Hobby에서 서비스가 실행되는 경로를 제거한다. 유료 플랜이나 새 저장소·분석 서비스를 도입하지 않는다.

## 현재 실행 경로

| 기능 | 처리 위치 |
| --- | --- |
| 정적 사이트 | Cloudflare Pages |
| 전적·공유 이미지·SOOP | 같은 도메인의 `/api` → `functions/api/` |
| Discord HTTP 인터랙션·웹후크 | Cloudflare Pages Functions |
| 로그인·게시판·리그 데이터 | Firebase Auth·Firestore·Storage |
| Discord 모집 세션·첨부 정리 | 기존 Firebase Cloud Functions |

루트 `api/`의 5개 파일은 Vercel 요청/응답 어댑터였으며 제거했다. 공개 `/api/...` URL과 `functions/api/` 핸들러는 유지한다. `vercel.json`, 루트 `@vercel/functions`와 그에만 필요한 잠금 항목 25개를 제거했으며 살아남은 패키지 버전은 바꾸지 않았다. Cloudflare 보안·CORS 헤더는 기존 `_headers` 및 핸들러에서 제공한다.

Vercel 어댑터가 적용하던 Discord 본문 65,536바이트 제한을 Cloudflare 진입점에 적용했다. 스트림을 제한 안에서 읽고 초과 시 취소/413 응답한다. 검증 전 원문과 UTF-8 바이트 기준을 유지하며 서명·5분 유효기간·waitUntil·Firebase 세션 저장 방식은 바꾸지 않았다. 관련 어댑터 검사는 실제 Cloudflare 핸들러의 거부·서명·비동기 처리를 검사하도록 전환했다.

## 외부 설정 확인

- Discord 개발자 화면의 인터랙션 URL은 이미 `https://trackingsa.com/api/discord-interaction`이었다. OAuth2 리디렉션 등록은 없었다. 앱이나 권한·키를 재생성하지 않았다.
- SOOP 방송 조회는 서버에서 공개 목록 API를 Client ID로 요청하는 흐름이다. 현재 구현에 OAuth 리디렉션/콜백은 없으며 기존 Cloudflare 응답을 확인했다. 사용하지 않는 외부 앱 설정 전체를 점검했다고 주장하지 않는다.
- Vercel `tracking-sa` 프로젝트가 GitHub main 커밋을 자동 배포하던 상태를 확인하고 해당 Git 연결을 해제했다. 배포 훅은 없었다.
- Vercel Production Deployment를 Pause했다. `tracking-sa.vercel.app`에서 503 `DEPLOYMENT_PAUSED`를 확인했다.
- Pause만으로는 Preview 배포·환경 변수·설정·데이터를 삭제하지 않으므로, 사용자에게 영구 삭제 범위를 제시하고 명시적 승인을 받은 뒤 tracking-sa 프로젝트를 삭제했다. Vercel 대시보드의 프로젝트 목록이 비어 있는 것을 확인했다. Cloudflare/Firebase는 유지한다.

## 검증

| 검사 | 결과 |
| --- | --- |
| Discord·API·SOOP 좁은 회귀 | 20/20 |
| 전체 Node 단위 테스트 | 659/659 |
| 로컬 Chromium | 53/53. 외부 요청 차단, 검색·공유 API의 같은 출처 사용 포함 |
| 원본/빌드 산출물 | 159개 미러·256개 필수 파일 통과 |
| application/소스 그래프 | 28개 파일·151개 JS/222개 연결 통과 |
| Vercel 중지 후 운영 요청 | 홈 200, runtime-config 200, SOOP 첫 페이지 200, 무서명 Discord POST 401 |

검사는 실제 Discord 서버에 모집/검색 메시지를 전송하거나 운영 DB를 변경하지 않았다. 실제 봇 명령 전체의 새 수동 검증이나 모든 외부 계정/오래된 브라우저 탭의 동작을 보장하지 않는다. 비용 0원이나 무료 할당량 초과 시 과금 불가를 보장하는 결과도 아니다.

## 운영 및 복구

정적 사이트·Pages Functions는 기존 Site Deploy 워크플로로 함께 배포한다. 복구가 필요하면 Cloudflare의 이전 정상 배포를 사용하며 Vercel로 자동 전환하지 않는다. 별도로 보류한 포스타입 후원 기능은 이번 변경에 포함하지 않는다.

## 운영 반영 및 최종 삭제 결과

구현 커밋은 `58285d8a852e4d53e942dfe39a97c9214a31c2fa`다. [Project Validation](https://github.com/HanBeom98/tracking-sa/actions/runs/40139854782)과 [Site Deploy](https://github.com/HanBeom98/tracking-sa/actions/runs/40139853900)가 성공했다. 운영 build.txt의 같은 커밋을 확인했다. CI의 Python·권한·인증 브라우저 검사와 Cloudflare 업로드를 통과했으며 개인정보 정리 작업은 실행하지 않았다.

사용자가 Vercel 프로젝트 영구 삭제를 선택한 뒤 삭제를 실행했다. 삭제 후 홈·전적 페이지·Nexon 공개 메타데이터·SOOP는 200, 무서명 Discord 요청은 401, 64KiB 초과 요청은 413을 반환했다. Vercel 대표 주소 tracking-sa.vercel.app은 404다. 검사한 과거 배포 고유 주소 하나는 여전히 503 DEPLOYMENT_PAUSED 플랫폼 오류를 반환했다. 모든 과거 URL이 즉시 404가 된다고 주장하지 않으며, 해당 주소에서 애플리케이션을 제공하지 않는 상태와 프로젝트 삭제 UI를 각각 확인했다.

검증한 현재 서비스의 실행·배포 경로에서 Vercel 의존성을 제거했다. Git 기록·이전 단계 점검 문서의 Vercel 언급은 당시 상태를 기록한 것이므로 남긴다.

정책 근거: [Vercel 상업적 이용 기준](https://vercel.com/docs/limits/fair-use-guidelines#commercial-usage), [프로젝트 Pause 범위](https://vercel.com/docs/projects/managing-projects#pausing-a-project).
