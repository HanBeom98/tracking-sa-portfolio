# AdSense Recovery Log

Last updated: 2026-03-09 (UTC)

## Goal
- Resolve "Low-value content" rejection by reducing low-quality indexable pages and strengthening trust/SEO signals.

## Step Status
- [x] Step 1: Index control hardening (`noindex` for low-value/admin/news pages + sitemap exclusion)
- [x] Step 2: Core SEO baseline upgrade (canonical + per-page description generation)
- [x] Step 3: Trust policy coverage (`Terms of Service` page added and footer linked)
- [x] Step 4: Trust page enrichment (About/Contact/Privacy operator info and update date)
- [ ] Step 5: Content quality curation (keep only high-quality news set; demote/remove weak posts)
- [ ] Step 6: English page consistency cleanup (leftover Korean labels on EN pages)
- [ ] Step 7: Deploy, Search Console validation and AdSense re-apply

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

## Verification Checklist (Next)
- [x] Build output regenerated (`public/` recompiled)
- [x] Confirm `meta robots` on blocked pages
- [x] Confirm sitemap no longer contains blocked paths/news articles
- [x] Confirm canonical and description correctness on sample pages
- [x] Confirm trust-page updates (`about/contact/privacy/terms`)
- [ ] Start content curation list (which news to keep vs demote, if re-open indexing later)
- [ ] Search Console: URL inspection for `/`, `/about/`, `/contact/`, `/privacy-policy/`, `/terms/`
- [ ] Submit AdSense re-review
