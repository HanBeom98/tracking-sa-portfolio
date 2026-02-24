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

### 1. Structure Consolidation (Partial)
- **Feature Migration**: Features grouped under `src/domains/` by page/feature.
- **Shared Layer**: Global assets consolidated into `src/shared/assets/` and `src/shared/ui/`.
- **Path Standardization**: Root-relative paths (`/xxx.js`) used for shared assets.
- **Automation & Logs**: Restored news generation in `src/shared/infra/news_manager.py` and implemented a unified log system in `/logs/`.

### 2. Premium Module Overhaul (In Progress)
- **Animal Face Test**: Converted to `<animal-face-test>` Web Component with standard i18n.
- **AI Fortune**: Implemented premium report layout with Markdown parsing and 429 error handling.
- **Lucky Recommendation**: Reconstructed into a premium component with dynamic color visualization.
- **AI Tendency Test**: Redesigned with Premium Blue aesthetic (oklch colors) and integrated i18n support.
- **News Hub**: Restored magazine-style hero cards and fixed Firestore loading bugs.

### 3. Global UI/UX Optimization
- **Typography**: Applied global font smoothing and Pretendard font stack.
- **Navigation**: Restored global header/footer styles through the automated builder.
- **Spacing**: Added global main padding to prevent header/content crowding.
- **Language Switcher**: Stabilized button layout to avoid position shifts.
- **AI Tendency Test**: Fixed English i18n keys and reduced UI scale to match fortune page.
- **Animal Face Test**: Removed placeholder header/footer and invalid navigation script.

## 🧭 Architecture Reality Check (2026-02-24)
- **DDD folder names exist, but DDD layers do not**: `src/domains` currently maps to pages/features, not `domain/application/infrastructure` layers.
- **Mixed concerns**: UI rendering, data access, and auth logic are combined in single files (example: `src/domains/board/post/main.js`).
- **Shared infra is centralized**, but is not accessed through domain-facing interfaces or use cases.

## 🚀 Prioritized Next Steps
1. **Define DDD Target Shape (High Impact, Low Risk)**
   - Establish layer conventions per domain: `domain/`, `application/`, `infra/`, `ui/`.
   - Decide on shared cross-domain boundaries (`src/shared/infra`, `src/shared/ui`, `src/shared/domain` if needed).
2. **Refactor One Pilot Domain (High Impact, Medium Risk)**
   - Start with `board`: extract domain models + application services from `main.js`.
   - Introduce a repository interface and move Firestore access into infra.
3. **Create Consistent Entry Points (Medium Impact, Low Risk)**
   - Each page `main.js` becomes thin orchestration, calling application services only.
   - Move UI into Web Components where feasible.
4. **Shared Utilities Cleanup (Medium Impact, Low Risk)**
   - Consolidate cross-domain helpers into `src/shared` with clear ownership.
5. **Incremental Migration Plan (Medium Impact, Medium Risk)**
   - Apply the pattern domain-by-domain with minimal UI regression risk.

## 🔭 Current Focus
- [ ] Finalize DDD target layer template.
- [ ] Build a pilot refactor plan for the `board` domain.
- [x] Apply global centering fallback for body-level content (exclude game pages).
- [x] Rebuild public output after layout fix.
- [x] Ensure homepage excludes global navigation header.
- [x] Restore animal-face main component tag and module script.
- [x] Add stricter main centering rule for non-game pages.
- [x] Remove inline style.css injection to prevent layout flicker.
- [x] Wrap fortune/lucky content in container for consistent centering.
- [x] Center container blocks globally to prevent left-shift.
- [x] Move Pretendard font load to head to reduce layout shifts.
- [x] Move build stamp generation into build pipeline (CF Pages compatible).
- [x] Normalize animal-face route and add redirect from legacy path.
- [x] Remove animal-face local CSS and inline body overrides to align nav.
- [x] Restore Teachable Machine scripts for animal-face functionality.
- [x] Add English translations for AI tendency test intro.
- [x] Reduce AI tendency test UI scale to match fortune.
- [x] Add global main padding (top/bottom) for consistent page spacing.
- [x] Fix AI tendency test English keys and result/reset labels.
- [x] Stabilize language switcher width to prevent button shift.
- [x] Clean animal-face page: remove placeholder header/footer and invalid nav script.
- [x] Style footer for consistent layout.
- [x] Expose translations on window for AI test component.
- [x] Restore scheduled news generation in GitHub Actions (schedule only).

## ⚠️ Lessons Learned
- **Path Resolution**: Always use absolute paths (`/`) for shared assets in deeply nested domain folders.
- **UI Integrity**: Each domain `index.html` must explicitly link its local `style.css` if it exists.
- **Logging Strategy**: Centralize logs in a dedicated `/logs/` folder to maintain root directory cleanliness.
