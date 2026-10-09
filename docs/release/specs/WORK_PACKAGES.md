# Validator v3 isolated work packages

Planning only, 2026-10-07. These are future Codex job briefs, not authorization to run them now. Read [VALIDATOR_V3_SPEC.md](VALIDATOR_V3_SPEC.md) and [EVALUATION_SCHEMA.md](EVALUATION_SCHEMA.md) before implementation.

## Shared contract for every job

- Inspect the actual checkout, `AGENTS.md`, `docs/FOUNDATION.md` and `docs/VERIFICATION.md` first. The planning baseline is HEAD `d21798db6212553e63420a8efd6e1f71c87417d9` with substantial pre-existing local changes, including Atlas corpus work and a News builder source pin. Do not overwrite or adopt unrelated work.
- No commit, merge, push, deployment, remote creation or publication without explicit owner authorization. Local implementation authorization is per package.
- Preserve Atlas assets/IDs/text/citations, installed identifiers, compatibility stores, URL-based reading state, backups, sync/auth and reader policy. Never fetch article bodies for validator input or collect text through smry.ai.
- Use deterministic functions, versioned data and explicit clocks. No paid API, model dependency or body-derived enrichment.
- Existing labelled fixtures are regression material, not new gold or holdout. Do not replace human adjudication with model-generated truth, hide misses in exception lists or weaken gates after seeing holdout results.
- Likely paths below are ownership boundaries. New v3 stages live under `src/current-affairs/validator-v3/`; existing facade/wiring changes wait for F unless specifically listed in B. A job may propose a required boundary change in its handoff; it must not silently expand into a different job.
- Keep generated assets derived from pinned inputs. Do not edit `public/current-affairs/v2/relevance-index.json` or canonical packs by hand. News remains on its existing canonical 2.1.0 source pin unless separately authorized.
- Every implementation handoff includes scope/diff, exact inputs and hashes, commands/results, known limitations, remaining human review, and next-job contract. Do not equate local mocks with authenticated live production.

Required implementation verification: root `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:pipeline`, `npm run build`, and relevant browser checks. F runs the whole `npm run test:browser` suite; B/F also run applicable Cloudflare and cache tests. If package inputs or browsers are unavailable, record skips/failures and preserve the unmet gate. Do not install dependencies or regenerate unrelated canonical content merely to conceal a missing input. Build outputs and pre-existing dirty files require before/after scope inspection. These application checks were not rerun for the planning-only deliverable.

## A. Gold corpus and evaluation harness

### Exact scope

A1 creates schema validation, the annotation rubric, manifest/partition tooling, unfiltered metadata collection boundary, sampling and deterministic replay/evaluation machinery. A2 collects the approved corpus, coordinates independent human labels, freezes partitions and records the v2 baseline. A3 is a final independent evaluation invocation after F freezes the candidate; it adds no tuning. Keeping these phases distinct avoids waiting for future data before useful harness work and avoids exposing final gold to implementation jobs.

The collector captures metadata before acceptance and before cross-feed deduplication, with source membership and health. It must operate per shard, not inherit `snapshot.ts`'s whole-registry deadline as the raw sampling frame. Safe metadata-only fixtures may be added; raw full-feed bodies are not corpus artifacts.

### Likely files/modules

- New `tools/news/evaluation/`: `schema.json`, `rubric.md`, `collect.ts`, `sample.ts`, `validate.ts`, `split.ts`, `evaluate.ts`, `replay.ts`, `report.ts` and focused tests.
- New local `tools/news/evaluation/data/` manifests/annotation inputs, with storage/ignore policy reviewed before capturing copyrighted metadata. Keep sealed holdout labels outside implementation-agent access; do not commit them merely for convenience.
- Existing read-only inputs: `tools/news/audit.ts`, `snapshot.ts`, `legacy/`, current classifier/clustering/workspace, `src/current-affairs/fixtures/`, `gateway.ts`, `shards.ts` and `feed.ts`.
- Root `package.json` only for narrowly scoped evaluation scripts if authorized. Do not change the production validator to make harness interfaces convenient.

### Dependencies and inputs/outputs

Depends on approved rubric, numerical gates and human reviewer/custodian assignment. A1 can use the current registry; A2 incorporates B's verified metadata/coverage results and starts a new manifest generation when registry/parser changes.

Inputs: raw metadata observations, parser/registry/index hashes, existing frozen baseline, explicit capture/evaluation clocks, independent human annotations. Outputs: validated gold records, grouped split manifest, review-completion and agreement report, frozen baseline predictions, per-stage evaluator, sequence replay, metrics/report artifacts. No numeric claim before adjudicated labels exist.

### Tests

- Reject missing provenance, duplicate IDs, label contradictions, incomplete adjudication and accidental body fields.
- Demonstrate unreviewed/null/borderline labels never count as negative; gold-positive runtime deferral counts as a miss.
- Validate metrics on tiny hand-computable examples, including weighting, zero denominators, abstention, topic vs unique-angle recall, duplicate exposure and pairwise/B-cubed clustering.
- Detect cross-partition URL/revision/syndication/event/theme leaks; reject future metadata in earlier replay.
- Preserve raw-source failure/empty distinctions; deterministic samples/manifests under input permutation; no v2/v3 scores in annotation exports.
- Fully judged top-K denominator checks and stale-snapshot timestamp integrity.

### Acceptance criteria

A1 passes schema/harness tests with complete contract coverage and no production behavior change. A2 provides the preregistered split and sufficient independently adjudicated data; pending reviews are stated, not filled by an agent. Baseline and v3 can be evaluated on identical metadata/clocks. A3 runs the sealed final evaluation once, reports every gate, and declares pass/fail/not-demonstrated without retuning.

### Must not change

Production source list, classifier/index, presentation, reader/access/storage contracts, labels to improve results, or the sealed holdout after candidate freeze. Never report raw feed sampling as complete recall over all publisher output.

## B. Source and author intelligence

### Exact scope

Audit why PB Mehta/C. Raja Mohan columns and TH/IE Science/Explained items are absent. Build the source coverage matrix and acquisition funnel. Verify legitimate column/opinion/Science/Explained feeds and author metadata availability; add only justified, tested feed entries within the registry ceiling. Feed URLs are research outputs, not guessed from naming conventions.

Add bounded optional feed bylines/categories/multiple source memberships. Deterministically merge same-URL metadata without losing a specialist section. Build a curated author registry with verified aliases/provenance and publisher binding. No author whitelist pass, author subject default or article-page crawler.

### Likely files/modules

- `src/current-affairs/sources.ts`, `types.ts`, `feed.ts`; relevant tests in `current-affairs.test.ts` plus new parser/registry tests.
- New `validator-v3/source-intelligence.ts`, `author-registry.ts`, `metadata.ts` (or equivalent narrowly scoped evidence modules).
- `tools/news/probe.ts`, new coverage audit under `tools/news/evaluation/` using A's observation format.
- `shards.ts`, `functions/api/current-affairs.ts`, `tools/news/server.ts`, `useFeeds.ts` only if required for registry-generation compatibility; document any necessary adapter changes explicitly.
- `archive.ts` and pinned metadata cleaners only for additive bounded metadata round-trips in coordination with F; no database/store version change. Review backup adapters before assuming new fields survive.

### Dependencies and inputs/outputs

Depends on A1 schema and raw observation contract. Inputs: registry, independently observed publisher feed/listing metadata, parser tests, requested author names and current source restrictions. Outputs: source audit with known coverage gaps, verified registry diff, versioned author records, normalized bylines/memberships with uncertainty, backward-compatible metadata adapters and repeated feed-probe evidence.

### Tests

- RSS `dc:creator`, RSS author and Atom author extraction; missing/ambiguous/multiple authors; name in title cannot become byline.
- IE general feed preceding Explained/column feed cannot erase specialist provenance; reverse order yields identical metadata.
- Host/source spoofing cannot acquire TH/IE or curated-author privilege; publisher metadata must bind to an allowlisted source/domain.
- Existing cached response/archive row without optional fields still loads; safe metadata limits and thumbnail/URL policy persist.
- Repeated live probes with existing limits, source overlap/freshness and byline-yield reports; failures are reported without redirect/paywall workarounds.
- Registry growth stays <=99 feeds and <=6 upstream requests per shard. Test mixed old/new registry clients and two-hour cached edge responses: adding entries changes round-robin shard membership. Introduce an explicit bounded registry generation/compatibility strategy before enabling a changed layout; never let a partial generation silently delete coverage. Keep old cached data usable and existing cache identity/refresh behavior.

### Acceptance criteria

Requested high-value classes have a documented discovery path or an explicit unresolved publisher limitation. PB Mehta/C. Raja Mohan can be identified when a verified feed byline is available; no guessed aliases or authorship. Same-URL metadata retains all observed source memberships independent of feed order. Raw acquisition improvements are measured separately from relevance. No unverified endpoint is enabled, and stale/offline behavior survives registry changes.

### Must not change

Relevance thresholds, subject decisions, reader allowlist/restrictions, body fetching, Access policy, sync wire format, personal state, canonical input pins or Today behavior. Do not add other external reading services or silently remove sources to meet a count target.

## C. Hard eligibility and UPSC relevance

### Exact scope

Implement pure evidence extraction, dominant-purpose eligibility, country-scope policy and substantive relevance ranking as separate modules. Eliminate positive relevance from party identities. Preserve constitutional/policy reporting with incidental political actors. Admit substantive analysis without requiring a new event, a frequent PYQ keyword or a second publisher.

Retire broad keyword-only hard veto behavior inside v3. Maintain explicit rejected/insufficient/eligible distinctions, structured reason codes and metadata evidence. No final diversity or classifier feedback.

### Likely files/modules

- New `validator-v3/contracts.ts`, `evidence.ts`, `eligibility.ts`, `relevance.ts`, `policy.ts` and focused tests.
- `src/current-affairs/match.ts` reused where safe; matching changes need shared regression checks.
- Input vocabulary: `tools/current-affairs/lexicon.mjs`, builder and current `evidence-lexicon.ts`. Prefer versioned v3 policy tables rather than mutating v2 baseline behavior mid-comparison.
- If generated concept data must change: build a separate versioned v3 derived asset from verified source inputs and a builder path/option. Keep the v2 asset reproducible and untouched for baseline comparison. Never hand-edit counts or import Atlas supplements into News.

### Dependencies and inputs/outputs

Depends on A1 plus adjudicated development/validation subsets from A2, and B's metadata/registry contract. Inputs: normalized metadata, scope rules, evidence lexicon and pinned syllabus/PYQ index. Outputs: eligibility decisions, independent substance/quality dimensions, must-read-candidate/useful/below-floor tiers, reason traces and isolated evaluation report. Accepted pool remains unpublished until F.

### Tests

- Party reactions/campaigns rejected across sources and authors; institutional judgments with incidental parties remain eligible.
- US and other foreign domestic news excluded without India impact; global scientific/environment knowledge preserved; explicit impact evidence required.
- Opaque columns, single-source Security analysis, one-concept strong explanations, no-PYQ-hit syllabus analysis and IE quizzes as contrasting cases.
- CPI(M)/CPI, UP/up, Congress ambiguities, policy/noise lexical collisions and trivial keyword insertion.
- Publisher duplication cannot change article acceptance; classification labels and available subject supply cannot change it.
- Trace completeness, fixed-point/deterministic scoring and bounded runtime on pinned batches.

### Acceptance criteria

All hard policy invariants pass. Development/validation reports meet the proposed article/must-read/protected-class and party/foreign FPR gates with denominators, or explicitly fail. No quality acceptance while human labels are unresolved. No legacy threshold relaxation or known-error exclusion substituted for v3 design. Missing source/metadata issues remain attributed to B, not hidden by optimistic scoring.

### Must not change

Primary subject assignment, clustering, event membership, saturation, Today cap, user state, source ordering preference, reader behavior or holdout data. Do not convert subject quotas or author prestige into eligibility bypasses.

## D. Independent subject classifier

### Exact scope

Implement a pure primary-subject decision from dominant issue, action/object, section/category and contextual evidence. Use the existing nine subject labels plus explicit unresolved outcome. Keep secondary tags, static learning anchors, exam demand and UPPCS setting separate.

This module runs independently on all evaluable metadata, including rejected items for diagnostics. It must neither accept articles nor use acceptance/score as features.

### Likely files/modules

- New `validator-v3/subject.ts`, `subject-rules.ts` and confusion/adversarial tests.
- Shared `contracts.ts` and `evidence.ts` through agreed interfaces; reuse `match.ts` without duplicating tokenization.
- Existing subject consumers (`workspace.ts`, `analytics.ts`, `NewsScreen.tsx`) are integration references only; F owns changes to routing/display adapters.

### Dependencies and inputs/outputs

Depends on A's adjudicated primary-subject gold, B metadata and C's frozen evidence interface, not C's scores. Inputs: evidence and versioned classification rules. Outputs: primary/secondary subjects, confidence/margin, abstention reason, evidence and full confusion report.

### Tests

- NASA science vs diplomacy vs irrelevant domestic controversy; Hormuz Security/IR/Economy/Geography contrasts.
- Security readiness/border/cyber/terror-finance positives; institutional Polity vs service-delivery Governance.
- World feed and country names do not force IR; Geography anchor does not force Geography.
- Publisher/author/acceptance-score swaps leave a clear dominant subject unchanged.
- Conflicting/sparse metadata abstains rather than inventing a class; secondary tags never satisfy exact-primary accuracy.
- Evaluate all gold positives, including those C rejects, so apparent accuracy cannot improve by hiding hard cases.

### Acceptance criteria

All unambiguous routing regressions pass. Meet proposed exact-primary/macro-F1/Science/Security gates on development and validation with abstention counted correctly. No evidence that a subject or publisher prior overwhelms dominant framing. Results are reproducible independently of C's decision.

### Must not change

Acceptance thresholds, source lists, author privileges, clustering, raw gold labels, novelty, syllabus/PYQ source facts, personal state or News UI layout. No automatic geography-to-IR alias rewrite that fixes Hormuz by breaking genuine geography coverage.

## E. Event clustering, novelty and saturation

### Exact scope

Build event, analysis-angle and running-theme identities with structured match/cannot-link reasons. Group duplicate developments; preserve distinct actions/analyses within a theme. Implement bounded deterministic chronological replay and material-delta detection against metadata history.

Remove the concept of a new single-source acceptance bar from v3 clustering. Keep every accepted URL/metadata record, including display overflow. Repeated stories are presentation-suppressed, not made irrelevant or deleted.

### Likely files/modules

- New `validator-v3/events.ts`, `themes.ts`, `novelty.ts`, `history.ts` and sequence tests.
- `cluster.ts` and `cluster.test.ts` as v2 baseline/reference; no activation edits until F.
- Read-only history adapter contract for `archive.ts`/`useArchive.ts`; A's replay harness and temporal fixtures.
- New deterministic profiling fixture for candidate blocking and large archives; no unbounded all-history pair matrix.

### Dependencies and inputs/outputs

Depends on A pair/sequence gold, B metadata and C accepted-evidence interface. D supplies subject evidence for diagnostics, but predicted subject must not be the sole cluster gate. Inputs: individually accepted metadata, explicit history observations, policy version and clock. Outputs: events/all member URLs, analysis angles, themes, novelty/delta reasons, history-coverage flags and proposed suppression decisions.

### Tests

- Multi-day SIR repetition plus new order, fresh data and a distinct valuable constitutional column.
- Same institution/different developments; counterpart guards; draft/enactment; report periods; shared numbers; digest isolation; centroid chaining.
- Same URL with substantive update vs timestamp-only refresh; same development across midnight; future/undated entries.
- Cold start, missing history, stale source, repeated snapshot, reordered inputs and replay without future leakage.
- A sixth publisher's material update remains available; a sixth repetitive report does not refresh Today.
- Personal-state URLs preserved after merge/split/anchor changes; no Read/Saved data used as novelty truth.
- Baseline and v3 performance on identical 4k-item snapshot plus bounded larger accepted history. Record p95 and peak memory, candidate-pair counts and browser responsiveness; propose an explicit device budget before F rather than adopting a convenient CI-only threshold.

### Acceptance criteria

Meet proposed clustering precision/recall and saturation/new-development retention gates on labelled validation sequences. All critical cannot-link and deterministic replay tests pass. No single-source quality loss, no material-development suppression justified merely by theme membership and no metadata/personal-state loss. History limitations are visible in diagnostics. Expensive derived work is bounded and cacheable by version without a durable personal-state migration.

### Must not change

Article eligibility, primary subject labels, author/source allowlists, body-fetch policy, sync protocols or user read state. No topic cooldown that silently discards important judgments. No new remote/synced novelty store or arbitrary stable-ID migration.

## F. Final ranking, diversity and application integration

### Exact scope

Implement one quality-aware anchor selector and a final selection layer over qualified developments/angles. TH/IE always wins among comparable candidates; materially stronger coverage wins regardless of publisher. Preserve distinct high-value analysis. Apply soft diversity only within comparable quality, never filling weak quotas.

Wire the orchestrator behind an explicit local v2/v3 switch, shadow it on identical metadata, then enable the accepted candidate only after evaluation gates. Preserve Today/Archive/Saved behavior with clear separation between recommendation and saved-only fallback. Remove duplicate decision ownership from old score/solo-threshold/workspace/topic logic when v3 is active.

### Likely files/modules

- New `validator-v3/anchors.ts`, `select.ts`, `orchestrator.ts`, `adapter.ts`, policy manifest and integration tests.
- `src/features/current-affairs/useNewsModel.ts`, `useArchive.ts`, `usePinned.ts`, `useFeeds.ts` as needed for optional metadata and versioned caches.
- `src/current-affairs/topics.ts`, `workspace.ts`, `analytics.ts`, `anchors.ts`, `types.ts`; minimal `NewsScreen.tsx`/`StoryGroup.tsx` plumbing only where existing grouping would override selection or misroute primary subject.
- `archive.ts`, pinned/backup metadata allowlists if optional fields need round-trip support; audit `personal-state.ts` and sync/backup boundaries without changing semantics.
- `tools/browser/news-check.mjs`, relevant reader checks, `tools/cloudflare` tests, and final `docs/FOUNDATION.md`/`docs/VERIFICATION.md` updates describing measured scope.

### Dependencies and inputs/outputs

Depends on accepted A1/A2 and B–E handoffs. Inputs: individually qualified articles, subject and event/novelty outputs, source/author/index/policy hashes, current clock/history, existing filters and URL state. Outputs: selected Today order, quality-aware primaries, retained alternatives/archive reasons, source/subject distribution diagnostics, shadow report, application verification and reversible local activation.

### Tests

- Comparable TH/IE chosen at both event and topic levels; stronger other source chosen when quality difference is material; transitive/stable selection against fixed best candidate.
- Single-source must-read column survives; publisher spam adds no value; empty/weak subject supply does not fill quotas; multiple exceptional developments can exceed soft theme/subject preferences.
- One source adding repetitive Polity cannot drown out comparably strong Science/Security; accepted non-selected items remain searchable in Archive.
- Primary-only subject routing, distinct analytical unit visibility, filters/time budget behavior, accurate counts and top-level/expanded recall accounting.
- Old feed/cache/archive/pinned data loads; accepted pool archived before saturation/cap; saved-only rejected article remains Saved without becoming a fresh recommendation.
- Read/Saved/Removed/notes survive regrouping, source removal, reload, offline and backup round-trips; sync behavior unchanged. New optional metadata cannot store article bodies.
- Exactly existing bounded feed refresh behavior, source failure isolation and registry-generation compatibility; no validator-triggered `/api/article` request.
- Relevant browser checks at phone/desktop sizes and both themes: groups, filters, reader Back/focus, stale cache, manual refresh, reload and offline. Full root/pipeline/build/browser suite; `test:cloudflare` and `test:sync` where metadata round-trips touch their boundaries.

### Acceptance criteria

First, development/validation integration reports meet all proposed gates and application checks without changing protected boundaries. Then freeze candidate inputs/code and have A3 independently run untouched holdout. No release-ready claim until all required gates pass or unmet evidence is explicitly resolved with the owner. Keep performance claims device-specific and live Access/publisher behavior unverified until actually exercised in an authorized environment.

Final handoff includes baseline/v3 comparisons on fixed and expanded registries, measured losses at every stage, known feed gaps, policy versions, artifact hashes and rollback instructions. Rollback changes the local validator selection switch and derived caches only; it must not erase accepted metadata or user state. Deploy remains a separate authorization.

### Must not change

Atlas UI/data/cartography, installed app identifiers, compatibility stores, access/paywall rules, smry.ai behavior/count semantics, D1 schema/sync collection contracts, persisted personal identities or approved gold labels. No broad News redesign, publisher quotas, hidden threshold patches or unconditional author acceptance.

## Recommended implementation order

1. **A1**: freeze schemas/rubric/metrics, implement collector and evaluator, confirm reviewer/custodian and gate targets.
2. **B**: audit discovery, verify feeds/authors and finalize metadata enrichment. Run raw capture with versioned manifests.
3. **A2**: collect and independently label development/validation data, freeze split and v2 baseline. Preserve prospective holdout isolation.
4. **C**, then **D** using the shared evidence contract. Keep their decision ownership separate; no live wiring yet.
5. **E**: build event/theme/angle grouping and temporal novelty, evaluated on complete labelled sequences.
6. **F**: quality-aware anchors, diversity, compatibility integration and shadow checks. Freeze candidate.
7. **A3**: independent untouched holdout and final gate report, followed by any specifically authorized local activation. Failed holdout returns to development with a new future holdout; publication is a separate owner decision.

These are isolated jobs rather than instructions to launch parallel agents. B and A's collection coordination must finish before evaluation claims; a job with pending human gold may complete its harness/code handoff but cannot claim quality acceptance.

## Unresolved product decisions

- Who supplies the two independent reviewers and holds the sealed final evaluation? Human gold is necessary for the requested quality claims.
- Confirm or revise the proposed quantitative targets/sample support **before tuning**; they are not historical product promises.
- Confirm the initial seven-day saturation/14-day history policy after sequence review; longer legal/policy themes may need longer metadata context.
- Additional curated authors beyond the two requested, and any coverage path where the publisher offers no usable permitted feed, need an explicit sourced decision.

Already resolved by the owner: country-specific foreign news without impact on India is excluded; globally applicable knowledge is retained. No remaining decision permits foreign domestic stories simply because they contain a syllabus term.

## Top architectural risks

1. **Acquisition ceiling:** scoring cannot recover an absent column or missing summary/byline. B must report this separately.
2. **Metadata ambiguity:** opaque text makes purpose/subject/novelty uncertain. Trace uncertainty and measure missed positives; never silently read bodies.
3. **Coupled decisions reappearing:** retaining old solo gates, static-anchor grouping or workspace scores after integration can defeat clean v3 stages. F must establish one owner per decision.
4. **Over-suppression:** theme fingerprints can hide independent ECI actions or significant judgments. E requires cannot-link constraints and new-development recall gates.
5. **Publisher and author bias:** preferred brands can hide stronger evidence or confer spurious relevance. Use quality-qualified candidate sets and independent anchor gold.
6. **Evaluation leakage:** old fixture tuning, machine-assisted labels, syndicated split leaks or repeated holdout inspection invalidate results. A owns immutable manifests and independent review.
7. **Compatibility and mixed feed generations:** optional metadata can disappear in allowlists; changed source order can invalidate cached shard membership. Test old rows, all round-trips and registry-generation handling before activation.
8. **Unbounded history work:** full archive all-pairs clustering can stall the browser. Bound candidate/history work and profile on representative phone/desktop conditions without weakening semantic gates.
