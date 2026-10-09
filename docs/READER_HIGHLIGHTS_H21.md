# Reader Highlights H2.1

Local implementation on 2026-10-07 in codex/reader-highlights-h2, based on the completed uncommitted H2 worktree. No commit, push, merge, deployment or H3. Validator/PYQ worktrees were not modified.

## Delay diagnosis and interaction

H2 painted only after selectionCompletion, anchor capture, the repository transaction, Dexie liveQuery and React's durable repaint. Touch/pen intentionally waits 1,200 ms without handle changes; mouse waits 60 ms after completion. That entire chain was the visual feedback path. The baseline production fixture reproduced roughly 1.23 seconds for touch/pen. Mouse's first-selection-to-paint measurement also included the time spent dragging; completion-to-save was about 69 ms, rather than a hidden two-second database cost.

H2.1 separates immediate visual feedback from finalization:

- selectionchange and pointer/mouse/touch completion request one coalesced animation frame. A validated, cloned native Range is installed in tars-preview-<color> CSS Custom Highlights. Anchor creation and database work are absent from this path.
- Validation retains H1's endpoint, excluded-content, bounded excerpt and whole-article rejection rules. Excluded elements are cached with the article's text index; normalized boundary lookup is logarithmic. Anchor generation remains in captureSelection at finalization; resolution/overlap policy is unchanged.
- Native handle changes replace the preview on the next frame. Existing 60/1,200 ms stabilization intervals are unchanged. A stable completion creates one durable record, while a later completed selection is allowed to save independently of an earlier slow transaction.
- Pending previews stay until the corresponding durable records have been painted. Durable groups are installed before preview removal in the same task. Rejected writes/overlaps remove their previews and show the existing feedback. Disable, navigation and unmount remove previews; already started writes retain the usual durable semantics.
- Native Selection/Range and OS handles are never cleared, replaced, captured or prevented. For a valid painted selection only, native ::selection fill becomes transparent so it does not mask the custom paint underneath. Invalid/failed/deleted selections regain the normal fill. Explicit deletion allows a deliberate fresh selection of the same passage.

No changes to repository schema, IDs, colors, anchoring matching, persistence, backups, article fetching, routing, read/saved state, access/paywall policy or sync. Preview ranges exist only in memory and never enter backups or H3's future record contract.

## News visual integration

Highlights reuses news-body/news-feed and the 188 px News subject index at the existing 1,040 px breakpoint, within News' 960 px content container and responsive padding. Subject headings use news-section/eyebrow; article headings use story-title (Fraunces display face, 19.5 px desktop / 18.5 px phone, existing weight/leading); publisher/date/count use story-meta. Search uses news-search, subject selection uses news-field, and empty states use news-empty. Background, divider, ink, surface, focus and motion tokens remain News' own.

Passages show their full text at News' 14 px excerpt size, with a slim color rule and a restrained inline color wash. Large quote cards and repeated five-color palettes are removed. Each passage has one ellipsis edit trigger: revealed by hover/focus on desktop, always available on touch. It opens the existing Popover or phone BottomSheet with the shared five-color palette and delete action. Keyboard focus, Escape and focus return use the existing surface primitives. No new Notes, folders or revision system.

Grouping, deterministic ordering, Other, local quote/title search, subject filtering, reactive edits, retained unavailable/unresolved excerpts and Reader target scroll/focus remain H2 behavior. The library still fetches zero article bodies on load/reload and resolves no anchors until explicit Reader open.

## Timing evidence

Production build in local desktop Chrome, 188-paragraph fixture article, 375/1366 px and both themes. Real mouse drag; touch/pen lifecycle is simulated using native Selection/Range plus pointer events. First paint is conservatively estimated as the next animation frame after the non-empty CSS Highlight registration, rather than a screen/photon measurement. Storage completion is the native IndexedDB transaction complete event, installed before Dexie opens its connection. No production profiling or telemetry was added.

Baseline raw measurements: tools/browser/out/h21/before-timing.json. Final measurements: after-timing.json, including registration, transaction start/complete and durable paint events. Mouse first selection includes the ongoing drag; completion-to-save is reported separately to make that distinction explicit. The time before transaction start includes the quiet timer, capture/anchor validation and repository setup; transaction duration itself is separately available in raw evidence.

Baseline: one 1366 px light sample per input. After: ranges across four layouts (375/1366, light/dark).

| Input | Before selection → frame (ms) | After selection → registration / frame (ms) | Before selection → save (ms) | After selection → save (ms) | After save → durable frame (ms) |
| --- | ---: | ---: | ---: | ---: | ---: |
| mouse | 244 | 16–19 / 32–34 | 205 | 154–206 | 19–21 |
| touch | 1229 | 2–17 / 18–32 | 1207 | 1212–1222 | 14–18 |
| pen | 1230 | 4–16 / 20–33 | 1218 | 1208–1220 | 11–21 |

Mouse completion → durable save: baseline 69 ms; after 65–74 ms. The longer first-selection → save includes the real ongoing drag.

A real independent readwrite transaction held the highlight store for 800 ms: the app's queued write remained pending while its preview was already present. Exact blocked-writer measurements and screenshots are in after-timing.json and *-pending-preview.png. The test also adjusts touch/pen ranges before stabilization, verifies only the final exact quote is stored, and creates three rapid distinct mouse selections without losing records.

These are local fixture measurements, not physical S-Pen latency certification. Samsung's native handle/menu events, palm rejection, actual pen hardware and Samsung Internet remain untested. The stabilization guard is deliberately retained until physical-device evidence supports changing it.

## Verification

- Focused H1/H2/Reader/backup: 85 tests in 8 files; six new interaction regressions cover a blocked save, touch and pen final-range behavior, failure cleanup, rapid pending saves, and delete/reselect. The original anchor/overlap/repository/backup tests remain passing.
- npm run typecheck: passed.
- npm run lint: 0 errors, existing 133 warnings.
- npm test: 645 tests in 46 files passed.
- npm run test:pipeline: 39 passed, 6 skipped, 0 failures. Skips still require the external canonical ZIP.
- npm run build: passed, physical Atlas hashes verified, 166 PWA precache entries.
- Browser: Reader 320, News 276, H1 92, H2.1 responsiveness 60; Highlights library 140. All passed with no page errors.
- git diff --check: passed, including intent-to-add new files; no contents staged.

Evidence/logs: tools/browser/out/h21/{focused,tests,typecheck,lint,pipeline,build,responsiveness,library-browser}.log and Reader/News/H1 .mjs.log files. No live publishers, authenticated production, D1 or cross-device sync were exercised. News offline tests intentionally emit network-disconnected resource errors; their assertions and page-error checks pass.

## Visual inspection

Inspected the final Highlights library at 375/1366 px in both themes, including touch-visible ellipsis controls, the phone light edit sheet and desktop dark edit popover. Compared against Today (phone light / desktop dark) and Archive with Saved active and populated (phone light / desktop dark). Also inspected pending-preview Reader screenshots at phone light and desktop dark while a separate IndexedDB writer held the new save.

Screenshots: tools/browser/out/highlights-library/{375,1366}-{light,dark}-{library,focused,edit,today,archive,saved}.png; tools/browser/out/current-affairs-direct/{375-light,1366-dark}-archive.png for populated Archive/Saved; tools/browser/out/h21/{375-light,1366-dark}-mouse-pending-preview.png. Library browser results: tools/browser/out/highlights-library/results.json.

The first comparison caught a wrapped-phone search icon and duplicate desktop count caused by CSS ordering. Both were corrected, with a browser assertion keeping the icon inside its input and computed headline/section typography comparisons against Today. All four library layouts fit without horizontal overflow. The library still displays several subjects/articles/passages and the full saved excerpts.

## H2.1 changed files and Git

- docs/READER_HIGHLIGHTS_H21.md
- src/current-affairs/reader/highlights/anchors.ts
- src/features/current-affairs/reader/useHighlights.ts
- src/features/current-affairs/reader/reader.css
- src/features/current-affairs/reader/highlights.test.tsx
- src/features/current-affairs/HighlightsLibrary.tsx
- src/features/current-affairs/HighlightsLibrary.test.tsx
- src/features/current-affairs/highlights-library.css
- tools/browser/highlight-responsiveness-check.mjs
- tools/browser/highlights-library-check.mjs
- tools/browser/run.mjs

The worktree already contained completed H1/H2 changes when this task started. The root git diff is cumulative. Exact cumulative outputs are tools/browser/out/h21/git-diff-stat.txt and git-status.txt; H2.1-only comparison against the captured H2 baseline is h21-only-stat.txt. No protected source/data/generated artifacts were modified by H2.1. HEAD remains d21798db6212553e63420a8efd6e1f71c87417d9, branch codex/reader-highlights-h2. No contents staged, no commits or remote changes.
