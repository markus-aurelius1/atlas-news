# TARS News Highlights Library — H2

Local implementation on 2026-10-07. Branch: codex/reader-highlights-h2. Worktree: C:/Users/hario/.codex/worktrees/reader-highlights-h2/Atlas-News.

## Base and isolation

H1's branch points at d21798db6212553e63420a8efd6e1f71c87417d9 and its completed implementation is uncommitted. This worktree was created from that branch, then received an exact copy of the H1 changed files before H2 edits. The H1 worktree, dirty PYQ checkout and Validator worktrees were not modified. H2's Git diff consequently includes the inherited H1 implementation; the H2-only file list is below. No commit, push, merge, deployment, remote creation or H3 implementation.

## Exact UX

News has Today / Archive / Highlights. Highlights opens at #/current-affairs?view=highlights and survives reload on that address. The local library displays full saved passages, with their color, beneath subject and article headings. Each article shows the saved title, publisher, valid publication date if present and matching highlight count. Five H1 swatches recolor each individual passage; the delete button writes H1's tombstone. The selected color has a check and ring. Search matches saved quote/title, case-insensitively; a subject select filters groups. No tags, folders, handwritten notes, flashcards, repetition scheduler or old Notes UI.

Article title opens Reader at its top. A passage opens the same Reader with read=<articleUrl>&highlight=<highlightId>; the library stays mounted behind it. H1's conservative anchor resolver locates only the explicitly opened article's passages. A resolving target scrolls into view and gives keyboard focus to its containing prose block, with its CSS Custom Highlight still painted and a focus outline. Native Selection is not replaced. The library opens one source at a time; ordinary Today/Archive Reader queues retain their previous/next behavior. Escape/Back restores the passage button's focus through the existing surface behavior.

## Grouping and ordering

Every non-deleted version-1 row appears exactly once, in its own subjectSnapshot. Known subjects use the existing News syllabus order, now exported unchanged from src/current-affairs/subjects.ts. Null and unrecognized snapshots go to Other, last. An article with differently snapshotted subjects can appear in both groups, each containing only that subject's passages; the record never changes its group because a validator changes.

Within each subject, articles sort by their newest live highlight updatedAt, newest first, with articleUrl as the tie-break. Display metadata comes from the newest row (createdAt then highlightId break ties). Recolor is saved activity and can move its article upward. Passages sort by stored normalized anchor start when available, then createdAt and highlightId. Positions are ordering hints only and never authorize a Reader match. Search counts describe the matching passages. highlightId remains the identity; duplicate excerpts retain separate records.

## Independence, unavailable sources and unresolved anchors

The library has no feed/archive/validator join or deletion cascade. It renders saved quote and article snapshots even if Today, Archive and Saved are empty, the source is no longer listed, or fetching fails. H2 never deletes on article removal or failed resolution. Explicit highlight deletion, and H1's existing explicit backup Replace/Erase semantics, retain their previous behavior.

Opening uses a real listed entry when present; otherwise the saved safe metadata is passed to the existing Reader as a snapshot. No fabricated WorkspaceEvent/relevance verdict is created. For an orphan source, Read/Saved controls are disabled because there is no News story to mark. The existing policy still decides whether a URL may be fetched, and existing terminal links remain unchanged. No external link is added to the library.

After an attempted open fails, the library shows Article unavailable · saved passages kept for that article during the current News visit. This availability hint is deliberately not persisted and resets on reload; no probe is made to recheck it. The underlying excerpt stays available. An unresolved anchor shows Passage no longer locatable. Its original quote stays fully visible in the library; a targeted Reader failure also shows that saved quote above the existing failure state. H1's derived resolution still persists locally without changing authored timestamps.

## Repository and performance

HighlightRepository gains readAll and observeAll. The query uses H1's existing updatedAt index, excludes tombstones/unknown future schemas from the active library and emits through Dexie liveQuery, including edits through another repository. There is no database version change, new store, schema migration or new index. The separate tars-reader-highlights database and H1 backup-v4 field remain unchanged.

Library rendering reads personal excerpts and snapshots only. No article-body fetch, extraction, DOM indexing or anchor resolution runs on library startup. Article bodies are fetched only after an explicit Reader open through the existing bounded gateway and remain memory-only. Grouping/search are local; the library currently reads all excerpts, so six-record timings are not a large-library benchmark.

## H3 boundary

H2 adds no sync collection, D1 table, account state, protocol/cursor version, adapter or API change. A future explicitly authorized H3 must sync independent highlightId records and monotonic createdAt/updatedAt/deletedAt semantics, preserve tombstones and backups, and treat resolution and availability as local derived state. Subject/article metadata remain snapshots rather than identity or parent rows; no feed disappearance may cascade a remote deletion. Never transmit article bodies or extraction output. No H3 is started here.

## H2-only changed files

- docs/READER_HIGHLIGHTS_H2.md
- src/current-affairs/subjects.ts
- src/current-affairs/reader/highlights/repository.ts
- src/current-affairs/reader/highlights/library.ts
- src/current-affairs/reader/highlights/library.test.ts
- src/features/current-affairs/NewsScreen.tsx
- src/features/current-affairs/HighlightsLibrary.tsx
- src/features/current-affairs/HighlightsLibrary.test.tsx
- src/features/current-affairs/highlights-library.css
- src/features/current-affairs/useHighlightLibrary.ts
- src/features/current-affairs/reader/HighlightControls.tsx
- src/features/current-affairs/reader/Reader.tsx
- src/features/current-affairs/reader/useHighlights.ts
- src/features/current-affairs/reader/reader.css
- tools/browser/highlights-library-check.mjs
- tools/browser/run.mjs

No H2 changes under public, src/atlas, src/features/atlas, tools/atlas-build, tools/current-affairs, src/sync, functions, migrations, src/data, README, package/dependency files or AGENTS.md. The backup/Settings changes visible in the cumulative diff are inherited H1 files, unchanged by H2.

## Verification

Evidence files live in ignored tools/browser/out/h2 and tools/browser/out/highlights-library.

| Check | Result |
| --- | --- |
| Focused H2 tests | 9 passed (grouping 4, cross-article repository 2, library UI 3) |
| Focused H1/H2/Reader/backup suite | 79 passed in 8 files |
| H1 tests | All 42 retained tests pass inside the focused/root suites |
| npm run typecheck | Passed |
| npm run lint | Passed: 0 errors, 133 warnings, matching H1 |
| npm test | 639 passed in 46 files |
| npm run test:pipeline | 39 passed, 6 skipped, 0 failed; the unchanged skipped checks require the external canonical ZIP |
| npm run build | Passed; physical Atlas hashes verified; 166 PWA precache entries |
| git diff --check | Passed, including all new files marked intent-to-add |

The first broad browser attempt timed out waiting for the Atlas moving state; no Atlas code or assertion changed. A separate Reader run exposed a headline/scroll-reset race. Reader now resets scroll before paint (useLayoutEffect), and availability reporting is restricted to sources with saved highlights. The final sequential browser rerun exercises the same original assertions.

Verification is local production-build Chrome with fixture feeds/articles, not authenticated production, live D1, cross-device sync, Samsung Internet or physical touch/S-Pen certification. No publisher bodies are fetched by the tests from the live internet.


## Final browser and visual results

npm run test:browser passed end-to-end on the final production build. News: 276 checks; Reader: 320; H1 highlights: 92; H2 library: 132, all with no page errors. The unchanged shell (36), cold-start (6), map label/marker (90), Atlas interaction, canonical/offline checks in both themes, and recall integration also passed. No assertion or threshold was weakened.

H2's four-layout matrix (375/1366 px, light/dark) covers multiple articles, subject order/Other, passage order, duplicate IDs, tombstones, local search/filter, reactive recolor/delete, persistence, archive metadata removal, no startup anchor resolution or body fetch, orphan metadata opening, target scroll/focus and H1 paint, Back focus, failed sources/two existing links, unresolved excerpts and Today/Archive/Saved controls.

Observed six-excerpt reload-to-visible timings: 475–585 ms, including page loading and browser automation. This is a small desktop-Chrome fixture, not a phone hardware or large-library benchmark. Zero /api/article requests on library load/reload; only an explicitly opened source is requested.

Visually inspected: phone light library, desktop dark library and the final phone dark focused Reader after opacity settled. No horizontal overflow in the four library layouts. Screenshots: tools/browser/out/highlights-library/{375,1366}-{light,dark}-{library,focused}.png. Exact checks and timings: tools/browser/out/highlights-library/results.json. Full log: tools/browser/out/h2/browser-final.log.

## Git evidence

The complete Git diff includes H1 carried forward from its uncommitted worktree. Exact current outputs are tools/browser/out/h2/git-diff-stat.txt and tools/browser/out/h2/git-status.txt. H2-only files and comparison with completed H1 are tools/browser/out/h2/h2-only-files.txt and h2-only-stat.txt; scope.json verifies zero protected H2 changes. New files are intent-to-add for diff review; no file contents are staged. HEAD remains d21798d. No commit, push, merge, deploy or H3 work was performed.
