# Cloudflare Cron Migration (Futures Sync)

This migration keeps your existing Python sync script and Firestore logic in GitHub Actions, but replaces unreliable GitHub schedule triggering with Cloudflare Cron.

## 1) Keep this workflow

- `.github/workflows/futures-estimate-sync-v2.yml`
- It is still the actual sync runner.
- Cloudflare Worker will trigger this workflow via `workflow_dispatch`.

## 2) Create GitHub token

Create a fine-grained PAT (recommended) or classic PAT with minimal permissions.

- Repository access: `HanBeom98/tracking-sa`
- Permission: `Actions: Read and write`
- Expiration: set reasonable expiry and rotate regularly

## 3) Deploy Worker from Cloudflare dashboard

Create a new Worker and paste:

- `workers/futures-cron-dispatch/worker.js`

Then set secrets/vars in Worker settings:

- `GH_OWNER = HanBeom98`
- `GH_REPO = tracking-sa`
- `GH_WORKFLOW_ID = futures-estimate-sync-v2.yml`
- `GH_REF = main`
- Secret: `GH_PAT = <your token>`

Add Cron Trigger:

- `*/5 * * * *`

## 4) Verify

1. In Worker logs, confirm scheduled events run every 5 minutes.
2. In GitHub Actions, confirm `Futures Estimate Sync v2` appears as `workflow_dispatch` by the worker.
3. In site page `/futures-estimate/`, confirm `업데이트` time moves every 5 minutes.

## 5) Optional hardening

- Add secondary cron worker trigger offset (e.g. `2-59/5 * * * *`) only if needed.
- Add Discord/Slack webhook alert on worker failure.
- Rotate `GH_PAT` periodically.

