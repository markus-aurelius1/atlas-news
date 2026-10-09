# TARS News Reader Highlights — H1

Status: locally complete and verified on 2026-10-07. No commit, push, merge, deploy, H2, H3 or sync implementation.

## Isolation

- Baseline: `d21798db6212553e63420a8efd6e1f71c87417d9`.
- Branch: `codex/reader-highlights-h1`.
- Worktree: `C:\Users\hario\.codex\worktrees\reader-highlights-h1\Atlas-News`.
- The dirty corpus checkout and all Validator v3 worktrees were left untouched.

## Architecture and exact UX

`ArticleBody` still builds React elements from the existing sanitizer allowlist. A body ref lets `useHighlights` index the rendered prose. CSS Custom Highlights paint native Ranges; no HTML mutation, injected mark elements, custom selection overlay, canvas, pointer capture or prevention of native selection.

The existing Reader toolbar has Highlighter (pressed/underlined state and an On label where space permits), plus Highlight colors and edits. Highlighter automatically saves completed native selections and stays enabled until disabled or the Reader closes. The current color survives reload in `tars.reader.highlight-color.v1`. Five colors only: yellow, green, blue, pink, orange. A check and pressed state identify the chosen color. The panel edits only the currently open article's excerpts; it is a desktop popover/mobile sheet, not the H2 library.

Mouse completion uses a 60 ms final-selection debounce after pointerup or native mouseup. Chrome can hand native selection off from Pointer Events and omit pointerup; mouseup is deliberately supported. Touch/pen/keyboard selection uses 1,200 ms without a new selectionchange, pointer activity or scrolling. Native takeover through pointercancel can continue with selectionchange; touchend covers the native touch completion path. Compatibility mouse events from touch/pen do not shorten the touch/pen pause. Disabling, closing, leaving the window or scrolling cancels pending work. Native selection and handles are never cleared after saving. Later handle adjustments run through the same debounce.

Only a single noncollapsed range wholly inside the article prose is accepted. Toolbar/header/outside/partly outside selections are rejected. Empty selections, the entire article, excerpts over 10,000 UTF-16 units, and selections crossing figures/captions/embed controls are rejected as a whole. Nothing is silently truncated. Inline elements and multi-paragraph selections retain one logical highlight and one Range.

The palette recolors or deletes existing excerpts. Automatic completion and failures produce a short visible, politely announced status. Controls remain keyboard accessible with focus states. Unsupported CSS Custom Highlight browsers get a disabled Highlighter and an explanation; saved excerpts remain available to edits/backup and are never discarded.

## Durable record and anchors

`ReaderHighlight`, schema version 1, contains:

- Stable UUID `highlightId`.
- `articleUrl`: existing News item identity passed through URL normalization, fragment removed. Redirect/canonical publisher metadata never silently replaces that identity.
- Feed title, publisher, sourceId; extracted publication date when present, otherwise feed date.
- `subjectSnapshot`: the first existing relevance subject, or null; `categorySnapshot`: existing feed section, or null.
- `quote`: the exact native Selection string, including selected edge whitespace.
- `anchor`: version 1, whitespace-normalized quote, up to 64 characters of prefix/suffix, normalized start/end offsets.
- Fixed palette color, createdAt, monotonically increasing updatedAt, optional deletedAt.
- Local derived resolution: pending, resolved or unresolved.

The record has no full article body/HTML, extraction output, Range, DOM indexes, cookies or auth. Context is deliberately bounded. Subject/category are snapshots, not identity; later classification cannot invalidate highlightId.

Restoration order:

1. Build a normalized rendered-prose index once per body revision. Collapse whitespace; represent paragraph/block boundaries and br as spaces. Inline markup does not separate words.
2. Find exact normalized quote occurrences, bounded at 257 candidates. Accept one candidate satisfying both saved contexts (or the one context available at an article edge).
3. If that does not resolve, require a globally unique exact quote plus at least one fully unchanged adjacent context of at least 16 characters.
4. Ambiguous, missing or insufficiently supported passages remain unresolved. Keep their original records, quotes and timestamps. Never choose the closest offset or a fuzzy/semantic match.

Offsets are retained as useful future hints and original provenance; they never override context ambiguity. A duplicate passage at the old offsets is still ambiguous. Resolution cache is per text-index revision and anchor; recolor/status updates do not re-search all quotes. Resolution writes do not change updatedAt. New-article rendering filters old subscription records by article identity before resolving them.

## Overlap policy

Conservative H1 policy for all colors:

- Exactly the same resolved range reuses its existing record/identity without changing color.
- Any other actual overlap is rejected with an explanation; no existing record changes.
- Adjacent ranges are separate records; no automatic merging.
- Recolor is explicit in the article panel; deletion is a tombstone.

Creation and overlap checks run in one IndexedDB transaction, including concurrent duplicate creation. No nested marks or corrupt duplicates are possible because painting never adds marks.

## Persistence, backups and sync boundary

New separate Dexie database `tars-reader-highlights`, schema 1 (`records`, key `highlightId`, indexes `articleUrl` and `updatedAt`). No change to `lodestar` v1/v2, opaque historical stores, feed cache, archive or News personal-state formats. No reset or migration of current data is needed. Unknown future local highlight schemas remain untouched by normal reads and Replace restoration.

`HighlightRepository` exposes create, readByArticle, observe (Dexie liveQuery, including other local tabs), recolor, remove, setResolution, backup and restore. Edits/delete use increasing timestamps even when the wall clock stalls. Read/observe exclude tombstones; backups retain them.

Backup version 4 adds optional `extras.readerHighlights`. New exports include an explicit empty list when there are none. Merge compares stable IDs/edit times; equal-time tombstones win. Explicit Replace replaces known H1 rows when the highlight field exists. v1-v3 backups and any backup lacking the field leave highlights untouched, including Replace. Erase all data clears highlights only as part of that existing explicit user action. All imported records go through the same allowlist parser. Unknown/malformed highlight schemas fail parsing/export rather than being silently discarded. Existing opaque historical rows and News state keep their previous round-trip behavior. Settings reports restored highlights and names them in erase disclosure.

**H1 does not send highlights anywhere.** No sync collection, adapter, wire version, cursor, D1 schema, /api/sync or publisher policy changed. No new article fetches or prefetches. The existing reader collection still exclusively represents smry day counts.

## H2 and H3 consumer contract

H2 should consume the exported version-1 types and `HighlightRepository` from `src/current-affairs/reader/highlights/model.ts`, `repository.ts` and `anchors.ts`. Use highlightId for identity; articleUrl and subjectSnapshot/categorySnapshot only for grouping. Use quote even when resolution is unresolved or the article is unavailable. Recolor/delete via the repository; do not edit sanitized HTML or derive identity from subject, quote or mark positions. A cross-article query/library and revision UI belong to H2 and are not implemented. Future spaced-repetition fields should be keyed by the same highlightId, with an additive schema migration; H1 has no repetition scheduling.

H3 may add a separate opt-in sync adapter around this local repository. It must explicitly design authenticated collections, protocol/cursor changes, conflicts, deletion/tombstone semantics and account/device behavior then. createdAt/updatedAt/deletedAt support that design; resolution is local derived state and must not become an authored remote edit. No H3 wire behavior is implied by H1. Never transmit article bodies/extraction output. Backups are explicit file export/import, not automatic sync.

## Performance and limitations

Indexing is linear in rendered prose, once per DOM revision. Selection completion uses binary boundary lookup, not a character scan. Pointermove has no handler; selectionchange only resets a timer. Anchoring is bounded by quote candidate count and cached per article/anchor revision. Creation resolves current article highlights once inside its atomic overlap transaction; no network/AI service is involved.

The long-article browser fixture restores 82 persisted excerpts over more than 180 paragraphs. Final measurements are recorded below and in `tools/browser/out/highlights/results.json`. They are local desktop Chrome timings, not mobile hardware budgets.

The browser has no universal native handle-finished event. A 1.2 s idle interval is the deterministic completion signal; a user pausing longer while adjusting handles can save an intermediate range. Further overlapping selections are conservatively rejected, so the user may edit/delete and select again. Physical touch/pen feel needs hardware review. Unsupported browsers need an update; H1 intentionally does not add a DOM-mutating fallback.

No offline article body was added: saved excerpts survive offline, and paint restores only when the existing Reader has the article text in memory or refetches it. H2 will own a library for excerpts when the body is unavailable. No highlighting of image captions or embed controls. Excerpt limit is 10,000 characters; no full-body selection. Anchor matching deliberately favors unresolved over an uncertain placement.

Samsung Internet / physical S-Pen verification: NOT VERIFIED

## Verification

Final results are below. The focused suite covers selection boundaries, disabled mode, completed mouse/mouseup fallback, touch/pen idle adjustment, exact/context/duplicate/br/inline/block anchors, changed text, recolor/delete/overlaps/concurrent repeats, persistence/reopen/multiple articles, monotonic clocks, backups/legacy/opaque storage and non-persistence of article bodies. Existing Reader and News suites cover routing, Back/focus/scroll, keyboard navigation, Read/Saved, images/sanitization, offline/session/terminal fallback and smry count.

Screenshots visually inspected so far: mobile light palette and desktop dark multiline paint. They show a compact toolbar, restrained selected swatch check/ring, a readable mobile sheet and no altered article layout.

The baseline Reader browser fixture's publisher stub was made an explicit hostname predicate after its prior wildcard let a modified-click tab reach a live publisher and time out. All original behavior assertions are retained.

## Final verification results — 2026-10-07

| Check | Collected result |
| --- | --- |
| Focused H1 + baseline Reader + backup tests | 70 passed in 6 files |
| New focused H1 tests | 42 tests: anchors (15), completion timing (5), repository/storage (12), React integration (10) |
| npm run typecheck | Passed |
| npm run lint | Passed: 0 errors, 133 retained warnings, matching the baseline |
| npm test | 630 passed in 44 files |
| npm run test:pipeline | 39 passed, 6 skipped, 0 failed |
| npm run build | Passed; Atlas source hashes verified; 166 PWA precache entries |
| npm run test:browser | Passed end-to-end |
| H1 browser | 92 checks: desktop/narrow viewport, light/dark, actual mouse drag, simulated touch/pen lifecycle, palette/edit/delete, reload/reopen, contrast and long articles |
| Reader browser | 320 passed, no page errors |
| News browser | 276 passed, no page errors |
| Other root browser checks | Shell 36, cold starts 6, label/marker 90, Atlas interactions, canonical question/offline checks in both themes, and recall persistence all passed |
| git diff --check | Passed across existing and new H1 files |
| Protected scope | No changes under public, src/atlas, tools/atlas-build, src/sync, functions or migrations; package/dependency files, README and AGENTS unchanged |
| Samsung Internet / physical S-Pen | NOT VERIFIED |

Six pipeline tests explicitly require `canonical-pyq-v2-final.zip` or `CANONICAL_PYQ_PACKAGE`. That external canonical package was not available in this isolated checkout; those release-package checks were skipped by their existing guards. No thresholds or regression assertions were weakened.

Physical Samsung touch/handle behavior is not covered by the simulated Pointer Events tests. No authenticated production, Android/iOS, cross-device or live D1 claim is made.

The final production-browser long-article run restored 82 excerpts across 188 paragraphs. Reload-to-all-paints measurements (including page/Reader loading, extraction, layout and browser automation) were 1,062 ms at 375/light, 1,139 ms at 375/dark, 1,666 ms at 1366/light and 1,087 ms at 1366/dark. These are observed desktop Chrome timings, not isolated anchor CPU times or physical-device budgets. No per-pointer scan occurs.

Visual QA inspected mobile light/dark palette, desktop light palette, desktop dark multiline painting and mobile dark long-article scrolling. Native mouse selections were exercised by real Playwright mouse drags, with Selection text retained after saving. Touch/pen lifecycle checks deliberately use synthetic events and are not hardware certification.

Evidence: `tools/browser/out/highlights/results.json`, its four-layout screenshots, and logs under `tools/browser/out/h1/`. Exact Git outputs are `tools/browser/out/h1/git-diff-stat.txt` and `git-status.txt`. New files are intent-to-add for complete diff review; no contents are staged, and HEAD remains the baseline. No commit/push/merge/deploy, H2, H3 or automatic sync work was performed.

## Exact changed files

- `docs/READER_HIGHLIGHTS_H1.md`
- `src/current-affairs/reader/highlights/anchors.test.ts`
- `src/current-affairs/reader/highlights/anchors.ts`
- `src/current-affairs/reader/highlights/model.ts`
- `src/current-affairs/reader/highlights/repository.test.ts`
- `src/current-affairs/reader/highlights/repository.ts`
- `src/current-affairs/reader/highlights/selection.test.ts`
- `src/current-affairs/reader/highlights/selection.ts`
- `src/data/backup-extras.test.ts`
- `src/data/backup-extras.ts`
- `src/data/backup.ts`
- `src/features/current-affairs/reader/ArticleBody.tsx`
- `src/features/current-affairs/reader/HighlightControls.tsx`
- `src/features/current-affairs/reader/Reader.tsx`
- `src/features/current-affairs/reader/highlights.test.tsx`
- `src/features/current-affairs/reader/reader.css`
- `src/features/current-affairs/reader/useHighlights.ts`
- `src/features/settings/SettingsScreen.tsx`
- `tools/browser/highlights-check.mjs`
- `tools/browser/reader-check.mjs`
- `tools/browser/run.mjs`
