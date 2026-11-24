# 프로젝트 문서 목차

2026-11-07 갱신. [프로젝트 소개](../README.md)에서 기능을 살펴보고, 아래에서 작업 목적에 맞는 문서를 선택한다. 문서 파일명은 기존 코드·링크 호환을 위해 유지한다.

## 먼저 읽을 문서

### 공개 포트폴리오 안내 · 2026.11.24

- [구조·데이터 모델·유저 플로우](portfolio-system-design.md): 원본 코드에 근거한 그림 4종
- [핵심 API 명세](portfolio-api.md): 요청·응답·인증·캐시·실패 처리와 Firebase SDK 계약
- [문제 해결 사례](portfolio-case-studies.md), [공개판 범위](portfolio-snapshot.md), [공개판 검증 기록](portfolio-verification.md)

### 운영·개발 문서

| 목적 | 문서 | 역할 |
| --- | --- | --- |
| 지금 제공하는 기능과 준비 상태 | [현재 상태](current-status.md) | 공개 기능·TEST·실제 판매 경계, 확인 시점 |
| 이번 유지보수 완료 범위 | [2026-11-07 결과](maintenance-2026-11-07.md) | 9개 항목·확인 커밋·검사 범위와 후속 운영 확인 |
| 설치·검사·배포 | [개발·검증](development.md) | 개발 환경·원본/산출물·명령별 검사 범위 |
| 비용 원칙 | [무료 티어 운영](free-operation-policy.md) | 서비스 변경·외부 호출·사용량 확인 기준 |
| 상품 제공·환불 | [판매 조건 확정안](replay-coaching-sales-conditions.md) | 현재 판매 예정 구성·제공 기한·환불 기준 |
| 토스 심사 경로 | [재심사 체크리스트](tosspay-reapplication-checklist.md) | 비회원 TEST 진입·공유 한도·기존 보완 이력 |
| 사이트 관리 | [관리자 대시보드](admin-dashboard.md) | 관리자 권한·공지·신청 처리·제한 조회·검증 범위 |

문서의 **구현 완료·로컬 검증·운영 배포·실제 판매 활성화**는 서로 다른 상태다. 날짜가 붙은 수치·가격 비교·검증 건수는 당시의 근거로 읽는다. 과거의 50회·월 구독·접근코드 전용 경로가 현재 상품 조건을 대체하지 않는다. 충돌하면 현재 상태의 근거 파일과 확정 조건을 대조하고, 오래된 문장만으로 운영 설정을 변경하지 않는다.

## 무료 리플레이와 사용자 안내

| 문서 | 범위 |
| --- | --- |
| [공개 사용자 가이드](https://trackingsa.com/guides/replay-analysis-guide/) · [원본](../src/domains/guides/replay-analysis-guide/index.html) | JSON 준비·한 경기/비교 선택·샘플 계산·한계 |
| [상황 분석 기준](replay-context-analysis.md) | 규칙 기반 해석과 검증 범위 |
| [경기 흐름 재생](replay-playback.md) | 지수·이탈/재입장 복원·장면 이동·이미지 |
| [화면 상태와 수명주기](replay-workspace.md) | 파일·분석 세션, 전력 조회, 이미지/PDF 출력, 로컬 미리보기의 상태 소유권·해제 조건 |
| [빠른 시작·샘플 체험](replay-fast-start.md) | 즉시 기본 분석·별도 전력 조회·비교 지연 로딩 |
| [시작·결과 화면 폴리싱](replay-polishing.md) | 입력과 핵심 장면 우선 배치, 모바일 2열 수치, 3개 결과 바로가기. 구현과 로컬 검증 근거 |
| [홈에서 리플레이 바로 시작](home-replay-entry.md) | 닉네임 검색과 JSON 첨부 구분, 파일 재선택 없는 기기 내 분석·비교 연결. 구현과 로컬 검증 근거 |
| [홈 브랜드 디자인·한 선 그래프](home-brand-single-line.md) | 실제 가상 샘플 미리보기, 입력 우선 배치, 50 기준의 한 선 표시와 PNG |
| [인쇄·PDF 보고서](replay-print-report.md) | 한 경기 요약·검증 지표·전체 라운드의 인쇄 미리보기와 검증 범위 |
| [발전 체크리스트](replay-development-checklist.md) | 기존 6단계 완료 근거와 후속 보완 기록. 새 작업 전체의 단일 일정표는 아님 |

## AI 해설: 내부 구현·시험 문서

아래는 유료 AI를 판매 중이라는 안내가 아니다. 내부 계약·로컬 검증과 이전 품질 시험을 구분해 읽는다. 실제 외부 호출은 비용·권한 확인이 별도로 필요하다.

| 묶음 | 문서 |
| --- | --- |
| 현재 계약과 근거 | [사실·조언 ID 선택](replay-coaching-facts.md), [전 라운드 복기](replay-coaching-review.md), [근거 연결](replay-coaching-evidence.md), [해설 깊이](replay-coaching-depth.md) |
| 서버·공급자 연결 | [서버 기반](replay-coaching-server.md), [유료 API](replay-coaching-paid-api.md), [공급자](replay-coaching-provider.md), [API 준비](replay-coaching-api-setup.md) |
| 비용·정산 | [비용 설계](replay-coaching-cost-plan.md), [예산 상한](replay-coaching-budget.md), [정산·예약 복구](replay-coaching-settlement.md) |
| 미리보기·실험 | [로컬 모의 화면](replay-coaching-local.md), [미리보기](replay-coaching-preview.md), [월간 모의 권한 기록](replay-coaching-access.md) |
| 품질 검증 이력 | [규칙·모의 문장](replay-coaching-quality.md), [소량 실제 생성 시험](replay-coaching-pilot.md) |

## 이용권·구매·토스페이

| 문서 | 범위 |
| --- | --- |
| [제공·환불 조건](replay-coaching-sales-conditions.md) | 20회·3,300원·365일의 확정된 판매 예정 문안 |
| [상품 해설 결과 예시](replay-product-example.md) | 가상 샘플·수동 선택으로 만든 정적 결과 구성과 현재 계약 대조·검증 범위 |
| [재심사 체크리스트](tosspay-reapplication-checklist.md) | 현재 비회원 TEST와 이전 반려·보완 이력 |
| [토스 API 연결 기록](replay-coaching-tosspay.md) | 공식 API·TEST 승인·취소 검증 이력. 이전 50회 사례 포함 |
| [횟수권 원장](replay-coaching-credits.md) | 구매·예약·차감·실패 복구·환불 경계 |
| [운영 구매 연결 준비](replay-coaching-production-purchase.md) | 공개 TEST와 구분된 운영 경로 구현·활성화 전 조건 |
| [구매 조건 확인 기록](replay-coaching-purchase-acknowledgement.md) | 미리보기용 동의 스냅샷과 실제 판매 동의의 구분 |
| [구매 내역·잔액](replay-coaching-purchase-history.md) | 회원별 조회와 로컬 검증 |
| [유효기간](replay-coaching-validity.md) | 결제 완료 시각 기준 365일 처리 |
| [환불 손익 검토 이력](replay-coaching-refund-economics.md) | 당시 요율·취소 비용의 미확인 항목과 과거 구성. 현재 확정 요율표가 아님 |

## Discord 봇

| 문서 | 범위 |
| --- | --- |
| [전적·리플레이 봇 개편](discord-bot-renewal.md) | 글로벌 명령 세 개·기본 채널 공개/나만 보기·구형 어댑터·원복·검증 이력 |

## 측정·보안·운영

| 문서 | 범위 |
| --- | --- |
| [VS 비교 지표·구간](vs-comparison.md) | 중복 K/D 제거·선택 구간·표본·빈 값·리그 비교 범위 |
| [공개 전적 결과 구성](public-search-result-workspace.md) | 기존 지표 보존·결과 탭·활동 지연 조회와 캐시·선택 날짜 유지. 구현·로컬 검증 상태 |
| [매치 목록 조회·캐시](match-list-queries.md) | 공급자 조회 범위·공통 캐시·활동 달력·더 보기·리그 보존 범위 |
| [이벤트 명세](product-measurement.md) | 측정 정의와 수집 범위 |
| [이벤트 전송 기반](product-analytics-runtime.md) | 공통 전송과 공개 검색·행동 연결 |
| [운영 수신 검증](product-measurement-verification.md) | 통제된 GA 수신 확인과 한계 |
| [보고서·기준 데이터](product-measurement-reports.md) | 당시 자료와 일반 이용 표본 미충족 등 남은 측정 한계 |
| [Google 자격증명 점검](google-cloud-credential-checklist.md) | 날짜가 있는 점검 기록. 완료 표시는 본문 확인 |
| [보안 후속 기록](security-follow-up-2026-07-22.md) | 2026-07-22 점검과 미완료 항목 구분 |
| [게시판 개인정보 이전](../scripts/board-privacy-migration.md) | 별도 관리 작업 절차. 문서 정리로 실행하지 않음 |

## 개선 사례·이전 결정

아래는 당시 문제·재현·판단·검증의 기록이다. 성능 수치는 명시한 조건의 결과이며 최신 운영 지표로 재사용하지 않는다. 미완료 체크는 문서 정리로 완료 처리하지 않는다.

| 묶음 | 문서 |
| --- | --- |
| 모바일 흐름 | [점검](mobile-flow-audit.md) → [구현](mobile-flow-improvements.md) → [배포 확인](mobile-flow-release.md), [포트폴리오 사례 초안](case-study-mobile-sharing.md) |
| 첫 화면 성능 | [스크립트 지연](home-first-render.md), [홈 CSS 전달](home-css-delivery.md) |
| 리팩토링 | [2026-11-07 유지보수 결과](maintenance-2026-11-07.md), [2026-10-25 코드 점검·후속 기록](code-audit-2026-10-25.md) |
| 호스팅 이전 | [Vercel 의존성 정리](vercel-retirement.md) |
| 콘텐츠·공지 | [콘텐츠 가치 로드맵](adsense-value-roadmap.md), [공지 초안](adsense-notice-drafts.md), [2026-07-19 업데이트 공지](notices/2026-07-19-sudden-attack-update.md) |
| 종료된 후원 | [과거 후원 설계](voluntary-support.md). 사이트 기능은 종료했으며 재도입 지침이 아님 |
| 정리 전 소개 | [2026-10-28 README 보관본](archive/readme-before-docs-cleanup-2026-10-28.md). 섞여 있던 구현·측정 이력을 보존 |

## 폴더별 안내와 관리 규칙

- [브라우저 검사](../tests/e2e/README.md), [Emulator 검사](../tests/emulator/README.md), [stats 도메인](../src/domains/stats/README.md), [저장소 작업 지침](../AGENTS.md).
- 새로운 문서는 이 목차에 등록한다. 현재 명세는 해당 기능 문서에 갱신하고, 날짜별 실험·검증은 근거와 제한을 함께 남긴다.
- README에는 현재 소개·진입점만 둔다. 상세 테스트 로그·한도 조정 이력을 계속 덧붙이지 않는다.
- 경로를 바꾸거나 보관본을 만들 때는 상대 링크와 이미지 경로를 확인한다. 종료된 기능의 문서를 삭제해 설계 이력을 잃거나 현재 기능으로 다시 안내하지 않는다.
