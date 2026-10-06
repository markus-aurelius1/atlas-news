# Foundation provenance and contracts

## Sources

Application baseline: `a46cbe5c73862f5f8aa4fb28ea1844d0afbf9df4`, from the owner's `handoff/claude-overhaul` release in `markus-aurelius1/focus-timer`. The owner confirmed this full SHA after the supplied SHA could not resolve.

Selective secondary input: `b669ec6dac1a3b3653f74b2b7ab4bb644c12130f`, the fetched `codex/atlas-news-architecture` tip. The supplied `43970833b65853cfc892efdd66e721fe210af85b` was unavailable even after fetching that branch. Only the independently audited News cache/gateway code, SoI outline/importer/validation, and the relevant News browser fixture checks came from this input. Its map implementation, marker presentation, online provider and disclosure changes are excluded.

The baseline shell, map projection, cartographic styles, tile/label/camera implementation, regional sheets, relief rasters and geography are retained. `asset-origins.json` records the original map asset hashes and place-record identity. All 2,273 place records match the baseline exactly. All 149 canonical question bodies, relationships and answer records match exactly. The gazetteer generator omits unused journey metadata and reuses existing overlays for a fully offline places-only rebuild.

Canonical packs were regenerated through the pinned pipeline to update source identity and correct a CRLF-versus-LF byte-hash mismatch in the archived source packs. Their question/answer hashes and IDs remain stable. `.gitattributes` prevents future checkout conversion of public runtime data. The canonical source ZIP remains an external, verified release input; it is not committed or hosted.

## Included architecture

- `src/app`, `src/ui`, `src/services`: retained shell, responsive navigation, surfaces, platform lifecycle, install/export and accessibility.
- `src/atlas`, `src/features/atlas`, `src/game`: offline physical map, search, geographic details, canonical PYQs, recall history/mastery and the existing recall ranks/challenges.
- `src/current-affairs`, `src/features/current-affairs`: publisher registry, deterministic relevance, clustering, archive and Read/Saved state. Relevance (`relevance.ts`) is a weighted-evidence model with one acceptance threshold: syllabus concepts from `public/current-affairs/v2/relevance-index.json` matched in the headline (full weight) or feed summary (half), past-paper recurrence, framing, India/Uttar Pradesh setting and a small feed prior, weighed against noise vocabulary in `evidence-lexicon.ts`; no feed is accepted without a concept, and every verdict carries its `evidence` list. After the score, a substantive-value gate (`SUBSTANCE` and `LOW_VALUE` in `evidence-lexicon.ts`) decides whether an article that names a syllabus entity also reports something: a law or rule, a judgment, a policy or scheme change, an official report or data, an institutional reform, a regulatory action, a constitutional or federal issue, an international agreement or conflict, a science or environment finding, or an explainer, editorial or specialist analysis. A signal counts 2 in the headline and 1 in the summary; each low-value headline pattern (partisan reaction, candidate list, operational notice, routine company news, product recall, crime or influencer story, quote-led remarks) takes 2 away, an operational notice 4, and beside such a headline only headline signals count; the remainder must be positive, and a headline spoken by a party is rejected outright. The gate does not change the score, the threshold, ranking or clustering, and because stories are built only from accepted articles, every article shown in a story has cleared it individually. The verdict records it in `substance`. `fixtures/substance-cases.json` holds the eleven live false positives the owner flagged on 2026-10-05. The index is rebuilt with `npm run news:relevance -- --package=<canonical PYQ zip> --taxonomies=<taxonomy folder>` from `tools/current-affairs/lexicon.mjs`; all counts are mechanical document frequencies over CSE and UPPCS Prelims and GS Mains. Accepted articles become stories in `cluster.ts`: reports of one event merge by weighted headline, summary and concept similarity (within an edition day, and across midnight when the next report follows within 18 hours), a story shows at most five articles (one per publisher first, a preferred paper leading, the newest always included) and keeps further reports only as URLs in `overflow` so Read/Saved state survives a change of shown articles, and a story only one publisher carries needs a score of 7.2 rather than the 6.5 acceptance threshold. Reports whose named parties mostly differ (India–EU against India–US) never merge, multi-topic digests such as "UPSC Key" never join a story, and a shared named phrase ("GST Council") helps already-similar reports merge. Stories are ranked by `storyValue` in `workspace.ts` (best syllabus match, past-paper recurrence, concept specificity, India/Uttar Pradesh, preferred-paper and explainer coverage, number of publishers); the rolling 24-hour list shows the top `TODAY_STORY_LIMIT` (100) and the rest remain in the Archive. US stories with no India, international or scientific dimension are penalised as domestic. `npm run news:snapshot` and `npm run news:audit` compare the validator with the frozen pre-overhaul one (`tools/news/legacy`) on a live registry snapshot and on the hand-labelled cases in `src/current-affairs/fixtures/relevance-cases.json`. The owned `tars-news-feed-v2` cache revalidates after two hours or explicit refresh; failed refreshes never replace successful snapshots. Redundant service-worker feed caching is excluded.
- `tools/atlas-build`, `tools/current-affairs`: current source generators, canonical validation and geography/PYQ contracts. Root npm workspaces provide one fresh lockfile for data and browser tooling.
- `src/sync`, `functions/api/sync.ts`, `functions/api/_middleware.ts`, `functions/api/session.ts`, `migrations/`: local-first sync of durable personal state between devices of one Cloudflare Access account, stored in D1. `protocol.ts` is the wire contract, `access.ts` verifies the Access JWT, `d1.ts` is the one-transaction exchange, `adapters.ts` maps each collection to the app's existing storage, `engine.ts` is scan → exchange → apply, and `runtime.ts` schedules it. The feed snapshot and the archive of unsaved articles never leave the device. See README, "Sync".
- `functions/api/current-affairs.ts`, `wrangler.toml`, public headers/routes: Cloudflare Pages deployment. The registry-only gateway serves one fixed shard of the registry per request (13 shards of at most six feeds, `src/current-affairs/shards.ts`), so no invocation exceeds six upstream requests; it rejects publisher redirects, fetches six feeds at once inside a 15-second budget, shares pending collections per shard, caches successful responses for two hours and updates the canonical edge key during forced refresh. The local preview adapter lives in `tools/news/server.ts`.
- Native source, icons and PWA build/configuration remain. All installed-app identifiers remain unchanged. The native apps have no sync endpoint and stay local-only.

## Storage compatibility

`src/data/compatibility/schema.ts` retains the exact historical Dexie v1/v2 store/index declarations and upgrade behavior. IndexedDB remains `lodestar`. Removing those store declarations can delete old records during upgrade, so historical stores remain opaque and have no active typed product access, seeding or subscriptions. Current writes expose only recall attempts and recall reward claims.

`compatibility/merge.ts` performs the existing timestamp/tombstone merge for explicitly requested backup restoration. Historical rows and unknown settings fields round-trip unchanged. `compatibility/notes.ts` contains only the old note wire-format parser; old note editing/rendering code is excluded. Existing article-note fields stay dormant in News personal state and backups. Boot does not read or modify unrelated localStorage keys. The existing confirmed replace/erase flows remain explicit user actions.

Sync does not change any of these formats. It keeps its own database, `tars-sync-v1` (the rows last agreed with the server, an outbox and a cursor), finds local changes by comparing the app's storage with it, and writes changes from other devices through the same parsers and through `compatibility/merge.ts`. Historical tables are not read by sync and never leave the device. Reading state or notes that this version cannot parse stop sync rather than being overwritten or uploaded; a storage key that disappears is restored from the agreed rows instead of being treated as deletions. Erase and Replace reset the sync database so they are never passed on as deletions.

The PWA ID is `lodestar-study`, native ID is `app.lodestar.study`, and the existing `lodestar://` scheme remains supported alongside the newer scheme. Web routes are Atlas, News (`#/current-affairs`) and Settings; unknown routes canonicalize to Atlas.

## Official outline

The separately bundled SoI outline lives in `public/atlas-assets/v1/india-controlled-border.geojson`; provenance lives beside it. It is precached and validated by the asset build. It does not replace or flatten the baseline physical sheets in this migration.

Official source: https://surveyofindia.gov.in/documents/Outline_of_India.zip

Archive SHA-256: `bf48477f01fe8addd6384490fc6f8decc9643110331ffef2c3f17e5cccd53b88`.

The archive was downloaded independently and its SHA verified. Reprojection and 5% keep-shapes simplification reproduced 256 lines and 31,905 points, including the north-western claimed-territory sector. The maximum coordinate difference from the original import was 2.85e-14 degrees, due to platform floating-point rounding; the recovered asset and its original provenance are preserved. The provenance records source URL/page, scale, archive SHA, converted SHA, display generalization and extents. Asset hashes are verified on each build.

To reproduce, download that archive, verify its SHA, extract it, and run:

```sh
npx mapshaper Outline_of_India.shp -proj wgs84 -o format=geojson Outline_of_India_wgs84.geojson
npx mapshaper Outline_of_India_wgs84.geojson -simplify 5% keep-shapes -o format=geojson Outline_of_India_display.geojson
npm run atlas:soi -- --geojson=Outline_of_India_display.geojson --source-sha256=bf48477f01fe8addd6384490fc6f8decc9643110331ffef2c3f17e5cccd53b88 --generalization="Survey of India 1:16M source; reprojected to WGS84; Mapshaper simplify 5% keep-shapes for display"
npm run atlas:assets
```

Do not pass projected coordinates as longitude/latitude; the validator rejects them. Reimport does not replace source facts or physical cartography.

## Excluded material

The inclusion inventory leaves out all retired productivity screens, engines, commands and media; the old Notes UI; map experiments; profiling candidates; historical screenshots, logs, roadmap/handoff documents; old branch-specific publishing workflows; Vercel deployment configuration; unused source modules; placeholder native tests; and separate nested lockfiles. Prettier and its unused command were removed. The secondary online map dependency was never included. Existing fonts, Capacitor plugins and data-builder dependencies remain because the current app or reproducible geographic pipeline uses them.

The original repository was used read-only. All modifications, generation and native sync ran in this new directory. No branch in the original repository was modified.

## Verification and text audit

See `VERIFICATION.md` for final command results. The text audit scans source-controlled material and built `dist`, excluding dependencies, Git internals and generated QA output. Its exact occurrence inventory is reproducible with `node tools/audit-foundation.mjs`; the output is placed in ignored browser QA output. Third-party dependency source is outside the application audit and is covered by the lockfile/dependency review.

The requested broad regular expression also matches standard keyboard focus/CSS accessibility APIs, map focal rectangles, scheduling variables and test clock APIs, Gradle build syntax, source provenance, and factual geography/PYQ text such as habitat or planning. Those are current content or platform terminology. Historical store/index identifiers occur only in the compatibility schema and its shipped bundle. Every occurrence is assigned a specific reason; no unexplained retired product reference is allowed.
