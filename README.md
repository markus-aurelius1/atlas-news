# TARS

Local-first Atlas, publisher-linked News, and Settings, with optional sync between your own devices. The bundled physical Atlas includes relief, hillshade, rivers, geographic overlays, 2,273 stable places and canonical geography PYQs. No online map provider is required.

Use Node 22 or newer. Install and verify from the repository root:

```sh
npm ci
npm run typecheck
npm run lint
npm test
npm run test:pipeline
npm run build
npm run test:browser
```

The lockfile includes the offline data builder and Playwright browser workspace. Before browser checks, install Chromium with `npx playwright-core install chromium`, or set `CHROMIUM_PATH` to a local Chrome/Chromium executable. `npm run dev` starts development; `npm run preview` serves the production build.

`npm run atlas:places` rebuilds the gazetteer offline from curated inputs and bundled overlays. `npm run atlas:pyq` verifies the frozen canonical package and rebuilds the curated subset; provide `CANONICAL_PYQ_PACKAGE` or the sibling `canonical-pyq-v2-final.zip`. Full cartographic regeneration (`npm run build --prefix tools/atlas-build`) uses cited upstream geographic sources and needs network access. Existing bundled plates do not need regeneration to build the app.

For Cloudflare Pages, set `SITE_URL` to the new site's HTTPS origin and use `node tools/cloudflare/build.mjs` as the build command, with `dist` as output. `wrangler.toml`, `public/_routes.json`, `public/_headers`, `migrations/` and `functions/api/` define deployment behavior. News stores feed metadata and Read/Saved state offline; a headline opens its article in the reader (see "News reader"), and the original is always one press away.

`npm run test:sync` (after `npm run build`) runs the two-device sync check: the production build and the real functions under `wrangler pages dev` with a local D1, signed in through a local stand-in for the Access issuer.

### News gateway on Cloudflare (free plan)

The gateway never collects the whole registry in one invocation. The 85 collected feeds are split into 15 fixed shards of at most 6 feeds (`src/current-affairs/shards.ts`), and the app requests `/api/current-affairs?shard=0` … `?shard=14` and merges them into its own `tars-news-feed-v2` snapshot. A feed the owner withdraws is listed in `RETIRED_SOURCES` (`src/current-affairs/sources.ts`; South China Morning Post since 2026-10-09): it is no longer collected or shown, while its registry entry stays so that the fixed layout of older clients and articles saved from it keep resolving.

- **Per invocation:** at most 6 upstream requests (6 at a time, redirects refused, 10 s and 4 MB per feed) plus one cache read and one cache write, against the free plan's 50 subrequests and 6 simultaneous connections. A request without a valid `shard` makes no upstream request and returns 400.
- **Caching:** each shard has its own edge cache entry for two hours; `&refresh=1` bypasses and replaces only that shard's entry. The app still refreshes only when its snapshot is two hours old or on manual refresh, never on navigation.
- **Failure isolation:** a failed feed fails alone inside its shard; a failed shard keeps its sources' articles from the last snapshot; only when no shard answers does the refresh fail, leaving the snapshot untouched.
- **Cloudflare Access:** every request is a same-origin browser `fetch`, so the Access session cookie travels with it and the function never calls its own hostname. `functions/api/_middleware.ts` verifies the Access token on every `/api` request (one extra subrequest for the team's signing keys per runtime instance, then cached for an hour), so the gateway is closed to anyone Access has not signed in, including on a hostname Access does not cover. If the session has expired the shard requests fail and the last snapshot stays on screen until the user signs in again.
- **CPU time:** parsing a shard takes roughly 12–35 ms of CPU in Node, above the free plan's nominal 10 ms per invocation. Cached responses cost almost nothing and a shard is collected at most once per two hours per location, but this cannot be verified without deploying: after the first deploy, watch the Functions metrics for "exceeded CPU" (error 1102). If it appears, lower `FEED_SHARD_SIZE` or move to the paid plan.
- **Not a public feed:** Times of India feeds are personal-use only; keep the site behind Access.

### News selection

With `VITE_NEWS_VALIDATOR=v3` (the production build), Today lists at most 50 readings from the past 24 hours, chosen on the device from feed metadata alone; nothing is fetched to choose them.

- **Value** (`src/current-affairs/validator-v3/editorial.ts`). An article needs a syllabus topic *and* a development: a decision, judgment, report or finding, agreement, launch or discovery, or an explainer or editorial. Its value falls when it is party politics, a protest or an election contest, a step in someone's litigation, a State's day-to-day business, another country's domestic affairs, a company's or a consumer's concern, or the report of a remark. Every point is listed with its reason; nothing below the floor is offered, so a thin day gives a short list rather than a padded one. Polity and Governance have a higher floor than the other subjects.
- **One reading per topic** (`validator-v3/selection.ts`). Reports of the same story are shown together under the best one. Further angles on a topic already in the list (headlines naming the same thing, such as a council, a programme, a prize or a weather pattern) are left out, however differently they are worded. An institution such as the RBI may carry two readings a day, a decision and its analysis. Only a story that fills the day's feed gets more.
- **Subjects.** Every reading is shelved under one syllabus subject; there is no catch-all section. Environment, Sci-Tech, International relations and Economy come first and may take up to 12 places each; Polity is capped at 5 and Governance at 6, so their volume cannot crowd the others out.
- **Audit.** `npm run news:snapshot` saves a live collection of feed metadata; `npm run news:today` prints the list it would produce, `-- --left-out` what qualified but was left out and why, `-- --near` what fell just short, and `-- --why="<words>"` every point behind the verdict on matching headlines. The regression cases are `src/current-affairs/fixtures/editorial-day.json` (the owner's review of the 2026-10-09 list) and `fixtures/relevance-cases.json`.

### News reader

Opening a headline opens the article full screen inside Tars (`#/current-affairs?read=<article address>`). The address is part of the route, so Back closes the reader and the list underneath is exactly as it was left.

- **One request, on demand.** `functions/api/article.ts` fetches the page of the article that was opened: one upstream request per invocation (at most three redirects, each re-checked), nine seconds, HTML only, three megabytes. Nothing is fetched ahead of time or in bulk. There is no edge cache and the response is `no-store`; the app keeps the last few articles in memory for the visit and writes none to storage, so an article is not available offline unless it was opened in that visit.
- **Not a proxy.** Only https pages on the domains in `src/current-affairs/reader/policy.ts` are fetched (every registry publisher must have an entry; a test enforces it). An unlisted, malformed, credentialed, non-default-port or address-literal URL makes no request, and the route sits behind the same Access check as the rest of `/api`.
- **Publisher restrictions.** The request identifies itself (`TarsReader`), sends no cookies and tries nothing else when refused. The Economist, Financial Times, Bloomberg and The New York Times are never fetched. An article the publisher marks `isAccessibleForFree: false` (or a locked content tier), or whose page shows its paywall, is not shown. A text that looks cut short is shown labelled as possibly incomplete.
- **When an article cannot be shown** (subscriber-only, refused, gone, unreadable, a failed or slow fetch, a publisher that is never fetched) the reader offers exactly two links, each in a new tab: `Read Original` and `Read at smry.ai (x/20 today)` (`https://smry.ai/<article address>`). smry.ai is a third-party service the reader chooses to open; Tars fetches nothing from it. `x` is the number of different articles opened there on this local calendar day, on any device of the account (`src/current-affairs/reader/elsewhere.ts`; sync collection `reader`, one row per day). It is information only: the link works past 20, and the count starts again at local midnight. A rendered article offers only `Read Original`.
- **A lapsed Access session** (the gateway answers 401, 403 without one of its own error codes, or a redirect to the login) shows "Session expired" with `Sign in again`. The article's address is noted in the tab (`src/app/resume.ts`) and reopened when sign-in returns to the app.
- **Extraction** runs in the browser, in a lazily loaded chunk: Mozilla Readability on an inert document, then an allowlist sanitizer (`reader/sanitize.ts`), then React elements built from the same allowlist (`reader/ArticleBody.tsx`); publisher markup is never inserted as HTML. Before Readability runs, `reader/blocks.ts` rewrites infographics that publishers build from anonymous `<div>`s (stat grids, comparison cards, titled point lists, tabbed panels) as the semantic elements they stand for, so a figure, its unit and its label stay one block. Pictures use the best version the page names (`srcset`, `<picture>` sources, lazy-load attributes) rather than a small `src`; a caption written beside a picture is kept with it. Where a video, chart or post was embedded, a one-line pointer to it is left when its address is on a short list of known providers. Doing this in the browser keeps the function's CPU to a stream read and a strip pass, inside the free plan's budget.
- **Highlighter.** With the Highlighter on, a pen drawn across the text highlights the words it passes over as it goes and saves them when it lifts: no long press and no selection handles (`reader/useHighlights.ts`). The page stays still under the pen; a finger still scrolls, and selecting text with a finger or a mouse highlights it as before. Highlights are painted with CSS Custom Highlights and never alter the article markup.
- **Check a publisher:** `npm run news:reader` runs the newest articles of each registry publisher through the same fetch and extraction and prints what a reader would get (`npm run news:reader -- ht-india 3` for one feed). Results and known limitations are in `docs/VERIFICATION.md`.

### Sync

The app is local-first: every screen reads and writes this device's own storage and works offline. Sync copies durable personal state between devices signed in to the same Cloudflare Access account, through `/api/sync` and a D1 database.

- **What syncs:** News Read / Saved / Removed marks and article notes; the day's count of articles opened at smry.ai; the publisher metadata (title, link, date – never article text) of Saved articles; short notes; Atlas recall attempts and reward claims; theme, week start, haptics, map style and map layers. **What does not:** the RSS feed snapshot, the archive of unsaved articles, historical tables, per-device preferences (motion, sidebar, last map view).
- **Identity:** Cloudflare Access only; there is no other login. The function verifies the Access JWT (RS256 signature against the team's keys, issuer, audience, expiry) and uses the email inside it as the account. Nothing in the request body is trusted; a device linked to one account refuses to sync as another.
- **Model:** one row per key (`migrations/0001_sync.sql`), newest change wins, deletions are tombstones. Each News mark is its own row, so reading on one device and saving on another never collide, and an unsave or unread reaches the other devices. Changes keep the time they were made, including offline. A device that never held a mark has no row for it and so can never undo a save made elsewhere.
- **First sync:** whatever is already on a device is uploaded as it is and merged with the account by the same rules as a backup merge; local storage formats, keys and ids are unchanged.
- **Saved articles** are pinned with their metadata in the device's sync store and in the account, so they stay listed when the feed stops carrying them or the source leaves the registry.
- **Cost:** a device sends only changed rows and asks only for rows after its cursor, through the `(user_id, seq)` index. A sync with nothing new is one query, one row read, no write. A push is one transaction of five statements whatever its size (at most 400 rows per request) and writes two rows per changed key. The app syncs at start, about 1.5 s after a change, on wake or reconnect, and every five minutes while open.
- **Setup:** create the D1 database and apply the migration (`npx wrangler d1 create tars-sync`, `npx wrangler d1 migrations apply tars-sync --remote`), put its id in `wrangler.toml`, and set `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD` there from the Access application that protects the site. While either is empty every `/api` route answers 503 and the app stays local-only. The Access application should cover `tars-atlas-news.pages.dev`; per-deployment hostnames (`<id>.tars-atlas-news.pages.dev`) serve the static app publicly unless a wildcard application covers them too, though their `/api` routes still refuse anyone without a valid token. Deploy with `SITE_URL=https://tars-atlas-news.pages.dev npm run build`, then `npx wrangler pages deploy dist --project-name tars-atlas-news --branch main`.
- **"Erase all data"** and **"Replace everything"** act on the device only: the device then links again as a new one and merges with the account.


Native source remains in `android` and `ios`. Run `npm run cap:sync` before opening a native project. Physical device builds and signing require their respective platform SDKs.

Keep `lodestar` (IndexedDB), `lodestar-study` (PWA), `app.lodestar.study` (native), and `lodestar://` (deep links). See [foundation provenance](docs/FOUNDATION.md) for source pins, compatibility boundaries, asset checks, and verification results. Sync adds one more local identifier, the IndexedDB database `tars-sync-v1`, which holds no data that is not also in the stores above.
