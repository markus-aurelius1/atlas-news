# Validator v3 — Job A2a report

A2a implementation and local bootstrap artifacts are ready; **awaiting adjudication**. No substantive human gold, quality result, release holdout or C/D/E/F implementation exists.

Isolated worktree: `C:\Users\hario\.codex\worktrees\validator-v3-a2a\Atlas-News`. Branch `codex/validator-v3-a2a`, HEAD/base Job B `7b309a418e859a2f66b11b12dbf06d49759afd47`. The original dirty PYQ checkout remains on `feature/pyq-corpus-2.2.0` at `d21798db6212553e63420a8efd6e1f71c87417d9`; no task edits were made there. No commit, staging, push, merge or deployment.

## Corpus and capture evidence

- 15,088 raw observations: 9,846 byte-identical verified Job B archival observations plus 5,242 fresh observations; 4,945 unique raw URLs. Raw format `tars-news-raw/v1`, parser `tars-eval-metadata/3`, registry generation `rss-de1aebaa`.
- 41 raw shard files (26 archived, 15 fresh). All 86 pinned sources attempted in the fresh wave: 85 successful; NASA `ext-nasa-news-releases` returned HTTP 200 but failed parsing at `2026-10-07T13:40:39.449Z`. Three invalid entries and 600 bounded-limit truncations across imported/fresh captures are retained in diagnostics, not treated as relevant supply or silently hidden.
- Final cutoff `2026-10-07T13:40:55.600Z`; capture batch clocks span `2026-10-07T12:56:54.560Z` to `2026-10-07T13:40:55.532Z`. Original archived observation clocks are preserved.
- 1,000 unique sampled articles: 580 representative (58%) and 420 targeted coverage (42%). Sampled from raw before validator filtering; no v2/v3 scores or owner-positive matches select articles. Representative cells are publisher/primary observed feed/actual first capture UTC day; targeted source/text predicates supply coverage only, not gold.
- 750 development / 250 validation. No final prospective holdout created, read or inspected.
- 31 publishers, 83 sampled feed memberships. Memberships and source/section/topic proxies overlap and must not be summed as disjoint article counts. Supply for Economic Times is especially thin (one sampled item); this is availability evidence, not a production source policy.

## Missing metadata

| Slice | Articles | Missing descriptions | Rate |
|---|---:|---:|---:|
| all | 1000 | 494 | 49.4% |
| coverage | 420 | 224 | 53.3% |
| editorials_columns_proxy | 161 | 99 | 61.5% |
| explainers_proxy | 165 | 165 | 100.0% |
| ie_with_description | 0 | 0 | undefined; absent slice |
| ie_without_description | 447 | 447 | 100.0% |
| ordinary_news_proxy | 610 | 166 | 27.2% |
| representative | 580 | 270 | 46.6% |
| requested_authors | 8 | 8 | 100.0% |
| science_proxy | 114 | 50 | 43.9% |
| security_terms_proxy | 70 | 26 | 37.1% |
| th_with_description | 121 | 0 | 0.0% |
| th_without_description | 10 | 10 | 100.0% |

Overall: **494/1,000 missing descriptions (49.4%), 489 missing bylines (48.9%), 200 missing categories (20.0%), zero missing publication timestamps**. Publisher totals: Indian Express 447/447 missing descriptions (100%); The Hindu 10/131 (7.6%); Times of India 15/23 (65.2%); Tribune 0/26 (0%). All sampled TH bylines are unavailable; feed section/title cannot establish an author. Categories being present does not establish subject correctness.

PB Mehta: all 3 observed verified cases sampled. C. Raja Mohan: all 5 observed verified cases sampled. All eight have legitimate `rss:dc:creator`, no descriptions; seven are in development and one in validation. Full URLs, byline provenance and partitions are in diagnostics/evidence. No prestige flag is shown to reviewers.

## Source and section distribution

| Publisher | Representative | Coverage | Total |
|---|---:|---:|---:|
| Al Jazeera | 3 | 0 | 3 |
| Anticipating the Unintended | 2 | 1 | 3 |
| BBC | 13 | 8 | 21 |
| Bloomberg | 2 | 0 | 2 |
| Business Standard | 12 | 8 | 20 |
| BusinessLine | 34 | 10 | 44 |
| Economic Times | 1 | 0 | 1 |
| Financial Times | 2 | 1 | 3 |
| Frontline | 7 | 2 | 9 |
| Future of India | 2 | 0 | 2 |
| Gentle Leviathan | 2 | 1 | 3 |
| Guardian | 11 | 9 | 20 |
| Hindustan Times | 28 | 9 | 37 |
| India Today | 3 | 1 | 4 |
| India: Politics, Power & Public Discourse | 2 | 0 | 2 |
| Indian Express | 243 | 204 | 447 |
| Mint | 16 | 11 | 27 |
| NDTV | 5 | 1 | 6 |
| New York Times | 25 | 31 | 56 |
| Northeast Now | 2 | 1 | 3 |
| People, Policies, Progress — PIB India | 2 | 0 | 2 |
| Political Economy, Stats, and Society | 2 | 1 | 3 |
| Politico Europe | 1 | 1 | 2 |
| Scroll.in | 12 | 6 | 18 |
| South China Morning Post | 6 | 5 | 11 |
| The Economist | 46 | 18 | 64 |
| The Economist: Off the Charts | 2 | 3 | 5 |
| The Hindu | 66 | 65 | 131 |
| The Quantified India | 2 | 0 | 2 |
| The Tribune | 15 | 11 | 26 |
| Times of India | 11 | 12 | 23 |

Section memberships: Agriculture 8; Artificial intelligence 3; Asia Pacific 5; Business 19; Climate 17; Columns 65; Cover story 9; Economy 72; Editorial 74; Environment 27; Europe 2; Explained 49; Explained Economics 47; Explained Global 48; Explained Sci-Tech 44; Finance & economics 37; Governance 18; India 77; International 3; Latest 24; Lead analysis 14; Markets 2; Middle East 13; National 27; Newsletter 22; Northeast India 3; Op-ed 17; Opinion 23; Politics 6; Russia–Ukraine war 2; Science 53; Science & environment 10; The world this week 27; UPSC Current Affairs 55; UPSC Essentials 52; Uttar Pradesh 1; World 124.

Coverage proxies: economy 191; environment 65; foreign_domestic_terms 107; ie_explained 165; ie_opinion 96; ie_upsc 64; institution_terms 101; ir_terms 112; missing_description 494; party_terms 77; recurring_metadata 254; requested_authors 8; science 114; security_terms 70; single_source 904; th_opinion 65. These are neutral enrichment diagnostics, not machine subject/value labels or confirmed negative examples. No UPPCS objectives or source protection were added.

## Blind review and metadata sufficiency

Active local package: `tools\news\evaluation\data\a2a-bootstrap-2026-10-07\package-owner-final`. Deliver **only `reviewer/`**: offline UI, bounded observable metadata/revisions, blank article annotations, blank editorial judgments and rubric. Sampling rationale, machine subject/score/decisions, author prestige, owner-positive candidate matches and expected answers stay outside the blind folder. The UI supports saved/imported human responses without network or article-body requests. JSON pair/sequence templates are intentionally blank; human reviews may remain unresolved.

The article-level study supports sufficient/limited/insufficient and missing fields, with IE/TH description slices, editorial/column, explainer, science, security, requested authors and ordinary-news proxies. Human subject/content-type slices are separate. `editorial-study.ts` reports sufficiency separately for representative sets, reading needs, temporal transitions and Archive entries. All sufficiency rates with zero human assessments remain null. Authentic import validates identities, evidence, immutable task provenance and the explicit `bootstrap_primary_human` policy; no second reviewer is manufactured.

The 58 owner-curated positive rows and exact source bytes are in **custodian-only `owner-exemplars/`**, with no inferred must-read/useful tier, verified URL/publisher/time, subject or added positive. Neutral title overlap found raw candidates for 9 exemplars and sampled candidates for 2, neither identity proof nor recall. No match changes sampling or gold. General issue-oriented and substantive standards inform the blind rubric.

## Temporal candidates and leakage

- 20 metadata-based candidate equivalence groups containing **64 articles**. **Human-confirmed equivalent-development count is unknown**, not 64.
- 10 recurring-theme candidates span multiple publication days. **Zero genuine multi-day capture sequences**: all actual captures occurred on 2026-10-07. Original timestamps/revisions remain available; earlier publication is not retroactively available runtime evidence.
- 326 opinion/explainer proxy cases offer potential distinct-analysis judgments; **confirmed distinct valuable analyses are unknown**.
- Partition constraints: 712 connected groups, 13 multi-article partition groups, largest 236; 55 conservative headline-overlap edges. Zero cross-partition known constraints and zero URL/revision leakage. Partition groups include broad themes, unlike the narrower 20 candidate-equivalence review sets.
- Semantic certification is pending human family review. Sparse titles can hide equivalents; broad safeguards can overgroup unrelated developments. Reconcile human-discovered cross-split families in a new preserved corpus/partition version before tuning or evaluation.

Available metadata has **not been judged sufficient** to distinguish equivalent repeats, material new developments or genuinely distinct analyses. The missing IE descriptions and author cases are direct evidence of limited information, not proof of fundamental impossibility. No human quality/novelty claim follows from metadata presence. Prospective capture over a suitable multi-day window and actual pair/sequence human judgments are still needed before temporal performance claims. Feed backfill includes old material and is not a complete current-day candidate inventory.

## Frozen v2 and amended evaluation contract

`frozen-v2/predictions.json` contains 1,000 predictions on exactly the primary raw revisions shown to humans at the explicit cutoff: **326 accepted, 674 rejected, 0 deferred**. Subject output, score, threshold/reasons, evidence/substance traces and code/index/policy commitments are preserved separately. Existing validator, thresholds and historical legacy exam traces are unchanged. This is an article baseline, not a selected Today list or quality measurement.

Evaluation now prioritizes P@20/P@50, a ceiling of 50 with no fill target, unique must-read and reading-need coverage, distinct analysis, duplicate/repeat exposure, material new developments, representative quality, source concentration and conditional capacity loss. Nested/internal coverage gives no visible Today credit. Partial/unjudged pools cannot produce complete-pool quality claims. Publisher distribution has no arbitrary diversity reward; TH/IE are equal when quality is comparable and Tribune is neither banned nor quota-limited.

Closed schemas and replay boundary accept supplied future E/F decisions; they do not classify, cluster, rank or select. They validate actual cutoff availability, configurable initial 14-day metadata/7-day comparison assumptions, persistent selected identities without timed freshness reset, identity-preserving representative replacement with both URLs/provenance, and Archive consisting only of selected meaningful reading history.

Stage E/F must later implement bounded story/theme metadata memory and material-delta judgments; preserve consequential new developments and independent analysis within themes; suppress repeats without timestamp/cooldown resets; compare substantive representatives and quality-first publisher preferences; replace representatives without changing reading identity; choose the smallest worthwhile <=50 list and retain only selected reading history in Archive. These are downstream requirements, **not production implementation in A2a**.

## Artifacts, exact hashes and versions

Capture root contains preregistration, pinned registry, parser manifest, 41 raw files and `capture-manifest.json`. The active package contains sampling/partitions/corpus/observations, diagnostics/source audit, article and editorial sufficiency frameworks, leakage report/constraints, frozen-v2, blind reviewer exports, adjudication/family/editorial templates, workflow, owner exemplars, editorial policy, versions, verification and hash inventory. All local raw/corpus artifacts remain ignored and unpublished.

`artifact-hashes.json` verifies 27 package files (self excluded); `versions.json` freezes 44 tooling/input-code files plus parser/registry/author/baseline commitments. `JOB_A2A_EVIDENCE.json` contains exact changed-file inventory, complete distributions, capture manifest and log hashes.

| Commitment | SHA-256 / version |
|---|---|
| baseCommit | `7b309a418e859a2f66b11b12dbf06d49759afd47` |
| parserVersion | `tars-eval-metadata/3` |
| registryGeneration | `rss-de1aebaa` |
| registryHash | `de31011cab4b5ca22e130016aaaecd5d41e867ea7bea0a21b101dc9ba9bc9d21` |
| samplingHash | `5c29b37d33f659ae60f78464b7361969e49084b3613eb747ef47fe268650ce8c` |
| partitionHash | `675aa18a86e478d6a63b98f530edc326ee80336cd9091e67ef884c92e91de5ae` |
| captureManifestHash | `e6220c3b4943eb2a3e383b0af97c60df3aed04a9877b686311a3bc0537819955` |
| preregistrationHash | `6eae9672f4a6e5a6258ffe357451e3a9f8c121f90c3a7e613b0d56ba1c0d66be` |
| editorialPolicyHash | `f96e893723ff428da81785b6cb5205a2aba3e377538c5a1640146bb36ce22882` |
| ownerExemplarSourceHash | `c61a112f54243d7affb9e106d05d7d7f83ea31353a604d4d5124f6847db32d2e` |
| v2 codeHash | `8d9c7067c93168bf22dd3d20014a65400afca1c9266495bd4effabc9979d2bac` |
| v2 indexHash | `2c2f551660477a40f5c22bf94c543259e057be33d5966d210fc24c23c407b348` |
| v2 policyHash | `2a6da6ad48be340f73863f6cd358132cf6b852f8dde768d07c6ab7694a9c4a56` |
| v2 policyId | `existing-v2/job-b` |
| v2 registryHash | `de31011cab4b5ca22e130016aaaecd5d41e867ea7bea0a21b101dc9ba9bc9d21` |
| artifact-hashes.json file bytes | `e82c5c1bbff8a6c0b433b4f4e118e14c21b52cf7ae5aae08fe1220cb87012f33` |
| versions.json file bytes | `004c7b930f9d0255ab3d5d6ec674d986fc4e13f3d21dcf05e7a88b9707538968` |

Seed `tars-upsc-a2a-2026-10-07/1`. Exact capture clocks and raw byte hashes are enumerated in the capture manifest; per-code and per-artifact hashes in versions/inventory.

## Verification

| Check | Result |
|---|---|
| `npm run test:evaluation` | 30 passed; log `tools\news\evaluation\data\a2a-bootstrap-2026-10-07\test-evaluation-owner.log` |
| `npm run test:bootstrap` | 18 passed; log `tools\news\evaluation\data\a2a-bootstrap-2026-10-07\bootstrap-owner-final.log` |
| `npm run test:source-audit` | 5 passed; log `tools\news\evaluation\data\a2a-bootstrap-2026-10-07\source-audit-owner-final.log` |
| `npm run news:bootstrap -- verify ROOT package-owner-final` | passed: schema/corpus, deterministic resampling/permutation, split leakage, frozen-v2 replay, 27 artifact hashes and 44 versioned tooling files; log `tools\news\evaluation\data\a2a-bootstrap-2026-10-07\verify-owner-final.log` |
| `npm run typecheck` | passed; log `tools\news\evaluation\data\a2a-bootstrap-2026-10-07\typecheck-owner-final.log` |
| `npm run lint` | passed: 0 errors, 133 pre-existing warnings; log `tools\news\evaluation\data\a2a-bootstrap-2026-10-07\lint-owner-final.log` |
| `npm test` | 604 passed in 41 files; log `tools\news\evaluation\data\a2a-bootstrap-2026-10-07\root-test-owner-final.log` |
| `npm run test:pipeline` | 39 passed, 6 skipped: canonical-pyq-v2-final.zip / CANONICAL_PYQ_PACKAGE unavailable; log `tools\news\evaluation\data\a2a-bootstrap-2026-10-07\pipeline-owner-final.log` |
| `npm run build` | passed; 165 precache entries, 8816.55 KiB; log `tools\news\evaluation\data\a2a-bootstrap-2026-10-07\build-owner-final.log` |
| `offline annotation browser check` | 26 checks, widths 375/1366; 0 network requests, 0 page errors, 0 substantive labels entered; log `tools\news\evaluation\data\a2a-bootstrap-2026-10-07\browser-owner-final.log` |

Earlier attempts are retained honestly: a concurrent root-suite run exceeded the existing 5,000ms performance budget at 5,017.8ms; isolated reruns passed without threshold changes. New synthetic tooling tests initially exposed incomplete test fixtures/order assumptions; those were corrected and all 18 final tests passed. Synthetic fixtures remain in-memory tests, never natural corpus gold.

Automatic approval review rejected placing the positive exemplar corpus in the blind folder due to bias; the safe final package separates it. An optional source-audit retry was initially not executed when approval review hit a usage limit; after owner continuation it passed all five tests. Nothing remains blocked by that review failure.

## Human work next

1. Primary human reviews observable metadata and its sufficiency, assigning authentic value/scope/subject/content/identity labels with evidence, or preserving unresolved labels.
2. Review candidate sets and sequences for equivalence, material delta, distinct/redundant analysis, representatives and reading-state semantics; uncertainty must remain explicit. A claimed temporal repeat needs actual earlier observations, not publication-date inference.
3. Audit families across both partitions, reconcile newly found leakage in a new version before C/D tuning, and import authentic responses.
4. Arrange independent second review later for protected/must-read slices, disagreements, random overlap and final holdout. Do not compute single-reviewer agreement as independent agreement.
5. Collect prospective multi-day feed metadata in a later authorized capture window and judge a complete daily candidate pool before E/F temporal/capacity quality claims. The future release holdout remains future and sealed.

## Exact files changed

Tracked modifications:
- `package.json`
- `tools/news/evaluation/evaluate.ts`
- `tools/news/evaluation/evaluation.test.ts`
- `tools/news/evaluation/gates.proposed.json`
- `tools/news/evaluation/report.ts`
- `tools/news/evaluation/rubric.md`
- `tools/news/evaluation/validate.ts`

New untracked implementation/report files:
- `tools/news/evaluation/BOOTSTRAP.md`
- `tools/news/evaluation/JOB_A2A_EVIDENCE.json`
- `tools/news/evaluation/JOB_A2A_REPORT.md`
- `tools/news/evaluation/bootstrap-browser-check.mjs`
- `tools/news/evaluation/bootstrap-capture.ts`
- `tools/news/evaluation/bootstrap-cli.ts`
- `tools/news/evaluation/bootstrap-review.ts`
- `tools/news/evaluation/bootstrap.test.ts`
- `tools/news/evaluation/bootstrap.ts`
- `tools/news/evaluation/editorial-judgment-schema.json`
- `tools/news/evaluation/editorial-judgments.ts`
- `tools/news/evaluation/editorial-metrics.ts`
- `tools/news/evaluation/editorial-output-schema.json`
- `tools/news/evaluation/editorial-policy.ts`
- `tools/news/evaluation/editorial-replay.ts`
- `tools/news/evaluation/editorial-schema.ts`
- `tools/news/evaluation/editorial-study.ts`
- `tools/news/evaluation/editorial.test.ts`
- `tools/news/evaluation/frozen-v2.ts`
- `tools/news/evaluation/owner-exemplars.ts`
- `tools/news/evaluation/reviewer-ui.ts`
- `tools/news/evaluation/temporal-package.ts`

Ignored local artifacts live under `tools\news\evaluation\data\a2a-bootstrap-2026-10-07`; the package inventory and capture manifest enumerate all required evidence files. No production source file was modified.

## git diff --stat

```text
package.json                              |  5 +++-
 tools/news/evaluation/evaluate.ts         | 30 +++++++++++++---------
 tools/news/evaluation/evaluation.test.ts  |  4 +--
 tools/news/evaluation/gates.proposed.json | 41 +++++++++++++++++++++++--------
 tools/news/evaluation/report.ts           |  3 ++-
 tools/news/evaluation/rubric.md           | 15 +++++++++++
 tools/news/evaluation/validate.ts         | 20 ++++++++++++---
 7 files changed, 88 insertions(+), 30 deletions(-)
```

This tracked diff statistic excludes the new untracked files listed above; no files were staged merely to inflate the statistic.

## git status --short

```text
M package.json
 M tools/news/evaluation/evaluate.ts
 M tools/news/evaluation/evaluation.test.ts
 M tools/news/evaluation/gates.proposed.json
 M tools/news/evaluation/report.ts
 M tools/news/evaluation/rubric.md
 M tools/news/evaluation/validate.ts
?? tools/news/evaluation/BOOTSTRAP.md
?? tools/news/evaluation/JOB_A2A_EVIDENCE.json
?? tools/news/evaluation/JOB_A2A_REPORT.md
?? tools/news/evaluation/bootstrap-browser-check.mjs
?? tools/news/evaluation/bootstrap-capture.ts
?? tools/news/evaluation/bootstrap-cli.ts
?? tools/news/evaluation/bootstrap-review.ts
?? tools/news/evaluation/bootstrap.test.ts
?? tools/news/evaluation/bootstrap.ts
?? tools/news/evaluation/editorial-judgment-schema.json
?? tools/news/evaluation/editorial-judgments.ts
?? tools/news/evaluation/editorial-metrics.ts
?? tools/news/evaluation/editorial-output-schema.json
?? tools/news/evaluation/editorial-policy.ts
?? tools/news/evaluation/editorial-replay.ts
?? tools/news/evaluation/editorial-schema.ts
?? tools/news/evaluation/editorial-study.ts
?? tools/news/evaluation/editorial.test.ts
?? tools/news/evaluation/frozen-v2.ts
?? tools/news/evaluation/owner-exemplars.ts
?? tools/news/evaluation/reviewer-ui.ts
?? tools/news/evaluation/temporal-package.ts
```
