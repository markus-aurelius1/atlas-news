# Stage C rule and evidence specification

Status: isolated development implementation. No production import or integration. Parent: `349c86c4a57eaeb8f0d7f1928fdac61505e7479f`; branch: `codex/validator-v3-stage-c`.

## Authority and contradictions resolved before implementation

The committed `calibration-gold-v1/STAGE_C_REQUIREMENTS.md` is authoritative for this slice. The three architecture documents are untracked in the original dirty checkout and absent from the mandatory parent; they were read in place, without copying or modifying them. Their exact byte hashes are recorded in VERIFICATION.json.

- The architecture objective mentions UPSC/UPPCS; this request and Stage C override it with UPSC only. No UPPCS feature or optimization is implemented. The unchanged mixed-exam v2 index is hash-pinned for provenance only, never consulted for frequency or scoring.
- The older country policy foregrounds India impact and global science/environment. The committed requirements include `global_systemic`, global energy economics, nuclear security and strategic analysis. Stage C explicitly admits evidenced global systemic IR/Security/Economy mechanisms without an India keyword. A World section, country or international actor alone cannot establish them.
- Older work packages describe release gates and unresolved review blocking quality acceptance. The frozen owner-validated envelope permits development diagnostics, including separate owner-ID sensitivity; it cannot certify release or independent human agreement. All 47 resolved cases remain in denominators; three unresolvable cases are reported separately. The eight original validation IDs are exposed calibration, not unseen validation.
- The frozen README's prohibition on implementing C without authorization is superseded by the owner's explicit Stage C request. Frozen files themselves remain unchanged.
- Stage D/E/F paths and orchestration in the planning documents are future work. No subject selection, history, clustering, novelty, representative choice, ranking, diversity or production wiring is implemented here.

## Runtime boundary

`evaluateStageC` is a pure synchronous metadata evaluator. Its closed input contains observations, an explicit UTC clock and six pinned versions/hashes. No labels, predictions, gold IDs, annotations, sampling strata, article bodies, history, personal state, capacity or subjects are accepted. Bounded metadata preserves verbatim title/summary. URL is used for identity and author/source host binding; URL slugs never supply topical evidence. Categories never supply topical relevance. No network, LLM, storage or paid service is called.

The offline `runStageC` adapter uses A1 schema and identity/hash validation before evaluation, then returns an A1 article-only run plus a Stage C trace envelope. The A1 schema is unchanged: its five-field versions stay closed; the extra author hash is in the Stage C envelope and the author implementation is also bound into A1 codeHash. Pin hashes are calculated from bytes, never supplied by gold. The low-level pure evaluator checks structure, bounds, dates and registry consistency; cryptographic observation-ID/metadata-hash validation belongs to the A1 adapter.

Multiple observations of one URL are sorted by observation ID. No descriptions are joined into invented prose; topical and support evidence for each route must come from the same observation. Contradictory observed headline exclusions conservatively veto the URL. Decisions and traces are sorted deterministically. Clock gates reject future captures/publication/revisions, not merely future labels. No history is read.

## C1: hard eligibility and scope

The evidence extractor records topical mechanisms and hard-purpose patterns. C1 consumes that evidence, never C2 dimensions or a relevance score. The priority order is hard exclusion, supported scope, explicit insufficiency. Country names, authors, sources and unrelated syllabus words cannot override an exclusion.

Versioned hard reasons are `C1.ceremonial_low_value.v1`, `C1.promotion.v1`, `C1.entertainment.v1`, `C1.roundup.v1`, `C1.routine_business.v1`, `C1.routine_local.v1`, `C1.party_primary.v1` and `C1.foreign_domestic_no_impact.v1`. Each requires an observed span. Party-primary requires both a party actor and reaction/campaign purpose in the headline. Party mention alone adds zero relevance. Case-sensitive US and country/context evidence distinguish US from lower-case us; Congress alone is never a foreign-country anchor. CPI(M), CPI, UP and generic pipeline terms add no relevance.

A narrow explicit institutional actor/action/object proposition preceding the noise or party-purpose span establishes that the noise is incidental. For example a Supreme Court electoral-rule judgment preceding a Congress demand stays eligible; the reverse order stays rejected. This override is itself traced as `C1.dominant_institutional_action.v1` and requires a supported substantive route. Summary policy terms cannot rescue a party-primary headline.

Ordinary foreign-domestic purposes in the headline remain excluded even if they cite a global science or policy concept. Explicit India impact requires a connected trade, energy, supply-chain, security, diaspora or treaty-obligation mechanism; a bare India mention cannot bypass it. An explicit India institutional actor (for example India Supreme Court) retains domestic jurisdiction when foreign companies or actors are incidental; a bare India mention in foreign legislation does not. The independent country-context vocabulary follows the existing repository country vocabulary without importing v2 scores or exam features. A foreign campus/dateline alone is not a domestic-purpose veto. A scope unknown is an abstention, not a claim of irrelevance.

## C2: independent UPSC relevance and substance

The policy table in `src/current-affairs/validator-v3/policy.ts` is the exact versioned vocabulary and precedence contract. Overlapping topic tokens cannot count again as substance; only separate observed support spans qualify. Rules require both topical connection and support for an explanatory, institutional, developmental or analytical proposition in observed metadata. They cover institutional independence/electoral rights; public finance/distribution/lending/election finance; environmental restoration/climate findings; scientific findings; global energy/nuclear/strategic security; international agreements/world order/war consequences; technology governance/national capacity; and regulatory developments. A factual action is one route; a supported analysis is another. No threshold reduction, exam-frequency accumulation or author allowlist substitutes for either.

Each supported dimension is bounded: topical connection 0/2, substance 0/2, consequence 0/1, source context 0/1, verified author 0/1. There is no blended sum or acceptance cutoff. Source/author priors are reported only when topical substance already exists and cannot establish eligibility, acceptance or a must-read tier. Subject labels do not exist in the output.

`must_read_candidate` identifies a configured high-consequence mechanism, not a final badge or rank. Broad science discoveries, energy-market coverage and ordinary lending analysis remain useful unless separately supported by an exceptional configured route. Tier outputs are diagnostic policy judgments; must-read recall in the comparison means acceptance of owner must-reads, not agreement on candidate tiers.

## Authorship, confidence and evidence coverage

Source context requires exact Job B source, publisher, feed, section and article-host binding. Author context additionally requires an observed publisher-provided byline from the observation's source ID and Job B's curated aliases/host binding. Title names, co-author prose, spoofed hosts and unknown bylines receive no curated prior or penalty. Duplicate memberships cannot accumulate prior points.

Missing or short placeholder descriptions cannot negate sufficient title evidence. Summaries need at least five words and must not be known placeholders to contribute matching evidence. This is a conservative operational coverage rule, not semantic sufficiency certification. Exact topic and support matches are finite lexical approximations; they do not prove entailment or dominance for arbitrary language.

Coverage is independently reported as sufficient/limited/insufficient with missing fields and missing/placeholder/present summary state. Limited title-led positives can be accepted with moderate confidence. Opaque positive labels remain in evaluation as misses when deferred. A verified author or section cannot fill a missing thesis. The three unresolved owner cases defer, as do resolved positives #6/#34/#43. Acquisition work, if separately authorized, may recover permitted feed metadata; this implementation never fetches bodies or invents a summary.

## Evidence tracing and limitations

Every reason links to verbatim strings using observation ID, field, nested path and UTF-16 start/end offsets. Text is not normalized before matching, so offsets resolve exactly, including astral Unicode prefixes. Predictions carry separate eligibility, relevance, dimensions, confidence and coverage. Exact hashes bind code/policy/index/registry/authors/input/output; timing and heap samples are outside deterministic digests.

Finite patterns remain vulnerable to untested paraphrases, negation, unrelated clauses and ambiguous actor roles. Their vocabulary was developed with this enriched 50-item diagnostic set and synthetic adjacent controls; no generalization or release certification is claimed. The baseline source package and all original partitions, annotations, provenance, predictions and owner exemplars are preserved. No future holdout is discovered or read.

## Reproduction

From this worktree, using existing installed dependencies:

```powershell
node tools/news/evaluation/stage-c-report.mjs
node --test tools/news/evaluation/stage-c.test.mjs
npx vitest run src/current-affairs/validator-v3/stage-c.test.ts
```

The report command writes only the new `stage-c-v1` derived comparison, predictions, case analysis and operational evidence. Frozen input verification and exact original v2 prediction/trace replay run before output. Repeated and reversed Stage C replay must be byte-equivalent; operational samples vary by host/load. Broader verification commands and guarded skips are in VERIFICATION.md.
