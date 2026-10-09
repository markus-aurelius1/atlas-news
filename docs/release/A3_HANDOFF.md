# Controlled integration engineering milestone

Parent: `99f5a357da4dc6e11250df2c84490008693faca5`. Output: commit containing this handoff, resolved from its Git history.

Owner requested A3 application integration after F. The frozen specifications also use A3 for a separate custodian's one-shot sealed evaluation. That independent evaluation remains **BLOCKED**, was not invoked and must never be confused with this engineering milestone.

Build switch: `VITE_NEWS_VALIDATOR=v2|shadow|v3`, default v2. V3 stays disabled because the wider coverage/source and independent quality gates fail or lack evidence. Shadow evaluates the same cached metadata with no feed/body requests and no selection-storage reads/writes. V3 uses the additive local selection ledger. Returning to v2 preserves every ledger and learner row.

New v3 stages own acceptance, primary subjects, event/angle decisions, representatives and selection. Legacy solo thresholds, source-volume ranking, static-topic regrouping and must-read inference do not control v3. Static anchors/exam-demand links are independently matched against the pinned index. Legacy numeric score remains zero in v3 display adapters, rather than disguising ordinal evidence as a 6.5 score. Existing Saved-only metadata appears only outside recommendations. Archive is chronological, selected-only; old legacy rows remain physically untouched.

Feed cache and acquisition code are unchanged: two-hour staleness, background visible-feed retention, explicit refresh, shared in-flight deduplication, no navigation refresh. Reader/paywall/smry policy unchanged. Adapter inputs use genuine SHA-256 metadata/code/policy commitments and explicit view clocks. An initial browser failure exposed a clock race: selection time later than the view clock hid fresh units as future rows. It was repaired by passing that view clock to evaluation; a focused regression protects it.

Verification: root 690 tests / 48 files; lint 0 errors / 133 existing warnings; typecheck/build passed. All 77 evaluation/import/gold integrity tests pass. Controlled v3 browser: 52 checks across 375/1366 widths, light/dark; real cache/IDB reload, native Reader/Back, refresh/outage retention, selected-only ledger and no article-body persistence; no page errors. Phone screenshot visually inspected. Existing feed tests pass (7 cases). Protected 161 hashes match. Pipeline unchanged since D (39 passed, six external canonical-ZIP skips); full umbrella browser/Highlights/workerd combined gate follows H3 import.

Generated `runtime-manifest.ts` and `runtime-inventory.json` come from `tools/news/build-validator-manifest.ts`, invoked by build. No frozen evaluation data, body stores, canonical assets or installed identifiers were changed. No deploy/push/remote migration/CI job.

Next: locally merge the exact Highlights H3 ancestor chain into this release branch, resolve only genuine integration conflicts, verify immutable highlight IDs/snapshots and local ephemeral D1/Access, run combined desktop/mobile suites, record release blockers and rollback runbook.
