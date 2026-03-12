## Legacy Path Notice

`src/domains/games/sudden-attack` is no longer the source of truth.

Use:
- `src/domains/stats/sudden-attack`

Why:
- Sudden Attack stats is now treated as a stats/product domain, not a casual
  game-page subfeature.
- Public compatibility is still preserved at `/games/sudden-attack/` by the
  build pipeline.
