# Production release — 2026-10-09

Validator v3 and Reader Highlights H3 are live at https://tars-atlas-news.pages.dev. This supersedes the stopped state in DEPLOYMENT_REPORT.md and FINAL_PRODUCTION_READINESS.md, which are kept as the record of the earlier stop.

## What is deployed

- Source: commit `059ce99` on `release/v3-h3-claude-handoff` (parent `66471b3`). Corrections are described in VALIDATOR_FINAL_CORRECTION.md.
- Build: `VITE_NEWS_VALIDATOR=v3`, `SITE_URL=https://tars-atlas-news.pages.dev`, `BASE=/`; entry bundle `assets/index-CNk4tlvE.js`. The source default stays v2.
- Cloudflare Pages deployment `0848c602-c43a-4b93-a3ca-41086cce8cb9`, production, branch `main`, direct upload to the existing project `tars-atlas-news` (no Git connection, no remote build). Previous production deployment `8675aa42-07ea-4847-8e05-1b58b1da40d3` (commit `bb30f38`) is retained by Pages.
- D1: `0002_highlights.sql` applied to `tars-sync` after owner approval; see D1_MIGRATION_REFRESH_2026-10-09.md.

## Local verification of this source

| Check | Result |
| --- | --- |
| Unit tests (`npm test`) | 850 passed in 60 files (800 existing unmodified, 50 new) |
| Evaluation tests (nine files under `tools/news/evaluation`) | 85 passed |
| Pipeline tests with the canonical PYQ package supplied | 45 passed, none skipped |
| Typecheck | passed |
| Lint | 0 errors, 133 existing warnings |
| v3 production build, controlled v3 browser check | 68 checks passed, re-run on the uploaded artifact |
| v3 build, two-device workerd / Access / ephemeral D1 sync check | 42 checks passed |
| v2 + H3 fallback build, same sync check | 42 checks passed |
| v2 + H3 fallback build, full browser suite (Atlas, learning, News, Reader, Highlights, library, recall) | passed |
| Frozen-parent replay of earlier predictions | passed (needs Windows `tar`, not Git Bash `tar`) |

One build was discarded before upload: run from Git Bash, `BASE=/` was rewritten to a Windows path and the bundle did not start. The browser check caught it. Build from PowerShell or `cmd`, or set `MSYS_NO_PATHCONV=1`.

## Production checks after deployment

Signed in as an allow-listed account in a 428 px wide browser:

- The new bundle is active; `tars-validator-v3-reading-v1` and `tars-reader-highlights` were created on first load.
- News: Today shows 50 selected units across all nine subjects from the live feed; of 206 articles under 24 hours old, 115 were admitted, so the cap of 50 applied. Archive is empty on a first v3 day, as designed (selected-only).
- Reader: a Hindu article and a Business Standard article opened with full text, Read Original link, previous/next navigation and the highlighter control.
- Sync: Settings reports syncing as the signed-in account and up to date; 27 legacy rows for that account arrived on this fresh device.
- Highlights: one highlight made by the owner on another device during the check arrived in this browser, appears in the Highlights library, and is the only row in `highlight_sync_records`, under that account alone.
- D1 after deployment and use: still 3 accounts, 65 legacy records, 8 tombstones.
- Access: the origin redirects to the Access login without a session; every `/api` route on the deployment-hash hostname returns 401.

Not exercised in production: highlight recolour and delete, the smry.ai link and its counter (it appears only when an article cannot be shown), the Saved list for an account that has saved articles (this account has none), a desktop-width session, and rejection of a non-allow-listed Google account.

## Observed during release

For roughly ten minutes after the upload the production hostname answered two new chunk URLs with the HTML shell. A service worker that installed in that window precached the wrong content and News showed “This screen couldn’t load”. Re-installing the service worker after the window gave a clean precache (160 entries). A device that updated in that window can be repaired by clearing site data for the app’s cached files or unregistering the service worker; personal data is in IndexedDB and D1 and is not affected.

Static files on `<hash>.tars-atlas-news.pages.dev` are reachable without Access; they contain no personal data and the APIs there still require a valid Access token. This predates the release.

## Rollback

1. Fastest: Cloudflare dashboard → Pages → `tars-atlas-news` → Deployments → `8675aa42` → “Rollback to this deployment”. That build predates H3, so Highlights sync pauses until a newer build returns; local highlights stay on the device.
2. Preferred: publish v2 with H3 from this commit —
   `SITE_URL=https://tars-atlas-news.pages.dev BASE=/ VITE_NEWS_VALIDATOR=v2 npm run build`, then
   `wrangler pages deploy dist --project-name tars-atlas-news --branch main`.
   A copy built and tested today is at `C:\Users\hario\tars-release-artifacts\059ce99\dist-v2-h3`.
3. Never reverse `0002_highlights.sql` or erase a store. The v3 reading ledger, highlights, tombstones, legacy rows and both cursors stay in place under either validator.

## After release

Samsung tablet and S-Pen behaviour, and seven days of ordinary refreshes, follow POST_DEPLOYMENT_7_DAY_PLAN.md. Admission on the live feed is broad enough that Today reached its cap on the first day; watch which admitted items are routine.
