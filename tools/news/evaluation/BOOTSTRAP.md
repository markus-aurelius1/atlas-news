# Validator v3 — Job A2a bootstrap tooling

A2a only. Start at completed Job B commit `7b309a418e859a2f66b11b12dbf06d49759afd47`, branch `codex/validator-v3-a2a`. No C–F classifier, novelty, ranking or production changes.

## Active local package

`tools/news/evaluation/data/a2a-bootstrap-2026-10-07/package-owner-final/` is the active immutable package. `package-v1/`, `package-final/`, `package-review-ready/`, `package-a2a/` and `package-owner-amendment/` are retained superseded drafts (revision visibility/version commitments, then phone layout correction and a single-source proxy correction). Their predictions are never reviewer inputs. All raw captures and corpus artifacts remain local/ignored; no copyrighted metadata is newly checked in or published.

- Deliver only `reviewer/` to the primary human: offline `index.html`, `annotations.json` and the rubric with the explicit bootstrap primary-human amendment.
- Keep `corpus.json`, manifests, coverage diagnostics, sampling rationale and `frozen-v2/` inaccessible during blind judgment.
- See package `workflow.md` and `family-audit-template.json` for genuine human adjudication, metadata sufficiency and semantic-family reconciliation.
- The package is **awaiting adjudication**. All final gold labels are null/empty and all records unreviewed. No quality claim, agreement result, holdout or synthetic natural gold exists.

## Commands

```text
npm run news:bootstrap:capture -- NEW_CAPTURE_ROOT VERIFIED_JOB_B_ROOT
npm run news:bootstrap -- build CAPTURE_ROOT NEW_OUTPUT_CHILD OWNER_EXEMPLARS_MD
npm run news:bootstrap -- verify CAPTURE_ROOT SAVED_OUTPUT_CHILD
npm run news:bootstrap -- review CAPTURE_ROOT NEW_REVIEW_OUTPUT_CHILD HUMAN_RESPONSES_JSON
npm run test:bootstrap
node tools/news/evaluation/bootstrap-browser-check.mjs SAVED_OUTPUT_CHILD
```

Capture preregistration, registry, parser manifest and outputs use exclusive writes. Never overwrite a capture or label version. Failed feeds are preserved independently from empty successes. Every enabled pinned source is attempted once in its existing shard under the A1 bounds; verified Job B captures are imported with byte hashes checked, original IDs and original clocks retained. Import is not a fresh capture, listing inventory or source availability proof. Article endpoints, full XML, Atom content and feed body fields are never stored.

Representative sampling draws first from the full unique-URL frame using disjoint publisher/primary-observed-feed/first-capture-UTC-day cells and largest-remainder proportional allocation. The selected raw revision is latest capture, then observation ID. Every source/revision reference remains attached. Repeated polls never multiply article population weight. Targeted coverage uses a census of observed requested authors, then deterministic rotation over overlapping neutral source/metadata predicates. Representative inclusion probabilities are conditional on their full-frame cells; targeted probabilities are null. The single-source enrichment proxy requires exactly one observed feed membership for the URL; absence of corroborating event coverage still needs human family review. Proxies do not supply gold subjects, content types, scope or expected values.

Partition constraints combine A1 lexical hints, exact normalized titles (including short titles), conservative headline overlap and explicit recurring-theme patterns. These are broad leakage safeguards, not an event/subject/novelty classifier. Human family audit must reconcile newly discovered equivalences before tuning or quality evaluation; a mechanical zero-leak result does not certify semantic independence. New family truth requires a new partition/corpus version, preserving the earlier artifacts.

## Review policy amendment

The A1 standalone schema and default APIs retain two independent reviews. Owner-authorized `bootstrap_primary_human` is an explicit optional policy in `validateGold`, `validateCorpus` and `EvaluationContext`; it is limited to development/validation. One primary human can adjudicate their own complete bootstrap annotation. Unresolvable responses preserve sufficiency in the human annotation and leave final gold empty. Disagreement needs a distinct second review. No software identity check establishes that a reviewer is a real independent person.

The `review` command consumes only human-supplied annotation exports, validates IDs, rubric, evidence, complete resolved labels and contradictions, and writes a new corpus/study report. Protected/must-read slices, disagreements, random overlap and final holdout receive a second independent reviewer later. Existing A1 metric gates remain unapproved. Scope includes `global_systemic`; no UPPCS evaluation labels, quotas, recall objectives or source protection were introduced. The frozen legacy v2 index/traces retain historical exam evidence unchanged for fidelity.

## Baseline and limitations

`frozen-v2.ts` loads the existing v2 classifier/index without threshold changes. It predicts on exactly the single raw revision shown as primary metadata for each sampled article, with an explicit cutoff and no gold input. The artifact retains ordered subject output, score, threshold, rejection reason, evidence and substance trace, plus A1 run/version commitments. Replayed order permutations must match. This is an article baseline; no Today, event or novelty quality measurement is claimed, and no production selector was implemented here.

This is one capture day with historical feed backfill and Job B archival observations. Publication timestamps are not capture slots or a longitudinal history. No final prospective holdout was created, read or inspected. Metadata presence is not semantic sufficiency; descriptive slice proxies and future human subject/content-type slices are reported separately, with null rates when no reviewer has assessed them.


## Latest curated Today/Archive evaluation contract

Evaluation only: maximum 50 visible reading units, no fill target, P@20/P@50 (no P@100), one representative per equivalent factual development. Strict distinct-analysis support requires a human angle, appropriate analytical content type, a cutoff-specific distinct-analysis judgment and observed material evidence. Expanded/nested coverage is internal evidence only and gives no visible reading-need credit.

`editorial-judgment-schema.json` and blank reviewer JSON templates support same/new development, equivalent/redundant reports or analysis, material deltas, representatives and selected/internal/rejected states. The human can leave these unresolved and still assess metadata sufficiency. `editorial-study.ts` reports task, publisher and description slices independently of article value. Import authentic human templates with `npm run news:bootstrap -- editorial-review CAPTURE_ROOT NEW_OUTPUT HUMAN_JUDGMENTS_JSON`; immutable task provenance must match. This does not supply labels for unanswered tasks.

`editorial-output-schema.json` and `editorial-replay.ts` validate supplied future output, with metadata history initially 14 days and strongest comparison 7 days, configurable. Actual capture clocks prevent future evidence/backdated publication backfill. Selected reading identities remain available beyond metadata-window expiration; elapsed time is never an automatic freshness reset. Replacements retain the same development/need and prior observation provenance. Archive admits selected meaningful reading history, excluding rejected/internal duplicates/unselected leftovers. No production selector, story memory, clustering, representative replacement or Archive behavior is implemented.

`editorial-metrics.ts` assesses supplied selections against authentic human judgments: duplicate/repeat exposure, distinct analysis, material new development in existing themes, unique reading needs, best reasonable representative, source concentration without arbitrary diversity rewards, Archive quality and conditional capacity utility loss. Utility/complete-pool results stay pending unless the complete daily pool is genuinely judged. Partial bootstrap snapshots do not establish release recall.

`owner-exemplars/` contains the exact owner document and its 58 explicitly supplied positive rows, separate from blind reviewer files. No must-read tiers, subjects, verified article identities, timestamps or additional positives are invented. Neutral title-match diagnostics neither reselect articles nor transfer owner-positive labels into raw gold. Automatic approval review rejected putting the positive corpus inside the blind reviewer directory; the final package keeps it exclusively in custodian evidence. General semantic standards alone inform the blind rubric.

Stage E/F must later implement bounded metadata/story history, material-delta decisions, independent analysis reading needs, one strongest representative with identity-preserving replacement, repeat suppression without timed resets, quality-first publisher comparisons, smallest worthwhile <=50 Today list and selected-only historical Archive. Those downstream implementations remain unauthorized here.
