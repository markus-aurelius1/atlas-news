# News reader hardening and release — 2026-10-06

Continues `feature/news-reader` from `4ef618b`. The reader's architecture is unchanged; this adds the two ways out when an article cannot be shown, the synced smry.ai count, infographic normalisation, better picture and caption selection, embed pointers and session recovery. The feed gateway, shards, feed cache, archive, clustering, relevance, Access middleware and Atlas are untouched. Sync gained one collection (`reader`); the D1 schema is unchanged.

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed: 0 errors, 133 warnings (132 before; the new one is the reader's sign-in button) |
| `npm test` | Passed: 588 tests in 40 files (568 before). New: infographic regression fixture (4), pictures (3), embeds (2), frame stand-ins (1), the two-link fallback, the count, session recovery and offline (5), and 5 count/sync tests through the real sync functions and schema |
| `npm run test:pipeline` | 45 tests: 39 passed, 0 failed, 6 skipped (canonical ZIP not on this machine) |
| `npm run build` | Passed; 165 PWA precache entries, 8,812 KiB |
| `npm run test:browser` | Passed, whole suite: smoke 36; News 276; reader 320 (80 per layout: 375 px and 1366 px, light and dark); Atlas scripts passed |
| `npm run test:sync` | Passed: 33 checks. New: an article opened at smry.ai on one device is counted on the other, once, and the reverse; D1 holds one `reader` row for the day. With `READER_LIVE_URL`, a live article from The Hindu came through the gateway under workerd in 0.5 s |

## Production — 2026-10-06

`main` at `bb30f38` (fast-forward of `feature/news-reader`, then one fix) was built with `SITE_URL=https://tars-atlas-news.pages.dev` and uploaded with `wrangler pages deploy`; live deployment `8675aa42-07ea-4847-8e05-1b58b1da40d3`. No D1 migration was needed. Checked on https://tars-atlas-news.pages.dev, signed in through Access in a browser, with `wrangler pages deployment tail` running.

| Check | Result |
| --- | --- |
| Without a session | `/api/article` on the production host is redirected by Access to its login; on the per-deployment host, which Access does not cover, the function's own check answers `401 unauthenticated` |
| Signed in, refusals | Unlisted address `403 publisher_not_listed`; Financial Times `451 publisher_restricted`; `http://127.0.0.1/` `400 invalid_url`; a Hindu address that does not exist `502 upstream_not_found`. All `private, no-store`, 28–56 ms where nothing is fetched |
| Signed in, articles | One article from each of the 32 publishers then in the feed, then three more from four of them: 25 of 32 came through on the first pass, three were refused (24–170 kB of script-free HTML, 59–1,974 ms); four subscription publishers answered 451 without a fetch |
| In the app | An Indian Express article opened from its headline: 782 words, 22 paragraphs, one picture, byline and time; the only links out are `Read Original` and the publisher credit; Escape returned to the same list position. A listed New York Times article: "Read this on New York Times" with exactly `Read Original` and `Read at smry.ai (n/20 today)`, both `_blank noopener noreferrer` |
| The count, against the real D1 | Two different articles opened at smry.ai (one pressed twice) read `(2/20 today)`; about four seconds later D1 held one `reader` row, `smry:2026-10-06`, with those two addresses. With the device's count and its sync database deleted, a reload brought the two addresses back from D1 |
| Worker | 40 `/api/article` invocations traced: every outcome `ok`, no exceptions, none over a limit. CPU 1–33 ms, median 11 ms, 90th percentile 26 ms; the heaviest were SCMP, Down To Earth and Indian Express pages. `/api/sync`: 2–9 ms |
| The final build is the one served | After the waiting service worker was activated, the page's News chunk contains no `reader-retry` and no RemovePaywall text |

What production showed that this machine did not:

- **NDTV refuses Cloudflare.** All four NDTV addresses tried (`www`, `food`, `ndtvprofit`) answered `upstream_blocked`, though NDTV answered from this machine. The reader shows the refusal and the two links.
- **Hindustan Times and India Today refuse now and then**: one refusal each in four requests. A refusal is not remembered, so opening the article again asks again.
- **South China Morning Post answers Cloudflare** (four of four), though it refused this machine.
- **CPU** is above the free plan's nominal 10 ms for about half of article fetches, in the same range the feed shards already run at (12–35 ms). No request was terminated. If error 1102 ever appears, the page-stripping pass in `fetch-article.ts` is the work to move.

Not checked in production: a genuinely lapsed Access session (it would mean signing the owner out); it is covered by the unit and browser checks. Pushes to `main` also start a Cloudflare Git build that fails (`d9ffc6f6`, `2566a287`); the live deployments are the direct uploads, as before.

What changed, and how each part is checked:

- **Two ways out, never three.** A rendered article offers only `Read Original`. Every terminal failure (subscriber-only, refused, gone, unreadable, slow, failed, an unlisted address, a publisher that is never fetched) offers exactly `Read Original` and `Read at smry.ai (x/20 today)`, both `target="_blank" rel="noopener noreferrer"`, and no other control: a `Try again` link first sat under them and was removed at the owner's instruction (a failed fetch is not remembered, so reopening the article asks again). A `Read elsewhere` / RemovePaywall link was built and then removed at the owner's instruction before release; the unit and browser checks assert its absence. Offline offers `Try again` only; a lapsed session offers `Sign in again` and `Read Original`.
- **The count.** Unique article addresses per local calendar day, in `localStorage` and in sync collection `reader` (`smry:<day>` → the day's addresses). Sets are united on receipt, so devices converge whichever opened what; rows two days old are tombstoned. The link is never disabled: the browser check drives it to `(21/20 today)` and still opens it, and moves the stored day to show the count restarting.
- **Infographics.** `reader/blocks.ts` rewrites stat grids, comparison cards, point lists, narrative cards and tabbed panels before Readability reads the page. The regression fixture is the Indian Express block from article 10907921 with its own class names: the output must contain `<dl data-reader="stats"><dt>Length of the coastline</dt><dd><strong>11,098</strong> km</dd>…` and must not contain `11,098`, `km` or the label as separate paragraphs. Verified live on that article (1,791 words; three figures in one grid, the comparison as a second grid, six numbered points as an ordered list, each tab's panel under its name).
- **Pictures and captions.** The widest version up to 1,600 px among `srcset`, `<picture>` sources and lazy-load attributes is preferred to a small `src` (Hindustan Times now gets its 960 px picture instead of the 400 px one). The caption beside an opening picture is kept when the picture itself comes from `og:image` (The Hindu, Indian Express).
- **Embeds.** The gateway leaves a plain link where an `<iframe>` with an https address stood; the sanitizer turns it into a one-line "View on original" pointer only for a short list of providers (YouTube, Vimeo, X, Instagram, Facebook, Datawrapper, Flourish, Infogram, Tableau, Spotify, SoundCloud, Scribd, DocumentCloud). Advertising frames leave nothing.
- **Session.** The gateway is fetched with `redirect: 'manual'`; a 401, a 403 without one of the gateway's own error codes, or a redirect is "Session expired". `Sign in again` notes the article's address in `sessionStorage` and goes to `/api/session`; on return the app opens on that article. The browser check does the round trip against a fixture sign-in route.
- **A race, found by the suite and fixed.** The reader's key listener was re-attached after each paint, so a key pressed in the moment between a paint and its effect stepped from the previous article's neighbours (J could skip an article under load). The listener now reads the current article from a ref.

# News reader — 2026-10-06

A headline now opens its article in a full-screen reader inside Tars (`src/features/current-affairs/reader`, `src/current-affairs/reader`, `functions/api/article.ts`; see README "News reader"). Branch `feature/news-reader`; not merged, not deployed. The feed gateway, shards, feed cache, archive, clustering, relevance, filters, sync, D1, Access middleware and every Atlas file are unchanged. `NewsScreen.tsx` gained the reader's route state and `StoryGroup.tsx` a click handler on links that remain real publisher links. AGENTS.md's News rule was rewritten at the owner's request: it used to forbid fetching article bodies at all.

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed: 0 errors, 132 warnings (118 before; the 14 new ones are the reader's own buttons, an image load handler and a focusable table scroller, the same kinds News already carries) |
| `npm test` | Passed: 568 tests in 39 files. New: 14 policy and bounded-fetch tests, 15 extraction and sanitizer tests, 13 reader component tests, 4 Pages contract tests |
| `npm run test:pipeline` | 45 tests: 39 passed, 0 failed, 6 skipped (the frozen canonical ZIP is not on this machine) |
| `npm run build` | Passed; 165 PWA precache entries, 8,798 KiB (the italic reading face adds 147 kB). Readability and the extractor are a separate 41 kB chunk loaded when the first article is opened |
| `npm run test:browser` | Passed, whole suite: smoke 36; News 276 (was 268: the headline now opens the reader, Open original leads to the publisher, opening is not reading); reader 264; cold starts, label order, Atlas interaction, canonical questions (light and dark) and recall integration passed. Two earlier runs failed in Atlas scripts this change does not touch (a label wait and a double-tap zoom timed out) while other Chrome instances were running on the machine; both passed alone and in the final run |
| `npm run test:sync` | Passed: 30 checks (27 before). New, under `wrangler pages dev` (workerd) with Access tokens from the local issuer: the gateway answers 401 without a token; signed in, it answers 403, 451 and 400 for an unlisted, a restricted and a local address without fetching; and, with `READER_LIVE_URL` set, one live Indian Express article came through in 2.0 s as 140 kB of script-free HTML |

What the reader check covers (`tools/browser/reader-check.mjs`, 66 checks in each of 375 px and 1366 px, light and dark, against the production build with a fixture feed and a fixture gateway): opening from a headline and from related coverage, the reader as a full-screen modal over an inert, unchanged list; headings, quotation, list, table, figure and caption kept; a failed picture and publisher furniture removed; no script, handler, form or `javascript:` link reaching the page from a hostile fixture; measure and line height; progress from 0 to 100 and controls that hide while reading down; text size, typeface, column and line spacing changing and persisting; reload on a reader address; Escape, the Back control and the browser's Back all returning to the same list position with focus on the headline; a modified click still opening the publisher; Read and Saved writing the list's own marks; previous and next following the list as it stood when the reader opened, without adding history; loading, subscriber, refused, unreadable, subscription-publisher, failed-then-retried, short-text and offline states, each with no article text and the original offered; an unknown address not being fetched; and, at the end, no article text in localStorage, sessionStorage, Cache Storage or IndexedDB.

## Publisher compatibility

Live, 2026-10-06, from this machine: the three newest articles of up to two feeds per publisher, through the dev server's gateway and the app's own extraction in Chrome (133 articles; `npm run news:reader` repeats it with happy-dom). 105 were extracted, 5 were withheld as subscriber articles, 18 belong to publishers that are never fetched, 3 were refused by the publisher, 1 was on a domain not then listed and 1 feed did not answer. Median 794 words; extraction took a median 42 ms in an unminified development build; the largest page sent to the browser was 191 kB before compression.

| Publisher | Result |
| --- | --- |
| The Hindu | 6 of 6. The opening picture is filled in by the site's script, so the reader uses the publisher's `og:image` and its caption is lost. The metered paywall is counted in the visitor's browser, so the reader, like any first visit, is not metered (see limitations) |
| Indian Express | 6 of 6, with headings, links and pictures; "Also read" and Telegram prompts removed |
| Hindustan Times | 6 of 6. Pictures are the 400 px versions the page carries and are shown at their own size |
| Times of India, The Tribune, Business Standard, BusinessLine, Guardian, BBC | 6 of 6 each. The Tribune is slow (0.2–9 s; one timeout in an earlier run) |
| Down To Earth, Economic Times, Frontline, India Today, Northeast Now, Scroll.in, Al Jazeera, Politico Europe | 3 of 3 each. Politico's text is split across containers and needs the content hint in `extract.ts`. India Today's video pages give the description text |
| Substack newsletters (seven) | 21 of 21 free posts; long posts with many charts keep their pictures |
| Mint | 4 of 6; 2 premium articles withheld, as the publisher declares them |
| NDTV | 1 of 3; one article withheld as declared, one on `ndtvprofit.com`, which was added to the policy afterwards |
| The Economist: Off the Charts (Substack) | 1 of 3; 2 paid posts withheld |
| South China Morning Post | 0 of 3: the publisher refuses the request (403). The reader says so and offers the original |
| The Economist, Financial Times, Bloomberg, The New York Times | Never fetched, by policy |
| NASA | Not verified: its feed did not answer during the run |

## Limitations

- **Cloudflare is unverified.** Nothing was deployed. The function does little work (it streams one page and strips it; extraction is in the browser), but its CPU time on the free plan and whether publishers answer Cloudflare's addresses as they answered this machine are only known after a deployment. After deploying, watch the Functions metrics for error 1102 and open one article per publisher.
- **Metered paywalls.** Subscriber articles are withheld when the publisher declares them (`isAccessibleForFree`, a locked content tier) or the page shows its paywall. A meter that counts free articles in the visitor's browser (The Hindu) cannot be seen: each article arrives as a first visit would receive it. To be stricter, mark that publisher `restricted` in `policy.ts`.
- **robots.txt is not consulted.** The request is a single page for the person who opened it, identified as `TarsReader`, the way a browser's reader view works; it is not a crawl. A publisher that refuses is not asked again another way.
- **Embeds are dropped**: video, audio, tweets, interactive charts and iframes disappear without a placeholder, and a gallery keeps its first picture. Live pages and video pages give whatever text they hold, or the "no article text" state.
- **Short texts** (under 110 words, or ending in an ellipsis) are labelled as possibly incomplete; a genuinely short brief gets the same label.
- **No offline reading.** Article text is never stored, so only articles opened earlier in the same visit are available offline.
- **An expired Access session** shows as "Couldn't load this article": the sign-in redirect is cross-origin and cannot be told apart from a network failure. The "Sign in" state appears only when the gateway itself answers 401.
- **Native builds** have no `/api`, as with the feed: the reader shows its failure state and the original link.

# News substantive-value gate — 2026-10-05

A gate was added after syllabus matching (`relevance.ts`, `SUBSTANCE` / `LOW_VALUE` in `evidence-lexicon.ts`; see FOUNDATION.md). Scores, the 6.5 and 7.2 thresholds, ranking, the 100-story cap, clustering, sources, sync, cache and the Cloudflare configuration are unchanged. Regression cases: the eleven live false positives the owner flagged (`fixtures/substance-cases.json`).

| Check | Result |
| --- | --- |
| Flagged cases | 11 of 11 rejected, each with a "No substantive development" reason or below the score threshold |
| Labelled fixture | Recall held: 3 of 136 relevant cases are newly rejected, and those 3 (a product recall and two routine Uttar Pradesh business notices) were relabelled not-relevant because they match the flagged patterns. `node tools/news/audit.ts`: relevant 110/133, not-relevant 1/92 |
| Registry snapshot (3,923 items) | 88 of 1,267 previously accepted articles rejected by the gate at the time of tuning, mostly reported remarks, party statements, protests and startup or investment notices |
| `npm run typecheck`, `npm run lint` | Passed; 0 errors, 118 warnings (unchanged) |
| `npm test` | Passed: 522 tests, including 20 new gate tests and one cluster test that every shown article clears the bar on its own |
| `npm run build`, `npm run test:browser` | Passed; News 268 checks, smoke 36, the rest of the suite passed |
| Production | Deployed three times; the first two left the Maharashtra water-cut notice listed, because its full feed summary (longer than the flagged screenshot) supplied enough summary-level signals. Fixed by counting only headline signals beside a low-value headline and weighting operational notices double. On the final deployment, signed in: manual refresh made 13 gateway requests, all 200; all 100 listed stories and their 149 article headlines (groups expanded) were read from the page: none of the eleven flagged articles and no headline matching the party-statement, reaction, candidate-list, operational-notice, recall, influencer, company or quote-led patterns |

Not changed and still true: several flagged articles reached the list through spurious concept matches in the generated index ("picking up police" read as "UP police", "CPI(M)" as the price index, "pipeline" as energy security). The gate rejects them, but the index itself can only be rebuilt with the canonical PYQ package, which is not on this machine.

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

## Validator v3 Job B — 2026-10-07 local verification

On codex/validator-v3-b from A1 a4bd096: focused B 27 + source-audit 5, evaluation 30, root 604 (41 files), Cloudflare logic 35 (5 files) passed. Typecheck, lint (0 errors/133 warnings), build and diff whitespace passed. Pipeline: 39 passed, 6 skipped without external canonical ZIP. Local Chromium fixture checks: News 276, reader 320 across 375/1366 px and both themes; offline/cache/Back/Read/Saved and body non-persistence retained. Wrangler is unavailable locally (npx --no-install refused missing package); no workerd/D1 browser certification. Two-pass RSS/listing research is acquisition evidence only, with no gold labels, authenticated production or physical-device claim. Full results, failures, sources, input hashes, file inventory and handoff: ../tools/news/evaluation/JOB_B_REPORT.md, JOB_B_EVIDENCE.json and JOB_B_GIT.txt. Verification recorded before the subsequently authorized local Job B commit; no push/merge/deploy.
