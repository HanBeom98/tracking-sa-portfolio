## Stats Domain

This domain holds game-stat and match-history products that are larger than the
casual `games` catalog.

Current source of truth:
- `src/domains/stats/sudden-attack`

Current public route compatibility:
- Built output is still published to `/games/sudden-attack/`
- This keeps existing links and SEO stable while the internal architecture moves
  toward a dedicated `stats` domain
