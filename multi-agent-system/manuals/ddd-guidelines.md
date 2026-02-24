# DDD & Business-Oriented Architecture Guidelines

우리의 프로젝트는 기술적인 파일 계층이 아닌, **비즈니스 도메인(기능 단위)**을 중심으로 관리된다. 모든 에이전트는 코드를 짤 때 이 구조를 엄격히 준수해야 한다.

## 🏗️ Core Structure (Domain-Driven)

### 1. `shared/` (공통 도메인)
- **`ui/`**: 프로젝트 전체에서 사용하는 공통 UI 부품 (글로벌 헤더, 푸터, 내비게이션, 공통 모달 등).
- **`design-system/`**: 프로젝트의 심장. `oklch` 컬러 정의, 타이포그래피, 베이스 레이아웃 CSS.
- **`infra/`**: 파일 시스템, Firestore 연결, 공통 SSG 빌드 엔진 로직.

### 2. `domains/` (비즈니스 도메인)
각 서비스는 서로의 존재를 모른 채 독립적으로 존재해야 한다.
- **`news/`**: 뉴스 수집, 정렬, 매거진 레이아웃, 페이징 비즈니스 로직.
- **`fortune/`**: 운세 분석 로직, 사주 풀이 UI 컴포넌트.
- **`animal-face/`**: 이미지 분석, 결과 렌더링 로직.
- **`games/`**: 게임별 독립 로직 (테트리스, 2048 등).

### 3. `app/` (애플리케이션 계층)
- 각 도메인을 조합하여 실제 페이지를 조립하는 최종 단계.

## ⚠️ Mandatory Rules for Agents
1. **No Shared Style Leaking**: 서비스 전용 스타일은 절대 루트 `style.css`에 넣지 마라. 오직 `domains/[domain]/style.css`에서 관리하되, 빌드 시 결합된다.
2. **Global Navigation First**: 내비게이션은 `shared/ui/`에서 관리되며, 그 어떤 도메인 로직도 내비게이션의 가시성을 해칠 수 없다.
3. **Build Engine Independence**: `core/builder.py`는 도메인별 데이터를 받아서 조립하는 '공장' 역할만 한다. 비즈니스 로직(정렬, 페이징 등)은 각 도메인 폴더 안으로 이동시켜라.
4. **Folder Naming**: 폴더명은 반드시 비즈니스 개념(예: `animal-face`)을 사용하며, `logic`, `ui` 같은 기술적 용어만으로 폴더를 구성하지 않는다.
