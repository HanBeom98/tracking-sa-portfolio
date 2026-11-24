# 무료 티어 중심 운영 원칙

적용일: 2026-10-23. 사용자의 목표는 **현재 규모에서 기존 서비스의 무료 할당량으로 운영하고 불필요한 비용을 만들지 않는 것**이다. 카드가 연결되어 있거나 종량제 요금제를 쓴다는 이유만으로 결제를 해제하거나 기존 기능을 다른 서비스로 옮기지 않는다. 호스팅·API·저장·분석·자동화 변경에 동일하게 적용한다.

## 변경 기준

- 기존 무료 할당량 안에서 해결하는 방안을 우선한다. 유료 업그레이드·새 부가 상품·원자료 내보내기·수집 서버를 기본 해결책으로 추가하지 않는다. 무료 크레딧이나 유료 전환 체험판을 지속 가능한 무료 대안으로 취급하지 않는다.
- 카드 연결·Firebase Blaze 사용 자체와 실제 과금 원인을 구분한다. 현재 사용량·무료 범위·초과 단가/중단 동작을 확인해 불필요한 호출·저장·로그·배포를 줄인다. 이번 원칙은 기존 카드 해제·요금제 하향·서비스 이전 지시가 아니다.
- 무료 한도 접근 시 캐시·요청 병합·호출 빈도 제한·수집 축소·기능 제한을 먼저 검토한다. 이것이 모든 제공자의 과금을 강제로 차단하는 장치라고 보장하지 않는다. 예산 알림도 실제 지출 상한과 구분한다.
- 측정 때문에 운영 DB나 Storage에 이벤트를 이중 저장하지 않는다. 새 예약 내보내기·과도한 자동 조회·외부 로그 저장소도 추가하지 않는다. 검증은 로컬/Emulator를 우선한다.
- 기존 기능의 비용 최적화는 원인을 확인한 뒤 작게 적용한다. 카드 해제·요금제 하향·데이터 삭제·동작 중지는 이 원칙만으로 수행하지 않는다. 사용자 기능과 데이터 접근을 유지한다.

## GA 설정과 별도 과금 자원의 구분

GA4 일반 버전의 맞춤 정의·탐색 구성은 설정마다 요금이 붙는 구조가 아니다. 이벤트 범위 맞춤 차원과 맞춤 측정항목에는 각각 50개의 설정 한도가 있다. 이번 등록은 차원 14개·측정항목 1개이며 저장된 탐색 1개에 7개 탭이 있다. 같은 이벤트 매개변수를 분석할 수 있게 등록한 것이며 7개 탭 때문에 이벤트를 7번 보내거나 사이트 API를 추가 호출하지 않는다. Analytics 360 유료 업그레이드는 하지 않는다.

BigQuery는 별도 저장·조회 자원으로 비용 검토가 필요하다. 현재 규모의 측정에는 필요성이 낮아 연결안을 철회하고 연결 목록이 비어 있음을 확인했다. 기존 GA 보고서에서 관측 가능한 건수·상태·결과 표시율을 수동 확인하거나 내보내 로컬에서 계산한다. 정확한 p50/p95·순서 있는 세션 비율을 채우려고 새 비용 구조를 추가하지 않는다. 상세 조건은 [측정 보고서](product-measurement-reports.md)를 따른다.

## 기존 구성에서 확인할 항목

소스 구성과 실제 계정의 요금제·청구액은 구분한다. 비공개 비용·계정 식별자·사용량은 저장소 밖 로컬 점검 기록에 보관한다. 현재 전체 비용 0원이나 한도 초과 시 자동 과금 차단을 검증 완료했다고 표현하지 않는다.

| 서비스/경로 | 현재 역할 | 무료 티어를 지키는 점검 방향 |
| --- | --- | --- |
| Cloudflare Pages | 정적 사이트 배포 | 정적 요청과 Functions/Workers 호출을 구분. 유료 상품을 추가하지 않고 실제 사용량과 플랜 확인 |
| Cloudflare Pages Functions API | functions/api/ 공용 API 핸들러. Vercel 전용 브리지·패키지 제거 | 기존 캐시·요청 병합 유지. 과도한 조회·자동 재시도·별도 분석 요청을 추가하지 않음 |
| Firebase Auth·Firestore | 계정·게시판·리그·Discord 세션 | 무료 읽기/쓰기·보관 범위와 실제 사용량 확인. 분석 이벤트 이중 저장 금지 |
| Firebase Storage | 게시판 첨부파일 등 | 보관량·다운로드·리전·할당량 확인. 현재 기능을 이유 없이 삭제하거나 요금제 하향하지 않음 |
| Firebase Cloud Functions | cleanupBoardPostComments, discordMatchSession | 호출 외 배포/보관 등 비용 원인도 구분. 비용 요약만으로 함수 호출이 원인이라고 단정하지 않음 |
| GA 측정 | 제품 이벤트 9종·탐색 7개 탭 | 기존 일반 버전 보고서 사용. BigQuery·360·수집 서버·예약 내보내기 추가 없음 |
| 도메인·기타 상품 | 기존 도메인·외부 연동 | 기존 등록/갱신 비용과 신규 기능 비용 구분. 새 상품·자동 유료 전환을 추가하지 않음 |

Firebase Cloud Functions 배포·Storage 사용에 Blaze가 필요하다는 공식 정책은 무료 할당량 내 사용이 불가능하다는 뜻이 아니다. 결제 계정 연결만으로 무료 할당량이 사라지는 것도 아니다. 현재 작은 규모에서 어느 자원이 실제 비용을 만드는지 먼저 확인하고 낭비를 줄인다. 분석 범위 조정과 운영 비용 점검은 구분하며 기존 서비스의 마이그레이션을 새 우선 작업으로 강제하지 않는다.

Vercel Hobby는 광고를 포함한 상업적 운영에 사용하지 않는다. 2026-10-25 Vercel 전용 코드·의존성을 제거하며, 외부 배포/콜백 상태는 [정리 기록](vercel-retirement.md)에서 구분한다. 유료 Vercel 플랜을 새로 도입하지 않는다.

## 공식 근거

2026-10-23 확인. 제공자의 요금제·한도는 바뀔 수 있으므로 비용 관련 변경 전에 공식 문서와 실제 계정을 확인한다.

- [Google Analytics 일반 버전 무료 도구 안내](https://marketingplatform.google.com/about/small-business/)
- [GA 맞춤 정의의 일반/360 설정 한도](https://support.google.com/analytics/answer/14240153?hl=ko)
- [GA 구성 한도와 한도 도달 시 동작](https://support.google.com/analytics/answer/12229528?hl=ko)
- [BigQuery 연결과 별도 비용](https://support.google.com/analytics/answer/9823238?hl=en)
- [Firebase 요금제·무료 할당량·예산 알림](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans)
- [Cloud Functions 배포의 Blaze 요구](https://firebase.google.com/docs/functions/get-started)
- [Firebase Storage 요금제 요구와 무료 범위](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024)
- [로컬 Emulator와 비용 점검](https://firebase.google.com/docs/projects/billing/avoid-surprise-bills)
- [Cloudflare 정적 요청과 Functions 구분](https://developers.cloudflare.com/pages/functions/pricing/)
- [Vercel Hobby 요금제와 한도](https://vercel.com/docs/plans/hobby)
