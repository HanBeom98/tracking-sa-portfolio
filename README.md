# 🚀 TrackingSA: AI-Native Autonomous Web Platform

> **"LLM 기반 멀티 에이전트 시스템이 스스로 뉴스를 큐레이션하고 라이프스타일 서비스를 제공하는 자율형 웹 플랫폼"**

TrackingSA는 프레임워크 없이(Framework-less) 순수 웹 표준 기술과 최신 AI 에이전트 설계를 결합하여 구현한 기술 뉴스 및 인터랙티브 테스트 플랫폼입니다. 매일 자동으로 전 세계 테크 뉴스를 분석하고, 사용자의 정보를 바탕으로 한 맞춤형 AI 운세와 행운 추천 서비스를 제공합니다.

---

## 🛠️ Key Technical Highlights (이력서 핵심 포인트)

### 1. 자율형 멀티 에이전트 시스템 설계 (`multi-agent-system`)
- **Orchestration:** Planner, Developer, Reviewer로 구성된 에이전트 체인을 설계하여 단순 코드 생성을 넘어 **계획-구현-검증** 프로세스를 자동화했습니다.
- **REST API Integration:** SDK 의존성을 낮추기 위해 Gemini 2.0 Flash REST API를 직접 fetch 방식으로 구현하여 안정적인 통신 환경을 구축했습니다.

### 2. Modern Web Standards & Framework-less
- **Web Components:** Shadow DOM을 활용한 캡슐화로 프레임워크 없이 재사용 가능한 UI 컴포넌트를 설계했습니다.
- **Advanced CSS:** oklch 컬러 스페이스, CSS Variables, Container Queries, `:has()` 선택자 등 최신 Baseline 기능을 적용하여 고도화된 미학적 UX를 구현했습니다.

### 3. Localization & Scalability
- **i18n:** 한국어와 영어 다국어 지원 시스템을 직접 구현하여 글로벌 서비스 확장성을 확보했습니다.
- **Automated Pipeline:** Python 기반 빌드 스크립트를 통해 기사 수집, AI 요약, HTML 생성, 사이트맵 업데이트까지 전 과정을 자동화했습니다.

---

## 📅 Project History & Changelog

### **2026.02.22 - AI 에이전트 고도화 및 개인화 서비스**
- **행운의 컬러 & 아이템 추천 (AI Lucky Recommendation):** 사용자로부터 이름, 성별, 생일을 입력받아 Gemini AI가 개인화된 행운 정보를 JSON으로 생성 및 렌더링하는 Web Component 구현.
- **에이전트 체인 업그레이드:** 프로젝트 루트의 맥락을 스스로 읽고 판단하는 Deep Context 에이전트 로직 도입.
- **Vercel Serverless Function:** API Key 보안을 위해 클라이언트 호출 방식을 서버리스 프록시 방식으로 전면 전환.

### **2026.02.20 - 인터랙티브 AI 서비스 확장**
- **AI 오늘의 운세 (Daily Fortune):** 수만 개의 사주 데이터를 학습한 AI가 실시간으로 운세를 풀이해 주는 인터랙티브 기능 런칭.
- **다국어 시스템 완비:** 전 페이지 한국어/영어 전환 시스템 적용.

### **2026.02.15 - 컴퓨터 비전 AI 통합**
- **AI 동물상 테스트 (Animal Face Test):** Teachable Machine과 TensorFlow.js를 활용하여 사용자의 사진을 분석하고 가장 닮은 동물을 찾아주는 온디바이스 AI 기능 구현.

### **2026.02.02 - 플랫폼 초기 런칭**
- **AI News Aggregator:** TechCrunch 등 주요 테크 Feed를 수집하여 LLM이 분석한 인사이트와 수익화 아이디어를 함께 제공하는 자동 뉴스 플랫폼 구축.
- **Responsive Design:** 프리미엄 블루 그라데이션 기반의 모바일 퍼스트 반응형 웹 디자인 적용.

---

## 💻 Tech Stack
- **Languages:** JavaScript (ES6+), Python 3.x, HTML5, CSS3 (Modern Baseline)
- **AI/ML:** Gemini 2.0 Flash API, TensorFlow.js, Teachable Machine
- **DevOps:** Vercel, Cloudflare Functions, Python Build Automation
- **Design:** oklch Color Space, Web Components (Custom Elements)

---

## 🔗 Contact & More
- **Repository:** [HanBeom98/tracking-sa](https://github.com/HanBeom98/tracking-sa)
- **Live Demo:** [trackingsa.com](https://trackingsa.com)
