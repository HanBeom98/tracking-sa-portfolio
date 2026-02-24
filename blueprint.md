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

### 1. DDD Core Restructuring
- **Domain Migration**: All features (Animal Face, AI Test, Fortune, News, Board, Games, etc.) migrated to `src/domains/`.
- **Shared Layer Optimization**: Global assets (JS/CSS/i18n) consolidated into `src/shared/assets/` and `src/shared/ui/`.
- **Path Standardization**: Unified entry points to `main.js` and established root-relative paths (`/xxx.js`) for all domain modules.
- **Redundancy Cleanup**: Eliminated legacy folders (`multi-agent-ai`, `core`, etc.) and consolidated multiple virtual environments into `.venv`.

### 2. Premium Module Overhaul
- **Animal Face Test**: Fully converted to `<animal-face-test>` Web Component.
- **AI Fortune**: Implemented premium report layout with Markdown parsing and 429 error handling.
- **Lucky Recommendation**: Reconstructed into a premium component with dynamic color visualization.
- **AI Tendency Test**: Redesigned with Premium Blue aesthetic (oklch colors) and integrated i18n support.
- **News Hub**: Restored magazine-style hero cards and fixed Firestore loading bugs.

### 3. Global UI/UX Optimization
- **Typography**: Applied global font smoothing and Pretendard font stack.
- **Navigation**: Restored global header/footer styles through the automated builder.

## 🚀 Current Focus & Next Steps
- [ ] Monitor Web Component performance and SEO crawling.
- [ ] Implement a unified "Logs" system to prevent root clutter.

## ⚠️ Lessons Learned
- **Path Resolution**: Always use absolute paths (`/`) for shared assets in deeply nested domain folders.
- **Shadow DOM Style Isolation**: Global styles don't bleed in; font-smoothing must be re-declared inside components.
- **Build Atomicity**: Nested domains (e.g., `games/tetris`) require `dirs_exist_ok=True` in Python's `copytree`.
