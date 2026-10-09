# Validator v3 evaluation schema and release protocol

Status: proposed evaluation design, 2026-10-07. No new gold corpus, human review or v3 result exists yet. See [architecture](VALIDATOR_V3_SPEC.md) and [work packages](WORK_PACKAGES.md).

## 1. Evaluation questions and units

Measure four separate losses: acquisition (a valuable article never enters feeds), acceptance (metadata enters but is rejected/deferred), representation (wrong subject or merge), and selection (valuable development/analysis does not reach Today). Report each, rather than reporting one blended recall number.

Units:

- Feed observation: one publisher metadata entry at a capture time; preserve feed membership and metadata revision.
- Article: stable canonical URL, deduplicated across feeds; revisions are related observations.
- Development: one material event or new finding, potentially with several reports.
- Analysis angle: a separately valuable explanation/column, even when discussing an existing event.
- Theme sequence: developments and analyses on a running issue across days.
- Selection replay: all observations and available history at a specified clock, producing Today/Archive/alternatives.

Gold primary subject and content type are not collection strata. A World feed is a sampling stratum, not an IR label. Curated author status and source preference are not relevance labels. The corpus includes rejected items and items neither v2 nor v3 considers relevant.

## 2. Gold record schema

Use schema version `tars-news-gold/v1`. Validate with a JSON Schema in Job A; this table is the planning contract. Exact file names may be implemented as JSONL plus manifests. Keep machine predictions in separate run artifacts, never in reviewer records.

| Field | Type / meaning |
| --- | --- |
| `id` | Immutable corpus ID; assigned from capture namespace + canonical article identity, with documented collision handling |
| `observationIds` | Nonempty references to source observations; each has source ID, capture timestamp, publisher publication/update timestamp if present, metadata hash and parser version |
| `metadata` | Actual title, bounded feed description, URL, publisher, memberships/sections, categories and optional bylines with provenance. No body HTML/text, generated summary or inferred publication date |
| `sampling` | Panel, observable stratum, selection seed, inclusion probability where estimable, collection window and population denominator |
| `review.status` | `unreviewed`, `in_review`, `disputed`, `adjudicated`, `unresolvable` |
| `review.annotations` | Independently recorded reviewer IDs, timestamps, rubric version, label values and evidence references; never overwritten by adjudication |
| `review.adjudication` | Final reviewer/adjudicator identity, rationale and resolution version; null until resolved |
| `gold.value` | `must_read`, `useful`, `reject`; null until adjudicated |
| `gold.primarySubject` | Polity, Governance, Economy, International relations, Security, Sci-Tech, Environment, Geography, History & Culture, or `not_applicable`; null if unresolvable |
| `gold.secondarySubjects` | Optional distinct supported subjects; not substitutes for primary accuracy |
| `gold.contentType` | `news_report`, `explainer`, `editorial`, `column`, `analysis`, `digest`, `interview`, `official_release`, `other`, `unknown` |
| `gold.partyPoliticsPrimary` | Boolean after review; true means primarily campaign/candidate/alliance/reaction/personality/horse-race material, not merely party mentions |
| `gold.partyMention` | Boolean, retained separately to test incidental mentions |
| `gold.scope` | `india_domestic`, `india_impact`, `global_knowledge`, `foreign_domestic_no_impact`, `unknown`; mechanisms/reasons separately recorded |
| `gold.storyId` | Stable adjudicated development ID, or null if no coherent development |
| `gold.themeId` | Stable adjudicated running-theme ID, or null for unrelated/no-theme items |
| `gold.angleId` | Stable valuable analytical angle ID, or null; not automatically author/source dependent |
| `gold.novelty` | `new_development`, `distinct_analysis`, `repeat`, `uncertain`, `not_applicable`, plus `relativeTo` prior IDs and a cutoff; never a timeless label |
| `gold.materialDelta` | Action/effect, report period, finding or analytical distinction with evidence span references; null when not established |
| `gold.rejectReasons` | Codes such as `party_primary`, `foreign_domestic_no_impact`, `routine_local`, `promotion`, `entertainment_primary`, `no_substantive_value`; empty for positives |
| `gold.rationale` | Short reviewer-authored reasoning tied to metadata spans and syllabus rationale, without reproducing article bodies |
| `gold.metadataSufficiency` | `sufficient`, `limited`, `insufficient`, and missing fields; independent from value label |
| `gold.reviewBasis` | `feed_metadata` for main metrics; any permitted manual external-reference judgment is a separate coverage record, not silently mixed into runtime-observable gold |
| `partition` | `development`, `validation`, `holdout_unseen`, `holdout_forward`, `legacy_regression` or `synthetic_adversarial` |

Null is unknown, never a negative label. `unresolvable` is a review disposition, not a fourth relevance class. Keep it in denominators for review-completion reporting and runtime coverage/abstention analysis, but exclude it from resolved-label precision/recall with its count shown explicitly. A gold positive with limited metadata still counts as missed when the model defers.

Separate pair/sequence judgments are necessary:

- Event pairs: `same_development`, `related_distinct_development`, `unrelated`, `uncertain`; include cannot-link evidence.
- Analytical pairs: `equivalent_angle`, `complementary_valuable_angle`, `redundant_analysis`, `uncertain`.
- Anchor pairs/sets: `comparable_quality`, `left_materially_better`, `right_materially_better`, `uncertain`; assess substance with publisher identity masked first where practical. Apply TH/IE preference only after substance judgment.
- Daily sequence gold: known input/history cutoff, qualifying developments/angles, material-repeat judgments and permissible representatives. Separate current article value from whether another version already covers the reading need.

`must_read` means unusually high UPSC value due to consequence or explanatory insight; it does not mean “published by TH/IE”, “from UPSC feed”, “famous author” or “multiple publishers”. `useful` means substantive syllabus-relevant reading worth retaining. `reject` means fails the product scope/substance rubric. A valuable repeat remains `useful`/`must_read` at article level and is separately labelled redundant for the sequence.

## 3. Construct the corpus from raw, unfiltered feeds

### Collection boundary

Capture allowlisted feed metadata before `classify`, active-list selection, article acceptance, clustering or Today filtering. Preserve pre-deduplication feed membership and parsing diagnostics. “Raw” means unfiltered metadata; do not save `content:encoded`, full articles, cookies, credentials or article HTML in fixtures. If the feed description itself contains a body, retain only the bounded metadata excerpt allowed by the application.

Reuse gateway limits and per-shard requests. The current `tools/news/snapshot.ts` collects the entire registry under one shared collection budget and saves one deduplicated snapshot; it is useful historical evidence but is not the v3 longitudinal collector. Job A records per-shard/per-source capture status, HTTP/parse outcomes, counts before/after normalization, freshness and observation timestamps. Do not treat a failed source as zero relevant supply or silently substitute yesterday's feed for a fresh raw capture. Preserve stale observations with their real age separately.

Proposed sampling frame: at least six weeks. Development/validation acquisition uses the first four weeks; a prospective, untouched final period of at least two weeks follows candidate freeze. Within each period use fixed, preregistered capture slots (for example four daily UTC timestamps corresponding to Indian reading times), independent of model outcomes. This describes a future collection job, not permission to schedule an automation now.

### Two natural-feed panels and one separate stress suite

Target at least 4,000 unique naturally observed articles across the full study, extend collection if important strata remain sparse:

1. **Representative panel, approximately 60%.** Probability sample stratified by source family/section and capture day from all raw observations, then deduplicated article identities. Specify disjoint sampling cells and sampling probability; repeated observations do not multiply an article's weight. Preserve population counts so population-weighted precision/recall can be estimated.
2. **Coverage panel, approximately 40%.** Enrich TH/IE Explained/UPSC, Science, Environment, columns/editorials, author-bearing entries, likely Security/IR/Economy, opaque headlines, single-source articles, party/country-specific material and multi-day running themes. Sampling predicates use source metadata and neutral topic search, never model accept/reject/score. Track overlapping strata; priority assignment produces a single panel membership per article. Report this panel separately; do not pretend the enriched mix is the feed population.
3. **Stress suite.** Real adversarial cases held out from rule authors where possible, plus separately marked synthetic minimal pairs/metamorphic tests. Synthetic cases verify invariants; never add them to natural precision/recall or claim they are captured articles.

Sample complete candidate pools on selected replay days in addition to sampled labelled articles. Label every displayed candidate needed for precision-at-K; do not treat unlabelled output as false or silently omit it. Include all known reports/angles of sampled story sequences so clustering and saturation judgments are possible.

Protected slices can overlap. Aim for at least 100 adjudicated positive editorial/column items, 100 Explained items, 100 Science items, 100 Security items and 150 must-read items across final holdout panels, and at least 200 party-primary negatives. These are evidence sufficiency targets, not expected feed yields. Require at least 50 positives in each protected slice of the unseen holdout before a definitive slice claim; if unavailable, extend collection or report that slice as not demonstrated. Include a dedicated census of observed columns by the two requested authors; absence from feeds is a coverage finding, not perfect recall.

### Acquisition coverage audit

A raw-feed corpus can only measure recall conditional on capture. Separately, a reviewer checks permitted publisher section/author listing metadata for expected high-value titles/URLs during sampled periods. Record `expected`, `observed_in_raw`, `metadata_sufficient`, `accepted`, `selected_or_represented` and failure cause. No automated bulk article reading. Listing discovery and candidate feed verification are source-intelligence work; endpoints and publication inventories are not assumed complete or verified by this plan.

Publish acquisition recall only against this explicitly bounded, independently collected reference inventory. A missing column does not enter conditional validator recall as a rejection; it does enter end-to-end coverage accounting. Re-run raw captures after legitimate new feeds are introduced; archive new registry/parser hashes without overwriting old observations.

## 4. Independent labelling and holdout isolation

1. Freeze the rubric, observable strata, seed, collection policy and dataset manifest before model tuning. Existing v2 predictions may be generated for baseline reporting but are inaccessible to annotators.
2. Two independent human reviewers label all holdout and protected/adversarial slices; preferably all natural cases. Show source/section when necessary for metadata interpretation, but hide machine decisions, scores, ranking, author whitelist status and suggested subject. Reviewers supply evidence before viewing each other's labels.
3. Measure agreement on value, primary subject, party flag, story relations and novelty. Adjudicate disagreements; never let a coding agent's guesses become gold. Pending human judgments remain pending and block quality acceptance, not harness implementation.
4. Freeze labels and append corrections with rationale and version. Do not relabel a difficult positive to make a gate pass. Material rubric changes invalidate comparisons and require relabelling affected slices independently.
5. Development/validation split is group-based, targeting 75/25 of the initial four-week data. All same URLs/revisions, duplicate/syndicated texts, events and close analytical paraphrases stay together. Group running themes conservatively to prevent leakage. Stratification operates on whole groups and records achieved imbalance rather than splitting duplicates to hit a quota.
6. After all tuning on development/validation, lock code/config/index/registry hashes and a prediction runner. Collect or unlock the final prospective period under a separate evaluator. Target at least 1,000 final articles; actual totals may exceed 4,000 to satisfy slice support.
7. **Primary holdout (`holdout_unseen`):** new event/theme families absent from development/validation. Include all their duplicates/revisions in this partition. Deduplicate near-paraphrases and syndicated copies across splits. This supports claims of generalization.
8. **Forward holdout (`holdout_forward`):** later observations of continuing themes such as SIR, isolated for temporal saturation measurement. Past metadata history is allowed as runtime input; future labels, post-cutoff revisions and human gold story/theme IDs are never runtime features. Report it separately because the theme was previously seen. Holdout labels and future metadata remain untouched during tuning.
9. Final evaluation is a single frozen release decision. If it fails, preserve the failure report; the inspected holdout is spent for further tuning. The next candidate needs a new untouched future window. Never keep rerunning a disclosed holdout and calling it untouched.

Implementation agents have development data and harness tests, not holdout labels/examples. The holdout custodian owns sealed manifests and results. If no independent custodian/reviewers are available, implement the harness and mark gold quality claims pending; do not manufacture independence with the same agent.

Legacy `relevance-cases.json` and `substance-cases.json` remain visible regression suites. Their old `borderline` records are not negatives and need fresh review under v3 policy if used for diagnosis. Existing known misses/false positives do not become acceptable v3 exceptions automatically.

## 5. Metrics with explicit denominators

For resolved article labels define positive as `must_read` or `useful`; negative as `reject`. A prediction is positive only after eligibility plus relevance. Deferred/insufficient metadata counts as predicted negative for resolved positives. Report counts, rates, missing-label counts and 95% intervals; use grouped bootstrap by theme/day for dependent observations, including weighted estimates for the representative panel. Also show unweighted diagnostics and macro slice results.

| Metric | Definition / required breakdown |
| --- | --- |
| Overall precision / recall / F1 | TP/(TP+FP), TP/(TP+FN), harmonic mean; article acceptance and final visible-unit relevance separately |
| Must-read recall | Accepted gold must-read articles / all gold must-read articles; also unique must-read reading needs represented at top level and anywhere in expanded coverage |
| Primary subject accuracy | Correct exact primary / all adjudicated relevant articles; abstention counts incorrect. Run classifier on gold positives regardless of acceptance to avoid selection bias |
| Subject macro-F1 / confusion | Per-subject precision/recall/F1, macro mean, confusion matrix; separately conditional-on-acceptance accuracy, abstention rate and selective accuracy |
| Editorial/column recall | Positive gold editorial/column items accepted / all such positives; separate types, publisher and requested-author slices; final unique-angle recall too |
| Explained recall | Same formula on positive gold explainers; IE UPSC/Explained source slices separately so feed-section and type are not conflated |
| Science / Security recall | Accepted positives with gold primary Sci-Tech/Security / all positives in those subjects; correct routing and final reading-need recall also reported |
| IR / Environment / Economy protection | Same stage and final recall breakdown; include false IR routing of national/party items |
| Party-politics false-positive rate | Accepted gold party-primary negatives / all gold party-primary negatives; also party-primary share of displayed articles. Incidental-party positive recall reported separately |
| Foreign-domestic false-positive rate | Accepted foreign-domestic/no-impact negatives / all such negatives; separate countries and compare India-impact/global-knowledge positive recall |
| Acquisition coverage | Observed raw URLs / independently inventoried expected valuable URLs, by publisher/section/author; report unavailable references and metadata insufficiency separately |
| Event clustering | Pairwise precision/recall plus B-cubed F1, false-merge and false-split rates on adjudicated event membership; cannot-link failures separately |
| Duplicate exposure | Excess top-level units for the same gold development/equivalent angle divided by all top-level units per replay cutoff; alternatives do not count as duplicate top-level exposure |
| Running-topic saturation | Selected units labelled repeat against preceding seven-day history / selected units in continuing themes; also unjustified repeats per theme-day and legitimate-new-development recall |
| Analysis preservation | Distinct valuable angles visible / eligible gold angles; another article mentioning the same theme is not a recall success |
| Publisher/source distribution | Raw, metadata-sufficient, eligible, accepted, clustered, primary, alternative and final counts/shares; conditional rates versus available gold-positive supply |
| Publisher preference | TH/IE selected among gold-comparable candidate sets / all such sets; false-preference rate when a materially stronger other publisher exists |
| Quality/diversity | nDCG@20/50/100 with preregistered ordinal gains (must-read 3, useful 1, reject 0); subject share/entropy, theme concentration and coverage of available strong subjects; no target entropy rewarded independently of quality |
| Diversity regret | Loss in gold utility and unique must-read coverage versus quality-only selection from the same accepted pool, alongside improvement in theme/subject concentration |
| Operational | p50/p95 runtime/memory on pinned batches, repeat/permutation equality, cache/reload equality for identical history, feed failures/truncation, verdict trace completeness |

Do not score unlabeled predictions as negatives. For a top-K list with unresolved entries, report judgement coverage and bounds; the gate stays pending. Report recall both at URL/article level and at development/angle level; duplicates may be safely collapsed, unique columns may not. Personal Saved-only items are excluded from recommendation precision while their preservation is tested independently.

## 6. Proposed acceptance gates

These targets must be preregistered in Job A before tuning and approved as the implementation acceptance contract. They are not assertions of feasibility or achieved performance. Report confidence intervals and counts with every rate. Undersized slices remain not demonstrated even when point estimates pass.

| Gate | Proposed requirement |
| --- | --- |
| Article relevance | Representative-panel precision >=95%, recall >=90%; macro protected-slice recall must not be masked by aggregate volume |
| Must-read | Acceptance recall >=95%; final unique reading-need recall >=95% when gold needs fit within capacity. When >100, report capacity bound and nDCG separately; do not silently waive losses |
| Classification | Exact primary accuracy >=90%, macro-F1 >=0.85; Science and Security correct-primary recall >=85%, counting abstentions as misses |
| Protected classes | Editorial/column, Explained, Science and Security article acceptance recall each >=90%; materially improved missed-content coverage versus frozen v2 on the same newly labelled inputs |
| Political/foreign noise | Party-primary and foreign-domestic/no-impact FPR each <=1%; zero failures on unequivocal policy/adversarial invariant cases; preserve >=90% incidental-party institutional and global-knowledge positive recall |
| Clustering | Same-event pairwise precision >=98%, recall >=90%; zero critical cannot-link violations |
| Saturation | <=5% unjustified repeat exposure on continuing-theme replay and >=95% recall of material new developments/distinct must-read angles; duplicate top-level exposure <=5% |
| Publisher policy | 100% of deterministic equivalent-quality policy cases select TH/IE; >=95% agreement on naturally adjudicated comparable anchor sets; no critical materially-inferior preferred-source override |
| Final quality/diversity | Precision@20/50/100 >=95% on fully judged lists; no drop >2 percentage points in protected-slice recall versus quality-only selection; demonstrate reduced theme repetition without reducing unique must-read coverage |
| Determinism/boundaries | 100% identical decision/order output under repeated/permuted replay; no article-body fetching/storage or personal-state loss; application regression checks pass |

Compare v2 and v3 on identical raw inputs and clocks, with separate diagnostics for source expansion. Run a fixed-registry ablation and an expanded-registry acquisition report so more feeds cannot be mistaken for better classification. Report whether improvements are supported by intervals; a small sample does not justify a superiority claim.

V3 has no release-quality claim until all required holdout gates are evaluated. A structural privacy/state invariant failure blocks integration regardless of accuracy. Insufficient metadata, reviewer disagreement or missing source access is an explicit limitation, not a reason to lower thresholds post hoc.

## 7. Required adversarial cases

Use real raw examples where available; pair with explicitly synthetic minimal changes for invariant checks.

| Family | Required positive/negative contrast |
| --- | --- |
| Authors | PB Mehta constitutional analysis and C. Raja Mohan strategic analysis with opaque headlines; authentic byline vs name mentioned in text; known author writing party tactics; missing/co-authored bylines |
| Source coverage | Same IE URL observed first in India then Explained/opinion; identical TH article in National and Science; missing columns feed; failed/empty feed vs zero good supply |
| Science | NASA discovery vs NASA domestic personnel dispute; foreign scientific finding vs local campus award; mission science vs promotional livestream/product story |
| Hormuz | Geography explainer vs India-facing strategic blockade vs diplomatic negotiation vs domestic inflation transmission; identical place anchor, different primaries |
| Political | Court ruling with a party litigant vs party reaction to ruling; constitutional analysis vs campaign strategy; candidate/alliance/personality reports containing ECI/SIR/Constitution keywords |
| Foreign scope | US/UK/China domestic court/election stories vs evidenced India impact; country name absent but national institutions present; global climate finding vs local climate lawsuit |
| Security | Defence readiness, doctrine, cyber infrastructure, border policy, terror finance; ceremonial military visit, routine crime, sensational arrest and company defence promotion as negatives |
| Hard noise collisions | Sports law vs match result; celebrity rights judgment vs gossip; regulator policy after recall vs routine product recall; “recruitment reform” vs job advertisement |
| Lexical ambiguity | CPI(M)/CPI, US Congress/Congress party, lower-case us/US, up/UP, generic pipeline/energy pipeline, named security company/national security |
| Analysis | One concept with strong analysis; no PYQ lexical hit but clear syllabus connection; empty/truncated description; “Explained” branding on low-value material |
| Temporal saturation | Seven-day SIR sequence: original action, five paraphrases/reactions, interim order with changed effect, fresh report, distinct constitutional analysis; no penalty for unrelated ECI development |
| Event separation | India–EU/India–US/Iran–US talks; two court cases; draft vs enactment; two reports with different periods; common numeric values; digest spanning unrelated developments |
| Publisher ranking | Comparable TH/IE wins; materially stronger other publisher wins; weak famous-author piece loses; source outage; syndicated copies do not add independent quality |
| Identity/state | New source arrival changes anchor; sixth publisher brings actual development; changed title/date under same URL; removed feed with Saved article; repeat snapshots/reload/timezone boundary/undated/future-dated entries |

Metamorphic requirements: permutations cannot change decisions; adding irrelevant party names does not add relevance; adding another publisher's duplicate cannot make an ineligible item eligible; removing byline cannot change a clear subject; changing a static geographic anchor alone cannot override dominant IR/Security framing; adding weak supply cannot fill a subject quota; no future observation can affect an earlier replay.

## 8. Reports and stopping rules

Each run produces manifest hashes, policy version, dataset partition, clock/history, review completion, per-stage counts, metrics with denominators/intervals, confusion matrices, publisher/author/source funnel, missed must-reads, harmful merges, suppressed novel developments and performance evidence. Human label artifacts are immutable; model traces are separately replaceable outputs.

Finish with an error taxonomy: unavailable source, parser metadata loss, insufficient metadata, eligibility error, relevance error, subject error, event merge/split error, novelty error or final-selection error. Fix the owning stage. Do not retune `relevance.ts` to mask an acquisition or grouping failure.

The recommended sequence is harness/rubric first, source audit and raw collection second, independent labelling, isolated stages, shadow integration, candidate freeze, then untouched evaluation. Outstanding acceptance decisions are human reviewer/custodian assignment and approval of proposed quantitative gates/sample sufficiency. The principal evaluation risks are selection bias, author/section leakage, unresolved labels treated as truth, split contamination, future-history leakage and misreporting collapsed generic coverage as recall of a distinct column.
