# Lessons Learned (Knowledge Base)

## [2026-02-22] Template Contamination Prevention
- **Issue**: Developer 에이전트가 새로운 컴포넌트를 생성할 때 기존 'Animal Face Test' 코드를 템플릿으로 오용하여 불필요한 코드를 섞는 현상 발생.
- **Root Cause**: 에이전트가 '안전한' 기존 코드를 참고하려다 발생한 과잉 참조.
- **Solution**: 
  - 신규 폴더 생성 시(`folder: [name]`), 기존 파일의 문맥을 가져오지 말고 **Zero-base**에서 시작하라.
  - "standalone", "independent" 키워드가 포함된 요청 시 기존 프로젝트의 전역 설정(translations.js 등) 외의 비즈니스 로직은 절대 포함하지 마라.

## [2026-02-22] Mandatory SEO & AdSense Metadata
- **Issue**: 신규 HTML 생성 시 검색 엔진 최적화 태그와 광고 수익화 준비 코드가 누락됨.
- **Solution**: 
  - 모든 `index.html`은 `project-conventions.md`에 정의된 표준 헤더 구조를 따라야 함.
  - `google-site-verification` 태그와 애드센스 주석 블록은 선택이 아닌 필수 사항임.
