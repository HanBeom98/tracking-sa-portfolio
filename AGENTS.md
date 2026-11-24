# Tracking SA repository guide

This is the public portfolio snapshot. Read `docs/portfolio-snapshot.md` before
syncing from the private source. Preserve example configuration and anonymized
account identifiers. Never restore production credentials, exports or logs.
Do not activate production deployment or external-message workflows here.

## Source of truth

- The current production site is authored in `src/`, `functions/`, and `cloud-functions/`.
- `public/` is generated deployment output. Do not edit it directly. Change `src/`, run the build, and commit the resulting `public/` changes when deployment requires them.
- `scripts/public_sync_map.txt` and the source-of-truth checks define source-to-public mirrors.

## Efficient navigation

- Search `src/`, `functions/`, `cloud-functions/`, and `tests/` first.
- Do not inspect `public/`, build caches, logs, or screenshots unless the task specifically concerns generated output or visual assets.
- Prefer targeted `rg` queries over reading large files in full.

## Verification

- Run `npm.cmd run build` after production-site source changes.
- Run the narrowest relevant test first, then `npm.cmd run test:unit` for shared or cross-domain changes.
- Run `npm.cmd run check:source-of-truth` and `npm.cmd run check:public-edit-policy` when source/public mirrors change.

## Operating cost constraint

- Operate within existing free-tier allowances at the current scale and avoid unnecessary external calls, data collection, storage, paid analytics, and automated exports. Follow [the free-tier operation policy](docs/free-operation-policy.md). An existing card or pay-as-you-go plan is not a request to disconnect billing, downgrade plans, migrate providers, or remove working features. Do not add a new billable dependency or paid upgrade to fill optional metrics. Check actual usage and overage behavior before resource-intensive changes; do not promise a universal zero-charge guarantee.
