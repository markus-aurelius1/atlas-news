# Deployment

Production is https://tars-atlas-news.pages.dev: Cloudflare Pages project `tars-atlas-news`, direct upload to its `main` branch, behind Cloudflare Access. `main` in this repository is the source of what is live. Publication needs the owner's explicit authorization each time.

## What is live

| | |
| --- | --- |
| Source | `main` as of the clean-up commit of 2026-10-10 (the editorial selection is `c3d0e6b`); later commits that touch only documents do not change the build |
| Build | `VITE_NEWS_VALIDATOR=v3`, `SITE_URL=https://tars-atlas-news.pages.dev`; entry bundle `assets/index-DLeXR06j.js` |
| Pages deployment | `c7995bf9` (production, branch `main`). Retained by Pages before it: `932af630`, the same code before the repository clean-up, and `0848c602`, the first v3 release of 2026-10-09 |
| D1 | `tars-sync` with `migrations/0001_sync.sql` and `0002_highlights.sql` applied |

The source default for `VITE_NEWS_VALIDATOR` is still `v2`, which the local browser suites (`npm run test:browser`) run against. Production always builds with `v3`; `npm run build:cloudflare` sets it.

## Publishing

1. On `main`, with a clean tree: `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:pipeline`.
2. Build from PowerShell or `cmd` (not Git Bash with `BASE` set: it rewrites `BASE=/` to a Windows path and the bundle does not start):

   ```
   $env:SITE_URL='https://tars-atlas-news.pages.dev'; $env:VITE_NEWS_VALIDATOR='v3'; npm run build
   ```

3. Check the exact artifact: `node tools/browser/validator-v3-check.mjs` (set `CHROMIUM_PATH` to a local Chrome; it serves `dist` with fixture feeds and expects 68 checks).
4. Upload: `npx wrangler pages deploy dist --project-name tars-atlas-news --branch main`.
5. Confirm the deployment hostname serves the new entry bundle and its chunks as JavaScript, the production origin redirects to the Access login without a session, and `/api/*` answers 401 there. Then sign in and open News and an article.

A push to `main` also starts a Cloudflare Git build, which fails and changes nothing; production is the direct upload.

## After a release

- An open tab keeps the old build until its waiting service worker is activated (reload).
- For some minutes after an upload the production hostname can answer a new chunk URL with the HTML shell. A service worker that installs in that window precaches the wrong content and a screen fails to load; unregistering the service worker or clearing the site's cached files repairs it. Personal data is in IndexedDB and D1 and is not affected.
- When the feed registry changes (a feed added or retired), clients on the previous build get 409 from the feed gateway and keep their last snapshot until they load the new build.
- Static files on `<hash>.tars-atlas-news.pages.dev` are reachable without Access; they hold no personal data, and the APIs there still require a valid Access token.

## Rollback

1. Fastest: Cloudflare dashboard → Pages → `tars-atlas-news` → Deployments → choose the previous deployment → "Rollback to this deployment".
2. Or rebuild an earlier commit of `main` as above and upload it.
3. Never reverse a migration or erase a store. The reading ledger, highlights, tombstones, legacy rows and cursors stay in place under any build.

## Not in this repository

The evaluation harness, calibration sets and release records of the first v3 policy (regex routes), which the editorial selection replaced, were removed from `main` on 2026-10-10. They remain in history and on the branch `release/v3-h3-claude-handoff`.
