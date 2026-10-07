# Validator v3 — A1 evaluation infrastructure

A1 only, isolated branch `codex/validator-v3-a1`, baseline `d21798db6212553e63420a8efd6e1f71c87417d9`. Production does not import this directory. No corpus, holdout labels, feed probe, classifier, ranking or UI change is included. B/A2 and later stages remain separate authorizations.

Planning inputs read from the untouched original checkout (not adopted into this worktree):

| Document | SHA-256 |
| --- | --- |
| VALIDATOR_V3_SPEC.md | 2b87a8684d1cd89c18e37f146f9d2f0f3e77d0bf8ea0018ff31a031a81875e6c |
| EVALUATION_SCHEMA.md | 7ab52caba607246d948e0dec9be1b78b2429299231930df1e0d91eb20df55d66 |
| WORK_PACKAGES.md | c116c19682cf0d0c576653b6163f8c9776453784103419904584f6e564515820 |

Owner amendments govern: UPSC only; allow systemic global IR/Security/Economy/governance without a literal India mention; metadata sufficiency is measurable; bootstrap data can be smaller/shorter than six weeks; future holdout stays untouched; all PYQ and production work remains isolated.

## Artifact boundaries

| Module/artifact | Responsibility |
| --- | --- |
| `schema.json`, `contracts.ts`, `validate.ts` | Closed draft-07 gold/metadata/observation/run schema, semantic contradictions, two independent reviews, final/adjudication equality, provenance/hash/span/timestamp integrity. |
| `raw-schema.json`, `collect.ts`, `xml.ts` | Standalone pre-acceptance/pre-dedup raw metadata capture, fixed current registry and per-shard limits, RSS/Atom categories/bylines only when present, source health and normalization losses. |
| `rubric.md`, `gates.proposed.json` | Blind human rubric and explicitly unapproved quantitative proposals; no gate is silently accepted by point estimates. |
| `sample.ts` | Unique-URL priority cells over observable metadata, seeded hash draws, inclusion probability/population denominator, immutable manifest commitment, blind annotation exports. |
| `split.ts` | Conservative metadata duplicate hints plus supplied semantic identities, whole connected-group bootstrap split, frozen partition manifest, unseen/forward checks. |
| `replay.ts` | Pure runner interface with explicit clock/history and policy/index/registry/code commitments, sorted/frozen metadata inputs, replay/sequence checks, separate operational benchmark helper. |
| `metrics.ts`, `evaluate.ts`, `report.ts` | Four distinct losses, reviewed-only and panel-separated metrics, seeded grouped intervals, subject abstention/confusion, events, needs/angles, output coverage, metadata ceiling, acquisition inventory, source funnel, immutable JSON/Markdown reports. |
| `judgment-schema.json`, `judgments.ts` | Independent event/analysis/anchor pair and sequence truth; cannot-link and clock-bound sequence evaluation. |
| `cli.ts`, `evaluation.test.ts` | Narrow offline tooling and synthetic in-memory contract tests; no natural/holdout records or labels created. |

JSON and JSONL arrays are accepted for record/observation inputs. The raw artifact is one shard object with nested sources/observations, not a deduplicated snapshot. To build the observation array, flatten `captures.flatMap(c => c.sources.flatMap(s => s.observations))` after `validateRaw`, preserve every source and capture, and retain raw health objects alongside it. Repeated polls do not increase article population weight. No stale source substitution exists in the collector.

`data/`, `.runs/` and `.cache/` below this directory are ignored, local, exclusive-write artifact roots. No actual data is checked in. The raw XML response exists only in memory while parsing; `content:encoded`, Atom content, bodies, cookies, credentials, reader text and generated summaries cannot become observation/gold fields. Description is the application's bounded excerpt (600 chars); title 400; categories 30 × 160; bylines 20 × 160; <=200 normalized entries/feed. Captures retain `httpStatus`, fixed failure codes, pre-normalization count, invalid/truncated entries, publisher timestamps, parser/version/hash and every membership through observation references. Bound metadata excerpts are not complete articles.

The collector uses the unchanged registry, <=6 concurrent feeds/shard, independent 15s shard budget, 10s/feed, 4MiB XML and existing URL/text normalization. Requests omit credentials, reject redirects and perform no article fetches. Malformed/failed sources are separate from empty success and from nonempty feeds whose entries all fail normalization. Only `collect-shard` accesses the network; it has not been invoked on live feeds for A1.

## Bootstrap workflow

1. B supplies verified discovery/metadata findings without changing this contract silently. A2 freezes source/parser/index/code hashes, capture slots, namespace, neutral sampling cells and seed before collection/tuning. Raw artifacts are immutable; a changed registry/parser starts a new generation. The current allowlist validator is pinned to this repository generation, so future B must supply an explicit archived-registry validation adapter rather than relabel older sources.
2. Capture shards independently, keeping health and real capture times. Sample unique URLs through priority cells. First matching cell is the sole panel/stratum; overlapping capture/source observations remain references. `captureDays` means first observed UTC day for the article, not publisher date or subject. A probability estimate is conditional on the declared observable cell population. Representative weights are `1 / inclusionProbability`; coverage enrichment and synthetic stress results remain separate.
3. `leakageIdentities` adds exact normalized title/description and conservative trigram-Jaccard (>=0.8) grouping hints. Supply audited aliases, syndicated/near-paraphrase families, developments, angles and themes. Lexical similarity does **not** certify semantic separation. Whole connected families stay together, even when this misses the 75/25 size target; achieved counts are available in the manifest. The lexical audit is bounded to 5000 URLs and 2 million candidates; larger inputs must be audited in explicit batches with family closure reconciled globally.
4. `splitBootstrap` assigns development/validation only. No six-week prerequisite, minimum corpus size, final labels or fabricated natural examples. Use `annotationExport` with empty truth fields for separate independent reviewers and pass the frozen partition manifest as its optional third argument (or fourth CLI positional argument after output). Without it, initial partition is provisional `development`; apply the frozen manifest's partition by URL before corpus evaluation. Split assignment changes neither metadata nor human labels. Later changes to adjudicated labels are new correction artifacts with rationale/version, never overwrites.
5. Evaluate only after `validateCorpus`, manifest integrity and semantic family reconciliation pass. A2 owns independent labels, their freeze, complete replay candidate judgements and the frozen v2 prediction adapter. The runner API supports v2/v3 on identical metadata/clocks but A1 does not run or tune either classifier. Use `legacy_regression` for old fixtures; never map old borderline labels to negatives.

`article:` IDs are full SHA-256 of `[capture namespace, canonical URL]`. `obs:` IDs are full SHA-256 of `[captureId, sourceId, ordinal, capturedAt, registryHash, parserVersion, metadataHash]`; ordinal is retained-entry position within that source capture. A duplicated ID fails closed; collision resolution requires a new documented namespace, never overwrite. Revisions share one gold article with multiple observation references. Gold metadata must equal one actual revision, never joined/invented prose. Memberships of other observations are retained via references. Keep the application's canonical URL logic; additional aliases must be audited inputs.

Sample manifest hashing uses a 64-zero sentinel for each entry's self-referencing `sampling.manifestHash`, then fills it with the commitment. Rebuilding from the plan and exact observations verifies the artifact. Partition manifests hash canonical assignments plus seed/freeze/sealing state and identity commitment; no label values or model outputs appear there.

## Sealed holdout protocol

Holdout truth lives outside the implementation checkout and agent-readable artifact roots, under an independent custodian. `validateGold`, `validateCorpus`, annotation/judgment APIs and evaluation deny holdout truth by default; the CLI cannot unlock it. `access: 'custodian'` is an explicit API for a separate independently authorized invocation, not cryptographic access control or authorization granted to this job.

Release manifests may commit sealed identities without labels. Both future holdouts start strictly after candidate freeze. `holdout_unseen` cannot share URLs/revisions, aliases, syndication, near-paraphrases, events, angles or themes with development/validation. `holdout_forward` may share a continuing theme with exactly one earlier training partition when all its observations are later; it cannot share URLs/revisions/events/angles/duplicate families. Developer/validation observations must end by freeze. Unseen/forward results are separate. Future metadata or labels never enter an earlier run. Inspecting the final holdout spends it for subsequent tuning; A3 must preserve any failure and use a new future window for another candidate.

## Replay and evaluation

`replay({observations, history, clock, versions}, runner)` passes only validated metadata. `versions` commits policy ID/hash, index/registry/code hashes. A2 supplies the actual frozen runner and configuration/index matching those hashes, loaded independently of human gold; A1 cannot prove the runner's hashes are honest. Runner must be synchronous, deterministic and free of clock/storage/network side effects. Policy content is runner-owned and committed, not chosen by this harness. A runtime observation's capture, publication and update times must not exceed clock. Sequence replay chooses currently available observations and earlier history explicitly; undated fields remain null. Different metadata revisions are never replaced by future revisions. Source health is optional evaluation-only context, not fabricated zero supply.

Each evaluation uses cutoff-scoped gold references and actual metadata revisions available at that clock. Do not pass a full longitudinal gold artifact containing future observation references to an earlier run. Later same-URL material updates require separately frozen cutoff-specific review/sequence artifacts; earlier truth is not rewritten. Partition ranges must contain the actual observation history rather than trusting declared dates alone.

Resolved positives are `must_read`/`useful`; only `reject` is negative. Unresolved final labels do not participate in confusion counts. A missing prediction or deferral on a resolved positive is a miss, shown separately. Known positive subject truth is scored regardless of acceptance; subject abstention is incorrect, unresolved human primary is separately excluded, and conditional/selective accuracy is reported alongside full accuracy. Empty denominators yield null with `undefined_zero_denominator`. Synthetic/legacy diagnostics are excluded from natural precision/recall.

The report preserves acquisition, acceptance, representation and selection independently. Acquisition recall needs a bounded independently reviewed publisher-listing inventory (`CoverageReference`); absent inventory is pending. Metadata sufficiency is independent of value; unresolved reviewers' sufficiency assessments are provisional counts, never negative final labels. Source failures/empty/loss counts remain visible when `rawCaptures` are supplied. Event pair metrics, B-cubed, cannot-links, sequence needs, anchor preference, diversity regret and operational benchmarking are reusable utilities for later jobs, not a v3 policy implementation.

Reading-need key is angle first, then development, then article when neither identity is established. Another report on the theme cannot cover a distinct angle. Top-level and expanded recall differ. Duplicate top-level exposure retains unjudged-unit counts; nDCG uses preregistered linear ordinal gains 3/1/0 and gives repeated equivalent reading needs zero additional utility. Unjudged top-K output keeps the full denominator and precision bounds; its measured precision/nDCG remains pending. Small bootstrap metrics are conditional diagnostics, not release claims. Unweighted Wilson intervals are descriptive; weighted estimates use seeded theme/day group bootstrap. Fewer than two groups has no grouped interval. Macro-F1 reports the number of defined subjects; absent support is not perfect accuracy. Future A3 must approve sample support/interval interpretation rather than turning a tiny point estimate into a passed gate.

## Commands

Run from this isolated worktree; paths below are positional. Artifact outputs must be inside the ignored roots and cannot overwrite existing files.

```text
npm run test:evaluation
npm run news:evaluation -- validate GOLD.json OBSERVATIONS.json
npm run news:evaluation -- validate-raw CAPTURE.json
npm run news:evaluation -- sample OBSERVATIONS.json PLAN.json tools/news/evaluation/data/sample.json
npm run news:evaluation -- annotate SAMPLE.json OBSERVATIONS.json tools/news/evaluation/data/blind.json
npm run news:evaluation -- identities OBSERVATIONS.json DECLARED_IDENTITIES.json tools/news/evaluation/data/leakage-hints.json
npm run news:evaluation -- split IDENTITIES_ARRAY.json SEED tools/news/evaluation/data/partitions.json
npm run news:evaluation -- validate-partitions PARTITIONS.json
npm run news:evaluation -- evaluate GOLD.json RUN.json CONTEXT.json tools/news/evaluation/.runs/report.json
```

`CONTEXT.json` contains current `observations`, earlier `history`, frozen `partitions`, selected `partition`, `bootstrapSeed`, optional `rawCaptures`/independent `coverageInventory`. Network capture, only when A2 is authorized: `npm run news:evaluation -- collect-shard SHARD CAPTURE_NAMESPACE tools/news/evaluation/data/capture.json`. Do not invoke the old deduplicated snapshot as the raw frame. Replay is a library API accepting the frozen runner; no arbitrary runner file is executed by the CLI.

## B/A2 handoff and limitations

B consumes raw metadata/provenance, health, versioned manifests, bounded byline/category contracts and acquisition/metadata diagnostics. B owns feed verification, curated-author authenticity and optional production metadata adapters; no such privilege is inferred here. A2 consumes the rubric/proposed gates, observation/sample/partition schemas, blind exports, duplicate hints plus required family audit, independent review workflow, runner API and per-stage report. A2 must supply/verify pinned configuration and v2 adapter, human adjudication and full candidate/sequence/pair/anchor truth; no quality result exists without them.

Owner approval remains pending for reviewer/custodian assignment, rubric/schema choices and proposed release thresholds/sample support. Cryptographic digests identify artifacts but do not authenticate reviewers. Lexical grouping cannot prove all semantic leakage absent. Registry-generation evolution, live publisher/feed access, authenticated production, physical devices and final corpus release evidence are outside A1. See `VERIFICATION.md` for exact local checks and skips. Do not start B, collect the gold corpus, unlock holdouts, commit, push, merge or deploy as part of this handoff.
