## Stats Domain

This domain holds game-stat and match-history products that are larger than the
unrelated feature catalogs.

Current source of truth:
- `src/domains/stats/sudden-attack`

Current public route compatibility:
- Official public route is `/stats/sudden-attack/`
- This keeps existing links and SEO stable while the internal architecture moves
  toward a dedicated `stats` domain

Current product assumptions:
- `Sudden Attack Stats` is the primary product inside this domain
- repeated searches are expected, so profile cache behavior matters
- home and internal links should prefer `/stats/sudden-attack/`

Current profile cache policy:
- no cache: fetch fresh data
- cached within 5 minutes: return cache only, skip revalidation
- cached after 5 minutes: return cache first, then revalidate in background
- repeated identical requests reuse the in-flight fetch
- recent profile results are kept in memory for the current session

Current asset cache policy:
- shared assets use a build version query string
- page-local assets such as `ui/style.css` and `main.js` also use a build version query string
- relative JS module imports are rewritten with the same version during build output

This exists to prevent some users from seeing stale Sudden Attack UI components
after deployment while others already see the latest layout.

Current UX additions:
- recent searches
- favorite searches
- favorite-to-VS compare shortcut
- VS winner summary and metric-level comparison emphasis
- mobile and desktop layout polish for the stats UI

Cleanup policy:
- do not treat public compatibility aliases as dead code


Match-list component data contract:
- Assign record arrays to `sa-match-list.matchRecords`; assign `null` for the loading skeleton and `[]` for the empty state.
- `matches(selector)` remains the inherited browser CSS-selector method. Do not add a legacy `matches` data setter or overwrite native DOM methods.
- Domain/profile objects still use `matches` arrays. Only the custom-element input name changed.
- Local pagination and public remote pagination keep their existing behavior.


Compact result search:
- The result search card stays in normal document flow until scrolled past. It then docks below the shared header as a single row; its original slot preserves the result position.
- Search, VS and favorite tools remain available. The existing refresh button moves into the tools disclosure on narrow screens; search and cache handlers are reused.
- Favorite tools close on Escape or an outside pointer action. Focus is restored on Escape, and the full card returns when scrolling back or resetting the search.
- `ui/runtime/compact-search-controller.js` owns docking and disclosure state, coalesces scroll work with requestAnimationFrame, and retains the session for back/forward cache restoration. It adds no API calls or persistent data.
- Local browser coverage in `tests/e2e/local-smoke.spec.js` checks both themes, mobile/desktop layout, stable result position, keyboard search, refresh, favorites, VS focus, reset and viewport changes.


Replay presentation:
- The playback graph, round buttons and selected-scene summary share the existing playback frame. The summary shows only recorded events at or before the selected time; simultaneous events are grouped without inventing their order.
- Verified survivor counts are repeated as labeled bars. Unverified counts have no bar; uncertainty and the distinction between a match estimate and a situation index stay visible.
- Player rosters and event filters live in a native details disclosure. Opening or closing it does not restart playback, reset filters or make requests.
- Presentation changes do not alter parsing, match rules, re-entry recovery, AI access, network requests or PNG/PDF models.
