# Calibration gold import and frozen-v2 analysis handoff

Worktree: C:\Users\hario\.codex\worktrees\validator-v3-calibration-gold\Atlas-News
Branch: codex/validator-v3-calibration-gold
Mandatory parent: cac3ea02db968aa7f5701022766cd20e50ea815d

All 50 attached annotations imported and validated against the frozen calibration selection and original A2a observations. Original reviewer IDs, labels, evidence and review timestamps are unchanged: 47 Marcus records and 3 model-origin records separately owner-validated by direct task attestation. All 3 unresolvable cases are frozen but excluded from binary metrics.

Gold SHA-256 inventory: a425c2eaa1a77b1c3cb7085d35f61688add269b6ca05dda8ab8475c95091221e
Original annotation SHA-256: e39eaf54baae84873267819889048158500ef81e6c9e32279cee60e165985f3e

## Deliverables

- [Frozen gold package](calibration-gold-v1/README.md), [gold JSON](calibration-gold-v1/gold.json), [owner attestation](calibration-gold-v1/owner-attestation.json).
- [Provenance](calibration-gold-v1/provenance.json), [SHA-256 inventory](calibration-gold-v1/sha256-manifest.json) and companion.
- [Frozen-v2 comparison](calibration-gold-v1/COMPARISON.md) and [JSON](calibration-gold-v1/comparison.json).
- [Complete 50-case table](calibration-gold-v1/ERROR_CASES.md), [TSV](calibration-gold-v1/error-cases.tsv).
- [Prioritized Stage C requirements](calibration-gold-v1/STAGE_C_REQUIREMENTS.md), [machine specification](calibration-gold-v1/stage-c-requirements.json).
- [Verification evidence](CALIBRATION_GOLD_VERIFICATION.json).

## Findings

Resolved n=47: TP=14, FP=1, FN=17, TN=15. Descriptive precision 93.33%, recall 45.16%, F1 60.87%. Six of 17 must-read articles missed; exact-primary accuracy on all 31 positives is 13/31 (41.94%). Requested-author retention is 4/8, with all eight missing descriptions. Owner-ID-only resolved sensitivity n=45: TP=13, FP=1, FN=17, TN=14; precision 92.86%, recall 43.33%.

The sole false positive is a ceremonial memorial opening. Priority Stage C requirements cover hard low-value/scope gates, substantive editorial argument, missed concept/value routes, semantic metadata insufficiency and trace independence. Stage D owns subject routing. The three opaque cases remain acquisition/metadata limitations; no missing argument is invented. Publisher and missing-description slices are descriptive and confounded by selection. These exposed calibration rows, including 8 original validation rows, are not a statistical release evaluation.

Exact predictions and traces replay over all 1,000 original observations pinned by the frozen trace IDs, including reversed input order. The archived adapter has one CRLF that Git normalized to LF; its exact archived hash and normalized-source equality are recorded. Original classifier/index bytes match; no frozen artifact was rewritten.

## Verification

| Check | Result |
| --- | --- |
| npm run typecheck | passed |
| npm run lint | passed |
| npx eslint tools/news/evaluation/calibration-gold.mjs tools/news/evaluation/calibration-gold-requirements.mjs tools/news/evaluation/calibration-gold.test.mjs | passed |
| npm test | passed — 604 tests |
| node --test tools/news/evaluation/*.test.ts tools/news/evaluation/calibration-gold.test.mjs | passed — 69 tests |
| npm run test:pipeline | passed_with_guarded_skips — 39 passed / 6 guarded skips |
| npm run build | passed |
| REVIEWER_CHECK_NAME=calibration-gold-browser node tools/news/evaluation/bootstrap-browser-check.mjs tools/news/evaluation/data/calibration-gold-browser | passed — 100 checks |
| node tools/news/evaluation/calibration-gold.mjs verify tools/news/evaluation/calibration-gold-v1 | passed |
| git diff --check | passed |

Typecheck/build/root suite/pipeline are unchanged production regression checks. Lint has 133 existing warnings and no errors; final new scripts have zero lint warnings. Pipeline skips require the unavailable canonical ZIP. Offline reviewer browser checks used a copied blank calibration package and synthetic answers only. Phone/desktop screenshots were inspected. Logs remain local under .runs; log hashes are in verification JSON.

No production files or original corpus/exemplar/partition/v2 artifacts changed. Future release holdout not opened. No Stage C/D/E/F implementation, commit, push, merge or deployment.

## Exact changed files

- `tools/news/evaluation/.gitattributes`
- `tools/news/evaluation/CALIBRATION_GOLD_REPORT.md`
- `tools/news/evaluation/CALIBRATION_GOLD_VERIFICATION.json`
- `tools/news/evaluation/calibration-gold-requirements.mjs`
- `tools/news/evaluation/calibration-gold-v1/COMPARISON.md`
- `tools/news/evaluation/calibration-gold-v1/ERROR_CASES.md`
- `tools/news/evaluation/calibration-gold-v1/README.md`
- `tools/news/evaluation/calibration-gold-v1/STAGE_C_REQUIREMENTS.md`
- `tools/news/evaluation/calibration-gold-v1/a1-schema.json`
- `tools/news/evaluation/calibration-gold-v1/calibration-manifest.json`
- `tools/news/evaluation/calibration-gold-v1/comparison.json`
- `tools/news/evaluation/calibration-gold-v1/error-cases.tsv`
- `tools/news/evaluation/calibration-gold-v1/gold.json`
- `tools/news/evaluation/calibration-gold-v1/human-annotations.original.json`
- `tools/news/evaluation/calibration-gold-v1/observations.json`
- `tools/news/evaluation/calibration-gold-v1/owner-attestation.json`
- `tools/news/evaluation/calibration-gold-v1/provenance.json`
- `tools/news/evaluation/calibration-gold-v1/response-schema.json`
- `tools/news/evaluation/calibration-gold-v1/sha256-manifest.json`
- `tools/news/evaluation/calibration-gold-v1/sha256-manifest.sha256`
- `tools/news/evaluation/calibration-gold-v1/stage-c-requirements.json`
- `tools/news/evaluation/calibration-gold.mjs`
- `tools/news/evaluation/calibration-gold.test.mjs`

## Reproduce

Run from this worktree:

```powershell
node tools/news/evaluation/calibration-gold.mjs verify tools/news/evaluation/calibration-gold-v1
node --test tools/news/evaluation/*.test.ts tools/news/evaluation/calibration-gold.test.mjs
```

The generator refuses existing output directories. New versions require a new output path; never overwrite a frozen package. Input paths and provenance are recorded. To generate a new version, use the import CLI with the original A2a package, the exact annotation input, a new output path and a real UTC timestamp. Test fixtures are synthetic tooling checks; they never alter gold.

## Final commit review — 2026-10-09

The owner authorized exactly one local commit on the mandatory parent. The earlier no-commit wording records the original task boundary; this final review authorizes the requested local freeze only. No Stage C/D/E/F implementation or remote actions.

Fresh review: all 50 annotations and 139 evidence spans validated against the original A2a corpus, preserving 47 owner-ID records plus 3 separately owner-validated model-origin records. Three unresolvable cases remain excluded; exact TP=14, FP=1, FN=17, TN=15. All 1,000 frozen-v2 article predictions and traces reproduce in normal and reversed order. Protected 28-file hashes, original 27-file inventory and six pinned tool hashes match. No future holdout is read.

Fresh checks: typecheck, lint (0 errors / 133 existing warnings), 604 root tests, 69 evaluation/tooling tests, 39 pipeline tests with 6 guarded canonical-ZIP skips, build and 100 offline reviewer browser checks passed. High-signal secret scan: 23 intended files, no findings; no temporary files included.

A scoped evaluation .gitattributes file preserves exact package bytes and hash-pinned tool bytes through Git, including original CRLF. Normal trailing-whitespace checks remain enabled. This necessary integrity fix increases the intended inventory from 22 to 23 files; the gold package and all its frozen hashes remain unchanged. The index is checked against the frozen SHA-256 inventory before committing.
