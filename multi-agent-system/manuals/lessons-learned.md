# Lessons Learned (Knowledge Base)

## [2026-02-22] Template Contamination Prevention
- **Issue**: Developer 에이전트가 새로운 컴포넌트를 생성할 때 기존 'Animal Face Test' 코드를 템플릿으로 오용함.
- **Solution**: 신규 폴더 생성 시 Zero-base에서 시작하고, 독립성(standalone)을 유지하라.

## [2026-02-22] Mandatory SEO & AdSense Metadata
- **Issue**: 신규 HTML 생성 시 검색 엔진 최적화 태그와 광고 코드가 누락됨.
- **Solution**: `project-conventions.md`의 표준 헤더 구조를 반드시 준수하라.

## [2026-02-22] Full System Integration Checklist (CRITICAL)
- **Issue**: 기능을 만들어도 메뉴에 연결되지 않거나 빌드에서 누락됨.
- **Mandatory Action**: 새 기능을 추가할 때는 반드시 다음 3곳을 동시 수정하라:
  1. **`main.py`**: `STATIC_PAGES_FOR_SITEMAP` 및 `asset_dirs`에 폴더명 추가.
  2. **`main.py`**: `COMMON_BODY_INJECTIONS`의 헤더 메뉴에 링크 추가 (경로 끝에 `/` 필수).
  3. **`translations.js`**: 메뉴 이름 및 관련 문구의 번역(ko/en) 추가.
- **Path Rule**: 모든 내부 링크는 리다이렉트 방지를 위해 끝에 슬래시를 포함하라 (예: `/feature/`).
