# Tracking SA

Tracking SA는 `서든어택 전적 검색`을 중심으로 게임 유틸리티, 테스트, 커뮤니티, 실용 도구를 함께 제공하는 멀티 서비스 허브입니다.

현재 핵심 제품은 `Sudden Attack Stats` 이며, 공식 공개 경로는 `/stats/sudden-attack/` 입니다. 기존 `/games/sudden-attack/` 경로는 외부 링크와 검색엔진 호환을 위해 유지되고 있습니다.

## Current Focus

- 대표 서비스: 서든어택 전적 검색
- 홈 정체성: 게임·도구·커뮤니티 허브
- 내부 소스 오브 트루스: `src/domains/stats/sudden-attack`
- 공식 공개 경로: `/stats/sudden-attack/`
- 호환 경로: `/games/sudden-attack/`

## Architecture

- Pragmatic DDD
  `domain`, `application`, `infra`, `ui` 계층을 기준으로 기능을 분리합니다.
- Source of Truth Build
  `src/` 를 기준으로 `public/` 산출물을 생성합니다.
- Compatibility Aliases
  공개 URL 이전 시 기존 링크가 깨지지 않도록 alias 경로를 유지합니다.

## Key Services

- Sudden Attack Stats
  공식 API 기반 전적 검색, 매치 기록, VS 비교, 크루 도구, 팀 밸런서
- Board
  공지사항/자유게시판 기반 커뮤니티
- AI Test / Fortune / Lucky Recommendation
  테스트형 및 생성형 기능
- Glossary / Futures Estimate
  실용 정보와 도구형 페이지

## Recent Updates

- `stats` 도메인으로 서든어택 소스 이전 완료
- 공식 공개 경로를 `/stats/sudden-attack/` 로 승격
- 구경로 `/games/sudden-attack/` 는 호환 유지
- 서든어택 application 레이어 분리
  시즌 뷰, 탈주 처리, 트렌드, 프로필 로더, 캐시, query orchestration 분리
- 검색 UX 개선
  최근 검색, 즐겨찾기, 즐겨찾기 기반 VS 비교 추가
- 프로필 캐시 정책 개선
  5분 TTL 안에서는 재검색 시 넥슨 API 재검증 없이 캐시만 사용

## Tech Stack

- Frontend: JavaScript (ES Modules), Web Components, Shadow DOM
- Backend / Data: Firebase Firestore, Nexon Open API
- Hosting: Cloudflare Pages
- Build: Python-based static site build pipeline

## Local Notes

- 빌드 결과물은 `public/`
- 불필요 산출물(`README.md`, `*.full`, `__pycache__`)은 퍼블릭 복사에서 제외
- 아키텍처 체크 스크립트:
  - `npm run check:ddd-boundary`
  - `npm run check:source-of-truth`

## Links

- Live: [https://trackingsa.com](https://trackingsa.com)
- Developer: [https://github.com/HanBeom98](https://github.com/HanBeom98)
