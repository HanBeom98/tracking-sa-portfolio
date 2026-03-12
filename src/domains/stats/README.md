## Stats Domain

This domain holds game-stat and match-history products that are larger than the
casual `games` catalog.

Current source of truth:
- `src/domains/stats/sudden-attack`

Current public route compatibility:
- Official public route is `/stats/sudden-attack/`
- Legacy compatibility is still preserved at `/games/sudden-attack/`
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

Current UX additions:
- recent searches
- favorite searches
- favorite-to-VS compare shortcut

Cleanup policy:
- keep `/games/sudden-attack/` until redirect migration is ready
- do not treat public compatibility aliases as dead code
