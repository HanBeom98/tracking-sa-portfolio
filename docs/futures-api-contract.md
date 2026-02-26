# Futures API Contract (2026-02-26)

## Endpoints

### 1) `POST /api/tv-scan`
- Purpose: 야간 영향 분석표 데이터 반환.
- Request body:
```json
{
  "tickers": ["AMEX:SPY", "NASDAQ:QQQ", "AMEX:DIA", "FX_IDC:USDKRW", "TVC:GOLD", "BITSTAMP:BTCUSD"]
}
```
- `tickers`는 optional이며, 누락 시 기본 6종을 사용한다.

- Success response (`200`):
```json
{
  "items": [
    {
      "symbol": "AMEX:SPY",
      "name": "SPY",
      "close": 510.12,
      "change": 0.81,
      "signal": "상승 기여",
      "score": 1,
      "weighted": 0.1321
    }
  ],
  "totalScore": 1.23,
  "probabilityUp": 56.78,
  "verdict": "중립",
  "model": "logistic_regression",
  "samples": 140,
  "target": "EWY",
  "updatedAt": "2026-02-26T08:00:00.000Z"
}
```

- Error response (`500`):
```json
{
  "error": "scanner_http_500"
}
```

### 2) `GET /api/futures-predictions`
- Purpose: 예측 vs 실제 비교표 데이터 반환.

- Success response (`200`):
```json
{
  "items": [
    {
      "target_date": "2026-02-26",
      "prediction_label": "up",
      "actual_label": "down",
      "status": "evaluated",
      "is_hit": false,
      "probability_up": 61.24
    }
  ]
}
```

- Field defaults:
  - `target_date`: `""`
  - `prediction_label`: `"-"`
  - `actual_label`: `"-"`
  - `status`: `"predicted"`
  - `is_hit`: `null`
  - `probability_up`: `null`

- Error response (`500`):
```json
{
  "error": "missing_service_account_json"
}
```

## Contract Tests
- `tests/unit/futures-api-contract.test.js`
  - `tv-scan` 성공 응답 스키마 계약 검증
  - `futures-predictions` Firestore 문서 -> API item 매핑 계약 검증

## Related
- 에러코드/문구 매핑: `docs/futures-error-code-mapping.md`
