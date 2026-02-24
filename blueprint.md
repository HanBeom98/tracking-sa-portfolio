# Tracking SA Project Blueprint

## 🎯 Project Vision
Evolving Tracking-sa into a premium, framework-less web platform using a specialized 5-agent AI orchestration system.

## 🛠️ Tech Stack & Standards
- **Architecture**: Web Components (Custom Elements) with Shadow DOM.
- **Styling**: Pure CSS with oklch colors, Container Queries, and -webkit-font-smoothing.
- **Backend**: Vercel Serverless Functions (Node.js).
- **Build System**: Custom Python builder (`main.py`) for SEO, AdSense, and i18n injection.

## ✅ Completed Milestones (2026-02-24)

### 1. Premium Module Overhaul
- **Animal Face Test**: Fully converted to `<animal-face-test>` Web Component. Fixed UI flickering and restored sharing/download features.
- **AI Fortune (Today's Fortune)**: Implemented premium report layout with Markdown parsing. Added 429 Rate Limit error handling.
- **Lucky Recommendation**: Reconstructed into a premium component with dynamic color visualization and absolute API paths.
- **News Hub**: Restored magazine-style hero cards and grid layout. Fixed Firestore data loading bugs (NoneType handling).
- **AI Tendency Test**: Redesigned with Premium Blue aesthetic (oklch colors), integrated i18n support (`translations.js`), and migrated to DDD structure (`src/domains/ai-test`).

### 2. Global UI/UX Optimization
- **Typography**: Applied global font smoothing and Pretendard font stack for crystal clear text rendering.
- **Home Page**: Implemented "Minimalist Hub" mode. Navigation is hidden on the home page but utility buttons (Theme/Lang) are preserved.
- **Navigation**: Restored global header/footer styles that were lost during modularization.

### 3. Orchestrator Intelligence
- **Resilience**: Fixed TypeError in Reviewer feedback parsing.
- **File System**: Added support for nested path saving (`path/to/file.js`) within the agent loop.
- **Compliance**: Updated prompts to strictly enforce Shadow DOM standards and Design-First principles.

## 🚀 Current Focus & Next Steps
- [ ] Monitor Web Component performance and SEO crawling.

## ⚠️ Lessons Learned
- **Cache Busting**: Always use version strings (`?v=...`) when updating JS modules to force browser refresh.
- **Defensive Build**: Always check for `None` values when pulling data from Firestore to prevent entire site build failures.
- **Shadow DOM Style Isolation**: Global styles don't bleed in; font-smoothing must be re-declared inside components.
