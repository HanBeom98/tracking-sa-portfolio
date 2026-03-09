# AdSense Recovery Log

Last updated: 2026-03-09 (UTC)

## Goal
- Resolve "Low-value content" rejection by reducing low-quality indexable pages and strengthening trust/SEO signals.

## Step Status
- [x] Step 1: Index control hardening (`noindex` for low-value/admin/news pages + sitemap exclusion)
- [x] Step 2: Core SEO baseline upgrade (canonical + per-page description generation)
- [x] Step 3: Trust policy coverage (`Terms of Service` page added and footer linked)
- [x] Step 4: Trust page enrichment (About/Contact/Privacy operator info and update date)
- [~] Step 5: Content quality curation (news indexing blocked + direct UI exposure reduced; selective keep/remove pending)
- [~] Step 6: English page consistency cleanup (EN `data-i18n` fallback Korean removed; remaining quality polish optional)
- [~] Step 7: Deploy, Search Console validation and AdSense re-apply

## Changes Applied In This Round
- Added rule-based `noindex, nofollow` in HTML processor for:
  - News index/article pages
  - Auth signup / game admin / board write-edit-post pages
- Added canonical tag injection for all generated pages.
- Replaced generic repeated description behavior with path-aware description generation.
- Excluded low-value pages from sitemap generation.
- Added `terms` domain to build pipeline and sitemap eligibility.
- Added new `Terms of Service` page and footer link.
- Added shared translation keys for terms page/footer.
- Enriched `About`, `Contact`, `Privacy Policy` with operator identity, contact channel, and explicit update/effective date.
- Expanded static EN replacement map for shared navigation/common fallback text:
  - `게시판/차트/테스트/동물상 테스트/지수/게임/행운의 추천/AI 실시간 오늘의 운세` -> EN labels
- Rebuilt `public/` and validated that EN header/menu fallback labels no longer render in Korean.
- Added broad EN static fallback replacements for high-impact domains (home/about/contact/privacy/terms/board/futures/games).
- Validation result: EN `data-i18n` fallback Korean text scan = `0` (after rebuild).
- Reduced low-value news exposure on core UX:
  - Removed `/news/` direct link from global header navigation.
  - Removed news card from home "Insights" section, keeping glossary/futures tools.
  - Removed news recommendation from search empty-state suggestions.
  - Changed footer fallback text to neutral "서비스 제휴 문의".
- Live deploy validation completed on 2026-03-09 UTC:
  - `build.txt` confirms latest commit `e9d9aee2` deployed (`built_at_utc=2026-03-09T10:42:17Z`).
  - Core pages `/`, `/about/`, `/contact/`, `/privacy-policy/`, `/terms/` are `index, follow` with canonical.
  - `/news/` remains `noindex, nofollow` with canonical `/news/`.

## Verification Checklist (Next)
- [x] Build output regenerated (`public/` recompiled)
- [x] Confirm `meta robots` on blocked pages
- [x] Confirm sitemap no longer contains blocked paths/news articles
- [x] Confirm canonical and description correctness on sample pages
- [x] Confirm trust-page updates (`about/contact/privacy/terms`)
- [x] EN shared navigation fallback text replaced (header/menu/common cards)
- [x] EN `data-i18n` fallback Korean removed (global scan)
- [x] Live deploy reflected (`trackingsa.com` build/version and HTML checks)
- [x] Live robots/canonical checks for key pages
- [ ] Finalize content curation list (which news to keep vs archive if re-open indexing later)
- [ ] EN copy polish for phrasing consistency (non-blocking)
- [ ] Search Console: URL inspection for `/`, `/about/`, `/contact/`, `/privacy-policy/`, `/terms/`
- [ ] Submit AdSense re-review
