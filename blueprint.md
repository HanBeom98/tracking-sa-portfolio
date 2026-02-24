# Tracking SA Project Blueprint

## 🎯 Project Vision
Evolving Tracking-sa into a premium, framework-less web platform using a specialized 5-agent AI orchestration system and a strict DDD architecture.

## 🛠️ Tech Stack & Standards
- **Architecture**: Domain-Driven Design (DDD) with a clear separation of `src/domains` and `src/shared`.
- **UI System**: Web Components (Custom Elements) with Shadow DOM.
- **Styling**: Pure CSS with oklch colors, Container Queries, and -webkit-font-smoothing.
- **Backend**: Vercel Serverless Functions & Firebase Functions.
- **Build System**: Custom Python builder (`src/shared/infra/builder.py`) for automated asset injection and deployment.

## ✅ Completed Milestones (2026-02-24)

### 1. DDD Core Restructuring (Architecture 100%)
- **Domain Migration**: All features (Animal Face, AI Test, Fortune, News, Board, Games, etc.) migrated to `src/domains/`.
- **Shared Layer Optimization**: Global assets consolidated into `src/shared/assets/` and `src/shared/ui/`.
- **Path Standardization**: Unified entry points to `main.js` and established root-relative paths (`/xxx.js`) for all shared assets.
- **Code-level DDD Compliance**: Unified i18n access through a global `getTranslation` utility in `common.js`.
- **Automation & Logs**: Restored news generation in `src/shared/infra/news_manager.py` and implemented a unified log system in `/logs/`.

### 2. Premium Module Overhaul
- **Animal Face Test**: Fully converted to `<animal-face-test>` Web Component with standard i18n.
- **AI Fortune**: Implemented premium report layout with Markdown parsing and 429 error handling.
- **Lucky Recommendation**: Reconstructed into a premium component with dynamic color visualization.
- **AI Tendency Test**: Redesigned with Premium Blue aesthetic (oklch colors) and integrated i18n support.
- **News Hub**: Restored magazine-style hero cards and fixed Firestore loading bugs.

### 3. Global UI/UX Optimization
- **Typography**: Applied global font smoothing and Pretendard font stack.
- **Navigation**: Restored global header/footer styles through the automated builder.

## 🚀 Current Focus & Next Steps
- [ ] Monitor Web Component performance and SEO crawling.
- [ ] Refactor "AI Evolution 2048" logic for enhanced stability.

## ⚠️ Lessons Learned
- **Path Resolution**: Always use absolute paths (`/`) for shared assets in deeply nested domain folders.
- **UI Integrity**: Each domain `index.html` must explicitly link its local `style.css` if it exists.
- **Logging Strategy**: Centralize logs in a dedicated `/logs/` folder to maintain root directory cleanliness.
