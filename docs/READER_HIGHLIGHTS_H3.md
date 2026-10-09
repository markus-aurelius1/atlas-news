# Reader Highlights H3

Parent freeze SHA: `61c3070b05c33000432dfee5336cf74367a4edff`.
Branch: `codex/reader-highlights-h3`.
Implementation was completed without a commit. The owner subsequently authorized one local freeze commit, `Add cross-device Reader Highlights sync`, on 2026-10-08. Push, merge, deployment and production migrations remain unauthorized.

## Isolation

Worktree: `C:/Users/hario/.codex/worktrees/reader-highlights-h3/Atlas-News`.
The parent commit contains the completed H1, H2 and H2.1 implementation and their contracts. The parent SHA above was recorded before editing. No Validator/PYQ worktree or source/generated Atlas data is part of this change.

## Architecture and compatibility proof

Highlights use `POST /api/highlights-sync`, contract `tars-highlight-sync/v1`. The legacy `/api/sync` protocol, collection allowlist, engine execution, D1 queries, `sync_users` counter, `sync_records` table and `tars-sync-v1` cursor are unchanged. The shared internal outcome type gains an optional `more` flag for bounded H3 continuation; the legacy engine emits no such flag.

Migration `0002_highlights.sql` adds `highlight_sync_users` (one sequence counter per authenticated account) and `highlight_sync_records` (primary key account + highlightId), with its own `(user_id, seq)` cursor index. Nothing references News/archive rows. Tombstones have no retention expiry or cascade.

The streams occupy disjoint tables and counters. Every legacy query names only `sync_*`; every Highlights query names only `highlight_sync_*`. Thus any sequence of legacy exchanges leaves Highlights records and sequence numbers invariant. A first H3 client requests Highlights cursor zero, irrespective of its legacy cursor, and reads every current account record in sequence order. Old clients cannot read, acknowledge or advance this cursor. The compatibility test runs legacy writes before, between and after highlight writes, advances the legacy cursor, then retrieves the full Highlights library from zero. The legacy parser continues to reject a `highlight` collection.

Only lifecycle scheduling, the existing cross-tab navigator lock, the authenticated middleware and D1 binding are shared. Each stream has independent pause/error state: an unavailable Highlights service does not suppress automatic general uploads. No additional polling interval is introduced. Startup, wake/reconnect, the existing five-minute visible-app interval, manual sync and authored local changes use the existing scheduler. Native copies remain local-only.

## Wire and server exchange

Requests contain `protocol`, `cursor`, optional account precondition, and `changes`. A write requires a bound account precondition; the identity itself always comes from the middleware's verified Access JWT. Cross-origin writes, unauthenticated requests and account mismatches are refused before D1 exchange.

Only H1 authored fields are admitted: version, highlightId, articleUrl, title, publisher, sourceId, publishedAt, subjectSnapshot, categorySnapshot, quote, anchor, color, createdAt, updatedAt and optional deletedAt. The strict parser rejects unknown top-level/record/anchor fields and uses H1 text bounds, palette and URL validation. It additionally checks timestamp chronology and the existing future-clock tolerance. Resolution, availability, preview Ranges, HTML, extraction output and article bodies are not wire fields. H3 never fetches a publisher article.

Pushes have at most 100 records and 512,000 UTF-8 body bytes, measured before sending and before server JSON parsing. Large multibyte excerpts cause smaller chunks. Pulls have at most 100 rows, with a byte-limited page in addition to that count. Receipts contain at most one bounded authored row for each of the at-most-100 submitted IDs. A response can contain a page plus receipts; clients validate both before writing anything. A call performs at most 100 exchanges, with remaining outbox work scheduled through the existing lifecycle.

One D1 batch transaction ensures the account counter, conditionally upserts submitted winners, reserves sequence numbers, pulls rows after the cursor, and reads server winners for every submitted ID. Pull is after push. The returned cursor is the last row in the returned page, never the account head. Receipts also return an existing tombstone when a stale submitted live row was rejected, including when its sequence lies before the client's cursor. They do not independently advance the cursor.

Sequence reservations may leave gaps, including on replay. Duplicate payloads do not rewrite record versions/sequence numbers or create duplicate logical records. Gaps carry no state and cannot hide a row: queries use `seq > cursor`, not contiguous integer arithmetic. Concurrent exchanges serialize as D1 batches.

## Conflict ordering and deletion

The same strict total order is used by server SQL, remote apply and backup merging:

1. A tombstone always outranks a live row, regardless of either timestamp.
2. Within live rows, or within tombstones, the larger updatedAt wins.
3. At equal updatedAt, the lexicographically larger canonical authored payload wins.

Canonical JSON sorts object keys and escapes non-ASCII UTF-16 units, so JavaScript string comparison and SQLite BINARY comparison have exactly the same ordering, including supplementary Unicode. Equal payloads are no-ops. A deletion can never be undone for that highlightId. Highlighting the passage again uses H1's new UUID. Local restore Merge and Replace preserve already known terminal IDs; Replace can replace the live library but cannot revive a deleted logical ID.

Remote application retains an existing row's local resolution field; a new remote row begins with local `pending` resolution. It never writes an availability hint or a preview. No News removal or article disappearance produces a highlight deletion.

## Local DB, crashes and migration

The separate `tars-reader-highlights` database advances additively from Dexie version 1 to 2. Its existing `records` store/indexes are retained byte-for-byte. Three stores are added: `syncRows` (server-authored winners by highlightId), `syncOutbox` (pending authored payloads by highlightId), and `syncMeta` (account binding, independent cursor and last-sync time). No `lodestar`/historical store or legacy sync database migration is made.

A transactional scan compares authored values with server winners, discovering pre-H3 highlights and imported records automatically. IDs, snapshots, quote/anchor and authored timestamps are not restamped. Missing rows are never inferred as deletes. Only authored differences enter the outbox. Resolution-only notifications do not schedule a network request; availability and previews are outside storage entirely. The library is not sent after each edit: a one-record edit queues one record.

Receive validates the entire response and all required receipts before starting a write transaction. In one IndexedDB transaction it compares against the current local records (including edits made while the request was in flight), applies winners, records server versions, settles/requeues outbox entries, binds the account and advances the cursor. A thrown write rolls all of these back. No cursor can be persisted past unapplied remote data. Retrying a committed server exchange after a lost response or local crash is safe. Recording remote winners alongside records prevents echo uploads.

On first authenticated H3 sync, an unbound profile makes a read-only exchange using the existing legacy account, if known, as its precondition. The authenticated returned account and the first downloaded page are persisted atomically before any authored upload. Subsequent bounded exchanges upload existing local records and download remaining pages. An empty new device follows the same path and downloads the account's library.

## Account and explicit reset behavior

The existing account semantics bind a browser profile's personal library to one account; there is no automatic per-account library switch. H3 inherits the legacy binding on first use and keeps its own binding thereafter. Account A to B yields the existing Sync paused / Sign in with the linked account treatment. Local excerpts and queued edits remain usable, and the server rejects the A precondition under B before writing. A separate browser profile/device can bind to B independently.

The H3 account guard survives legacy sync resets and the existing explicit in-app Replace/Erase flows. Those flows reset the Highlights cursor to zero and clear its agreed rows/outbox, keeping its account. They are not broadcast as deletion; syncing again with the linked account may redownload its cloud library. Logout, failed authentication and offline use never erase excerpts. No new authentication flow or account-transfer/reset dashboard was added. Returning to A resumes sync. Deliberately importing a user-selected backup remains an explicit content import under the existing UX, rather than an implicit account transfer.

Backups still use version 4 and contain only the `records` store through the H1 parser, including tombstones and the existing local resolution field. Cursor, binding, outbox and server versions are never exported. v1-v3 backups lacking Highlights leave them alone. Merge/import is discovered by the authored subscription and scan; Replace resets Highlights sync separately and retains the account guard.

## Product boundaries

No change to Reader selection, preview paint, five colors, anchor matching, subject/article/passage grouping, article loading or reader routing. The Highlights library still opens without requesting article bodies, keeps unresolved/unavailable excerpts, and is independent of Today/Archive/Saved. All four installed-app identifiers, publisher policy and terminal fallback actions are unchanged. No spaced repetition or Validator v3 work.

## Implementation verification

| Check | Final result |
| --- | --- |
| Focused H1/H2/H2.1/H3 + Reader + backups | 145 tests in 11 files passed |
| H3 exchange regressions | 21 tests passed, included above and in root tests |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed: 0 errors, 133 existing warnings |
| `npm test` | 666 tests in 47 files passed |
| `npm run test:pipeline` | 39 passed, 6 skipped, 0 failed; skipped checks require the external canonical ZIP |
| `npm run build` | Passed; physical asset verification, 166 PWA precache entries, 8,852.25 KiB |
| Reader browser | 320 checks passed, no page errors |
| H1 browser | 92 checks passed |
| H2.1 responsiveness | 60 checks passed; original <100 ms preview threshold retained |
| Highlights library browser | 140 checks passed, no page errors |
| News browser | 276 checks passed, no page errors |
| Real local workerd / D1 / Access / multi-device browser | 42 checks passed, no page errors |
| `git diff --check` | Passed including new files |

H3 tests cover legacy streams before/after creation, first local upload/new-device download, recolor/delete, equal-time and Unicode ties, old-clock deletes, terminal stale-write rejection, duplicate replay/lost responses, transactional apply rollback with and without pending acknowledgements, malformed client/server payloads, large multibyte chunks, migration from an actual v1 DB, account changes before initial upload and after binding/reset, local-only fields, backup/erase behavior, and bounded-run continuation with only remote pages remaining.

The workerd test applies both real migrations to an ephemeral local D1. Browser contexts have independent real IndexedDB databases, and a throwaway local RSA issuer supplies Access JWTs that the actual middleware verifies. Native Selection/Range completion creates a real H1 highlight; the production app uploads it without a manual action, another context downloads it, library recolor/delete propagate, offline recolor resumes on reconnect, A-to-B pauses the existing Settings UI, and D1 inspection finds one terminal authored excerpt without any HTML/body/derived fields. A simulated Highlights 503 does not prevent automatic general sync. Legacy Read/Saved/smry tests still pass: the 1,510-row legacy first upload uses four requests, and idle legacy exchange is one indexed query, one billed row read and zero writes.

The umbrella browser command passed the unchanged shell/Atlas checks and News, then stopped at Reader while an overlapping build replaced dynamic assets. The final stable-build Reader and subsequent H1/H2.1/library/News checks above were rerun individually and passed. Harness corrections retain assertions: schema-independent IDB reads, H2.1 records-only save timing (excluding H3 multi-store bookkeeping), observing smry requests before navigation, waiting for settled sign-in, starting a fresh Reader visit for a changed fixture, and direct Wrangler SQL quoting. No interaction threshold was relaxed. Phone light and desktop dark final library screenshots were visually inspected; layout and typography remain H2.1's.

Evidence: `tools/browser/out/h3/{focused,tests,typecheck,lint,pipeline,build,reader-final,highlights-final,responsiveness-final,library-final,news-final,workerd}.log`; `tools/browser/out/sync/{results,highlights-results}.json`; `tools/browser/out/h21/after-timing.json`; final screenshots under `tools/browser/out/highlights-library/`.

## Performance

Freeze root test run, real server handlers/migrations over local SQLite and independent Dexie/fake-indexeddb devices, including JWT issuance/verification and scans. Typecheck, lint and pipeline checks ran concurrently with this root test run. These timings are process-local fixture measurements under that workload, not production network latency or phone hardware certification.

| Records | First upload | New-device download | One-record incremental exchange, both devices | Upload / download requests |
| ---: | ---: | ---: | ---: | ---: |
| 100 | 776 ms | 330 ms | 191 ms | 2 / 1 |
| 1,000 | 4,247 ms | 2,677 ms | 549 ms | 11 / 10 |

Upload counts include the initial read-only account handshake. Incremental sync sends exactly one authored record, followed by the other device's pull; it does not upload the full library. The larger multibyte-excerpt regression also proves byte-based chunking, pagination and convergence. Benchmarks: `tools/browser/out/h3/performance-{100,1000}.json`. An exchange-round limit with remote rows still waiting schedules another bounded run even when the authored outbox is empty.

## Changed files

- `docs/READER_HIGHLIGHTS_H3.md`
- `functions/api/highlights-sync.ts`
- `migrations/0002_highlights.sql`
- `src/current-affairs/reader/highlights/library.test.ts`
- `src/current-affairs/reader/highlights/repository.ts`
- `src/data/backup-extras.ts`
- `src/sync/engine.ts` (shared outcome type only)
- `src/sync/highlights-d1.ts`
- `src/sync/highlights-engine.ts`
- `src/sync/highlights-protocol.ts`
- `src/sync/highlights-transport.ts`
- `src/sync/runtime.ts`
- `src/sync/status.ts`
- `tools/browser/highlight-responsiveness-check.mjs`
- `tools/browser/highlights-check.mjs`
- `tools/browser/highlights-library-check.mjs`
- `tools/browser/sync-check.mjs`
- `tools/cloudflare/highlights-sync.test.ts`
- `tools/cloudflare/sync-fixture.ts`
- `vite.config.ts`

## Remaining verification and Git state

No H3 production migration or endpoint was deployed. Production Access session expiry, deployed D1 behavior/latency, two physical authenticated devices, Samsung Internet/native S-Pen handles and Android/iOS builds remain untested. Desktop Chrome touch/pen lifecycle checks are simulated. The external canonical ZIP remains unavailable for six pipeline checks.

The worktree has its own dependency directory. Source/data changes are confined to the files above. The implementation-stage diff/status evidence is saved under `tools/browser/out/h3/` as `git-diff-stat.txt`, `git-status.txt` and `diff-check.txt`. The local freeze commit is reviewed against the parent recorded above; its exact SHA and final Git state are reported separately after committing. No push, merge, deployment or production migration is included.

## Local freeze review — 2026-10-08

Reviewed the complete H3 diff against `61c3070b05c33000432dfee5336cf74367a4edff`. Only the 20 files listed above are included. The dedicated protocol/tables/cursor, additive Dexie storage, account guard, terminal deletes and lifecycle integration match H3. Legacy wire/storage queries, Reader/Highlights UI, News refresh/classifier, paywall policy, Atlas assets and Validator/PYQ code are unchanged. Existing assertions and the preview threshold are preserved. No credentials, secrets, generated artifacts or unrelated changes are included.

Fresh freeze checks: `git diff --check`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:sync` and `npm run build` all passed. Lint reports 0 errors and 133 existing warnings; root tests report 666 passed in 47 files. Real local workerd/D1/verified Access checks report 42 passed with no page errors, applying both migrations only to ephemeral local D1.

Additional fresh checks: `npm run test:pipeline` reports 39 passed, 6 skipped (missing external canonical ZIP), 0 failed. The complete `npm run test:browser` passed against the stable build: shell, Atlas, canonical questions/offline, News (276), Reader (320), H1 Highlights (92), H2.1 responsiveness, Highlights library (140), and recall integration. No assertion or interaction threshold was relaxed. Full freeze logs are ignored under `tools/browser/out/h3-freeze/`.

The authorized result is exactly one local commit titled `Add cross-device Reader Highlights sync`. Production H3 migration/endpoint, production Access expiry and physical-device/native verification remain pending. No push, merge, deployment, production D1 migration or other worktree modification is part of this freeze.
