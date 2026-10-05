# Sync and first Cloudflare deployment — 2026-10-05

Local-first sync of durable personal state (`src/sync`, `functions/api`, `migrations/`) was added and the site was deployed to Cloudflare Pages for the first time. No file under `public/` changed except `_routes.json` (now `/api/*`); the build re-verified every Atlas asset hash. The News gateway, validator, clustering and feed cache code are unchanged; `archive.ts` gained a by-URL reader and a metadata cleaner split out of `archiveRecord` (same output for active sources).

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed: 0 errors, 118 warnings (unchanged) |
| `npm test` | Passed: 502 tests in 35 files. New: 9 sync service tests and 11 multi-device engine tests in `tools/cloudflare`, run through the real functions and the real migration on SQLite |
| `npm run test:pipeline` | 45 tests: 39 passed, 0 failed, 6 skipped (the frozen canonical ZIP was not supplied on this machine) |
| `npm run build` | Passed; 162 PWA precache entries, 8,554 KiB |
| `npm run test:browser` | Passed, whole suite, after the sync change: smoke 36; News 268; cold starts, label order, Atlas interaction, canonical questions (light and dark) and recall integration all passed |
| `npm run test:sync` | Passed: 27 checks, no page errors. Production build + real Pages functions under `wrangler pages dev` (workerd) + local D1 with the real migration + Access tokens signed by a local issuer and verified by the functions; each browser context is a device |

What the two-device check showed (`tools/browser/out/sync/results.json`):

- A device used with no sync service (1,500 Atlas answers, a claim, Read/Saved/Removed marks, a theme) uploaded 1,510 rows in 4 requests, 1.5–3.5 s across runs, by itself when the service became reachable; its local storage was identical before and after.
- A second device with marks of its own merged on first launch: every mark kept, the later time for a shared one, all 1,500 answers with the same ids and times, and the chosen theme.
- Unsave and unread on one device cleared the marks on the other. A save made offline was usable at once, was sent when the connection returned, and kept the time it was made.
- A third device whose feed never carried two Saved articles listed them from synced metadata, including after a reload with the sync service unreachable.
- No token: the app worked locally and asked for sign-in; a request naming an account in its body got 401. Another account saw nothing and got 409 when it claimed the first account.
- D1 accounting as reported by the local D1 runtime: an idle sync is 1 query, 1 row read, 0 written; a 400-row push is 5 queries, 404 rows read, about 801 written; a 500-row page is 1 query, 501 rows read.

Deployment: Pages project `tars-atlas-news` (production branch `main`, direct upload from this working tree at `f18a181` plus uncommitted changes), D1 database `tars-sync` (`824fd651-a92c-4716-a618-232624fa5bcc`, APAC) with `0001_sync.sql` applied and both tables and the cursor index confirmed present. Live at https://tars-atlas-news.pages.dev: the app shell, manifest (`lodestar-study`), service worker file, relevance index and SoI outline are served; in Chrome the Atlas rendered and placed its labels with no page errors.

## Production, signed in through Cloudflare Access — 2026-10-05

Access now protects `tars-atlas-news.pages.dev` (team `marcus-circle.cloudflareaccess.com`); `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD` are set in `wrangler.toml`. Checked on the production hostname in a signed-in browser:

| Check | Result |
| --- | --- |
| No session | Every path, pages and `/api` alike, redirects to the Access login |
| Per-deployment hostname (not covered by the Access application) | Static files are served; `/api` answers 401 with no token and with a forged one |
| Sign-in from an installed app | Failed at first: the service worker answered Access's callback (`/cdn-cgi/access/authorized`) from its cache, so no session cookie was set and News could not refresh. Fixed by keeping `/cdn-cgi/` out of the navigation fallback (`vite.config.ts`); after redeploying, "Sign in" went to the identity provider and returned to the app |
| `/api/current-affairs?shard=0…12` | All 13 answered 200 uncached, 0.7–2.9 s each; 77 of 77 sources `ok` |
| News in the app | 3,914 items, 100 stories in the rolling list, no alert |
| Navigation and reload inside the two-hour window | Atlas → Settings → News: 0 new gateway requests; full reload: 0 gateway requests, list restored from the local snapshot |
| Manual refresh | 13 requests, all with `refresh=1`, all 200, slowest 2.1 s; the snapshot's `fetchedAt` advanced |
| `/api/sync` against production D1 | 200 for the signed-in account; an idle exchange reported `queries=1;read=1;written=0` |
| Two clients, one account | Marking a story read in the app (5 article URLs) was sent by itself and read back by a second client with the same times; that client's unread reached the app on its next sync and cleared the marks. The second client spoke the protocol from the same browser session, not from a separate physical device |
| CPU limit (error 1102) | None observed: 26 uncached shard collections (13 first fetches, 13 forced) all returned 200. The Functions metrics page itself was not read; the wrangler login does not expose it |

The production database holds only what that test left: 5 tombstones in `news` for one account.

Not verified: a second physical device signed in to production; behaviour after the Access session expires on its own; Functions analytics in the dashboard. A browser that installed the app before the service-worker fix must clear the site's data once, because its old worker intercepts the sign-in callback. Also not run: `tools/audit-foundation.mjs` (needs ripgrep), Capacitor sync, Android/iOS builds.

# Interface rebuild verification — 2026-10-05

The shell, Atlas instruments, News reading list and Settings were rebuilt on the foundation below. Data, storage and the News cache/gateway were not changed: no file under `public/`, `src/data`, `src/atlas` (except the question-table border colour in `pyq/blocks.css`), `src/current-affairs`, `functions/` or `tools/atlas-build` was edited, and `useFeeds.ts`, `useArchive.ts` and `usePersonalState.ts` are untouched. Map rendering changes are styling only: line weights and colours in `renderer/tilePainter.ts` and `renderer/palette.ts`, a `dusk` tone (the same relief raster, dimmed at paint time, for the dark theme), and sparser symbol thresholds in `AtlasMap.tsx`.

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed: 0 errors, 118 warnings (170 before the rebuild) |
| `npm test` | Passed: 227 tests in 31 files, including topic-group anchor selection |
| `npm run test:pipeline` | 45 tests: 39 passed, 0 failed, 6 skipped (the frozen canonical ZIP was not supplied on this machine) |
| `npm run build` | Passed; asset hashes verified by the build; 158 PWA precache entries, 8,434 KiB |
| `npm run test:browser` | Passed (production build, local stock Chrome): smoke 36; cold starts 6; label/marker paint order 90; Atlas interaction 21; canonical questions and offline pack 104 light + 104 dark; News 268 (re-run after topic groups and thumbnails; the other suites were last run before that change, which touched only News); recall integration passed |
| Map pan/zoom frame times | Development build, 1440×900, headless Chrome: pan 16.7 ms average, 0 frames over 32 ms; six wheel notches, 2 frames over 32 ms |

Browser checks were adapted to the new controls where a selector or an interaction changed; the behaviours they assert were kept, with two deliberate differences: closing the place inspector now clears the selection (there is no collapsed state), and a read headline is distinguished by ink rather than weight. News groups stories that share a PYQ concept, and every publisher's article on one story, under a single anchor article (Indian Express or The Hindu when either covers it); the rest stay reachable in the collapsed group.

Not run here: `tools/audit-foundation.mjs` (needs ripgrep, which is not installed on this machine), Capacitor sync, Android/iOS builds, any Cloudflare deployment, and live publisher availability beyond the local development gateway.

# Local verification — 2026-10-05 (foundation)

The source baseline and selectively imported files are pinned in `FOUNDATION.md`. The original repository remains unchanged. The physical Atlas was visually inspected in a 1366px production screenshot; terrain, relief, rivers and regional lettering remain intact.

| Check | Result |
| --- | --- |
| Clean root install, one workspace lockfile | Passed; Node 24.19.0 / npm 12.2.0 |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed: 0 errors, 170 retained presentation/accessibility warnings |
| `npm test` | Passed: 219 tests in 30 files, including backup/schema and Cloudflare cache contracts |
| `npm run test:pipeline` | Passed: 45 tests, 0 skipped; frozen canonical ZIP supplied locally |
| `npm run build` | Passed; 158 PWA precache entries, approximately 8.23 MiB |
| Browser shell smoke | Passed: 36 checks; 390/1366px, light/dark |
| Atlas cold starts | Passed: 6 checks; phone/desktop, reload and return from News |
| Label/marker paint order | Passed: 90 checks; 1920/1366/390px, light/dark, India/World, moving/settled |
| Atlas interaction | Passed: 21 checks; pan/zoom, selection, search, inspector and responsive layout |
| Canonical question/browser/offline checks | Passed: 104 light + 104 dark checks; all supported question representations and unvisited offline pack |
| News/browser/cache/offline checks | Passed: 256 checks; 375/1366px, light/dark, Read/Saved, archive, refresh, navigation and owned feed cache |
| Recall integration | Passed; exactly one saved attempt, Familiar mastery after reload, +1 XP, next-day review, no console errors |
| Capacitor sync | Passed for Android/iOS/web; all 5 retained platform plugins |
| Source fidelity | 8 physical sheet/overlay/raster hashes unchanged; all 2,273 place records and 149 question/answer records unchanged |
| SoI provenance | Official archive SHA matched; reimport matched 256 lines / 31,905 points to within 2.85e-14 degrees |
| Legacy text audit | 642 occurrences (406 repository, 236 built output), zero unexplained; each exact match is recorded with a reason by `tools/audit-foundation.mjs` |

Tests used the production build and local stock Chrome. Deliberate News failure/offline fixtures generate expected 503 and disconnected-resource diagnostics; there were no uncaught page errors. The separate recall integration uses the development module boundary so it can derive the real answer rather than inventing one.

The official outline and its provenance are separate bundled assets; this migration does not substitute their outline for the original physical map. The build independently validates geometry/provenance and inventories 113 Atlas/PYQ assets. The offline places-only rebuild reported zero unmatched, ambiguous or invalid PYQ ledger entries; the 25 authored-coordinate warnings preserve the existing sourced data.

The fresh dependency audit reports 9 existing advisories (5 moderate, 4 high), all in the native CLI or offline geodata toolchain (`@capacitor/cli` / `mapshaper` and their dependencies). These tools are outside the web app and Pages gateway bundles. No forced major upgrade was applied. Optional SQLite/MessagePack installation scripts are blocked by this host's npm policy; the required map builds, SoI reprojection, tests and native sync pass without them.

Cloudflare configuration and the adapter's GET/method/partial-failure/redirect/cache contracts are verified locally. No Cloudflare deployment or live publisher availability was tested in this migration. Android/iOS SDK builds, signing and physical-device interaction are not claimed. The new Git repository has no remote and contains no source PDFs or canonical source ZIP.
