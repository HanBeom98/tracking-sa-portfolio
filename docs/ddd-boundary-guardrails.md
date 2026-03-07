# DDD Boundary Guardrails (Day 1)

## Scope
- Target: `src/domains/**/application/*.js`
- Goal: Prevent additional layer leaks while refactoring existing debt.

## Hard Rules
- `application` 레이어는 아래 API를 직접 사용하지 않는다.
- 금지: `window.*`
- 금지: `document.*`
- 금지: `alert()`, `confirm()`, `prompt()`
- 금지: `.innerHTML`

## Enforcement
- Command: `npm run check:ddd-boundary`
- Script: `scripts/check-ddd-boundary.js`
- Current violations are tracked as temporary baseline (`ALLOWED_LEGACY_FILES`) and treated as debt.
- Any new violating file fails the check immediately.

## Review Checklist
- PR에서 `application` 파일 변경 시 `npm run check:ddd-boundary` 결과를 확인했다.
- `application`은 데이터 조합/규칙 계산만 수행하고, DOM 접근은 `ui` 또는 `main` wiring에서만 수행한다.
- 인증/번역/라우팅 접근은 `Port` 또는 주입된 함수 경유인지 확인한다.
- 새로 추가한 `application` 파일에 브라우저 전역 접근이 없는지 확인한다.

## Next Step (Day 2+)
- `AuthPort`, `I18nPort`, `NavigationPort`를 정의해 `application`의 브라우저 의존을 주입형으로 전환.
- baseline 파일을 순차 제거하며 허용 목록을 축소.
