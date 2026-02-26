# Futures Error Code Mapping (2026-02-26)

## Scope
- 대상 페이지: `/futures-estimate/`
- 대상 API:
  - `POST /api/tv-scan` (`analysis`)
  - `GET /api/futures-predictions` (`history`)

## Error Code Source
- 생성 위치: `src/domains/futures-estimate/infra/futures-api-client.js`
- 에러 prefix:
  - `analysis_*`
  - `history_*`

## Transport-Level Error Codes
- Timeout: `${prefix}timeout`
- Network: `${prefix}network`
- HTTP: `${prefix}http_${status}`
- Empty payload(도메인 체크): `${prefix}empty`
- Unknown fallback: `${prefix}unknown`

## UI Mapping Rule
- 매핑 위치: `src/domains/futures-estimate/application/error-messages.js`
- 렌더 호출:
  - `analysis` -> `renderImpactAnalysisFailure(errorInfo)`
  - `history` -> `renderPredictionHistoryFailure(errorInfo)`

### Analysis Mapping
- `analysis_timeout` -> `futures_analysis_fail_timeout`
- `analysis_network` -> `futures_analysis_fail_network`
- `analysis_http_*` -> `futures_analysis_fail_http`
- `analysis_empty` -> `futures_analysis_fail_empty`
- default -> `futures_analysis_fail`

### History Mapping
- `history_timeout` -> `futures_history_fail_timeout`
- `history_network` -> `futures_history_fail_network`
- `history_http_*` -> `futures_history_fail_http`
- `history_empty` -> `futures_history_fail_empty`
- default -> `futures_history_fail`

## Translation Keys
- ko/en 키 위치: `src/shared/assets/translations.js`
- analysis:
  - `futures_analysis_fail`
  - `futures_analysis_fail_timeout`
  - `futures_analysis_fail_network`
  - `futures_analysis_fail_http`
  - `futures_analysis_fail_empty`
- history:
  - `futures_history_fail`
  - `futures_history_fail_timeout`
  - `futures_history_fail_network`
  - `futures_history_fail_http`
  - `futures_history_fail_empty`

## Operational Notes
- 신규 에러코드가 추가되면:
  1. `error-messages.js` 매핑 추가
  2. `translations.js` ko/en 키 추가
  3. `tests/unit/futures-error-messages.test.js` 케이스 추가
- HTTP status를 세분화 노출하려면(예: 429/503 구분), 현재 `*_http_*` 단일 키 매핑을 확장한다.
