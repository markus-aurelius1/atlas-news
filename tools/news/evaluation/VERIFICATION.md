# A1 verification and handoff — 2026-10-07

Worktree: `C:\Users\hario\.codex\worktrees\validator-v3-a1\Atlas-News`.
Branch: `codex/validator-v3-a1`. HEAD: `d21798db6212553e63420a8efd6e1f71c87417d9`.
No commit, push, merge, rebase, cherry-pick, deployment, live capture or holdout review was performed.

## Final local evidence

| Command | Exact result |
| --- | --- |
| `npm run test:evaluation` | 30 tests, 30 passed, 0 failed, 0 cancelled, 0 skipped, 0 todo. Synthetic in-memory contract/metric examples only. |
| `npm run typecheck` | Exit 0, `tsc -b`; no diagnostics on final A1 files. |
| `npm run lint` | Exit 0; 133 warnings, 0 errors. Existing root source warnings. |
| `npx eslint tools/news/evaluation` | Exit 0; no warnings/errors in final evaluation modules. |
| `npm test` | Exit 0; 40 test files passed, 588 tests passed. Root Vitest regression suite; the new Node test suite is separately invoked above. |
| `npm run test:pipeline` | Exit 0; 45 tests, 39 passed, 0 failed, 6 skipped, 0 cancelled, 0 todo. Missing pinned source ZIP; exact skips below. |
| `npm run build` | Exit 0; Atlas inventory 113 files / 7,077,851 bytes; 2,517 client modules transformed; PWA precache 165 entries / 8,811.22 KiB. Existing `advancedChunks` deprecation warning. No tracked generated-data diff. |
| `node C:\Users\hario\.codex\visualizations\2026\10\07\01a115fd-6e52-77a2-9029-547ee830fbf7\validator-a1-smoke.cjs` | Exit 0; existing `tools/browser/smoke.mjs` passed 36 checks: 390/1366px, light/dark, shell/place/settings/route fallback. Final invocation used an owned preview process (PID 33276, port 54272), explicit isolated root/cache, unique port and a fresh browser context. |
| `git --no-optional-locks diff --check` | Exit 0; no whitespace errors. |

Early development runs found three test-expectation failures (schema rejection order and floating-point equality), a shared-object judgment-schema generation bug, and two TypeScript test/reducer errors. They were repaired; the final focused suite and typecheck pass. No test/gate was skipped to conceal a failure.

All six pipeline skips have exactly this reason: `Supply canonical-pyq-v2-final.zip or CANONICAL_PYQ_PACKAGE for full release verification`.

1. pinned release manifest verifies every entry and rejects changed bytes, extra paths and wrong identity
2. active pack loading has exact stable IDs and all question/answer/provenance joins
3. joins fail closed on shuffled answers, metadata hashes, duplicate IDs and archive paths
4. runtime gate requires every sidecar field and rejects all unresolved issues, independently of legacy flags
5. every runtime question passes all gates, retains exact representation and final answer, maps to meaningful permanent IDs
6. deterministic curation and runtime artifacts are invariant to source pack traversal order

The full browser suite, authenticated/live publishers, live Access/D1/sync and physical devices were not exercised. A1 changes no browser or production path; only the relevant local regression smoke was run. Collector tests inject responses; no actual feeds or articles were requested by the evaluation collector. No v3 accuracy, superiority or release-quality result exists.

## Original checkout protection audit

Original path: `C:\Users\hario\Downloads\Atlas-News`, still on `feature/pyq-corpus-2.2.0` at the same baseline SHA. A read-only SHA-256 manifest captured 39,065 pre-existing entries / 571,145,624 bytes, including ignored dependencies and generated files. Final full audit found every pre-existing file and directory unchanged. Original `.git/HEAD`, index, config, HEAD reflog, PYQ branch ref/reflog all match their snapshot hashes. Its exact porcelain-v2 status also matches. No source/PYQ/Reader/Atlas/personal-state file was changed or adopted, and no original stash/reset/clean occurred.

The final audit also observed one newly added ignored directory and **45 new Vite dependency-cache files** in `node_modules/.vite/deps/` in the original checkout (9,684,386 additional bytes; 39,111 total entries). Their provenance was not established. They were left alone under the owner's protection rule. **Total-directory byte identity is therefore not claimed**, although every pre-existing entry, all dirty work and the original Git state are unchanged. This discrepancy is reported explicitly rather than silently cleaning the original cache. The final browser check was repeated with an explicit isolated root/cache and owned unique-port preview to remove preview-root ambiguity.

The matching package-lock hashes were verified before dependencies were copied into the isolated worktree as independent files. No dependency installation or new package dependency was needed. Verification/build outputs are confined to ignored artifacts; no tracked canonical/generated asset changed.

## Exact changed/created files

Modified: root `package.json`, adding only `news:evaluation` and `test:evaluation` scripts. Package lock unchanged.

Created under `tools/news/evaluation/`:

```text
.gitignore
README.md
VERIFICATION.md
cli.ts
collect.ts
contracts.ts
core.ts
evaluate.ts
evaluation.test.ts
gates.proposed.json
judgment-schema.json
judgments.ts
metrics.ts
raw-schema.json
replay.ts
report.ts
rubric.md
sample.ts
schema.json
split.ts
validate.ts
xml.ts
```

All implementation changes remain unstaged. New files use Git intent-to-add solely so `git diff` includes them for review; `git diff --cached` is empty. All Git operations were scoped to the isolated worktree. Only shared object/worktree metadata necessarily belongs to the common Git directory; the original index and branch remained unchanged.

## Pending owner decisions and next inputs

Before A2 labelling/tuning: assign two independent human reviewers and a holdout custodian; approve rubric/schema conventions (including metadata sufficiency, cutoffs/identity grouping, two-review adjudication) and proposed gates/sample support. UPSC-only scope, `global_systemic`, small bootstrap support and metadata-only operation are already owner amendments, not new approval requests.

B consumes the bounded raw observation format, membership/health/parser/registry provenance and acquisition/metadata diagnostics. B must verify discovery/author sources and version any changed registry/parser; no production metadata enrichment is implemented here. A2 consumes schemas/rubric, deterministic sampling and partition manifests, duplicate hints plus independent semantic family audit, blind exports, immutable review artifacts, frozen runner interface and report utilities. A2 supplies frozen v2/config/index commitments, independently adjudicated development/validation data and complete candidate/pair/anchor/sequence judgments; later holdout labels remain outside implementation access.

Limitations: lexical grouping is conservative and cannot prove all semantic leakage absent; SHA-256 cannot establish reviewer independence; custodian mode is an API/operational boundary, not an access-control system; future registry generations need an explicit archived-registry validator; temporal evaluations require cutoff-scoped review artifacts; bootstrap point estimates do not approve quality gates; no live acquisition inventory or final corpus is supplied. These are explicit handoff inputs, not permission to start B/A2 or later jobs.
