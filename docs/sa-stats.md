# Sudden Attack Stats

## Purpose

`Sudden Attack Stats` is the main product inside Tracking SA.

It provides:
- player profile search
- recent match history
- VS comparison
- crew ranking and tools
- team balancer

## Source Of Truth

- source path: `src/domains/stats/sudden-attack`
- official public route: `/stats/sudden-attack/`
- compatibility public route: `/games/sudden-attack/`

The compatibility route exists to preserve external links, bookmarks, and search indexing.

## Cache Policy

Profile cache currently uses `localStorage`.

Rules:
- if there is no cache, fetch fresh data
- if cache age is under 5 minutes, return cached data only
- if cache age is over 5 minutes, return cached data first and revalidate in background

Manual refresh bypasses this behavior by clearing the profile cache entry first.

## Search UX

Current user-facing search helpers:
- recent searches
- favorite searches
- favorite removal
- clear recent searches
- favorite-to-VS compare shortcut

These features are client-side and stored in `localStorage`.

## Route Policy

Preferred links should point to:
- `/stats/sudden-attack/`

Compatibility links may still exist at:
- `/games/sudden-attack/`

Do not remove the compatibility route until redirect migration is ready.

## Maintenance Notes

- keep `src` as the only source of truth
- treat `public` as build output
- avoid reintroducing `src/domains/games/sudden-attack`
- if route migration is completed later, replace compatibility output with redirects
