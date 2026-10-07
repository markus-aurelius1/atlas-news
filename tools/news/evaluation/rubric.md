# Human annotation rubric — tars-upsc-rubric/v1

Status: A1 contract, owner review pending before labelling/tuning. UPSC only. Do not add UPPCS objectives, state-specific weighting, protection or quotas. `global_systemic` is an owner amendment.

Review only captured, bounded RSS/Atom title, description, categories, byline, source memberships and publisher timestamps. No article body or reader text. A permitted manual check of publisher listing metadata belongs in the separate acquisition inventory, never runtime gold. Do not fetch articles to resolve sparse metadata.

## Independent review

Annotators receive `annotationExport` output: actual metadata, observation IDs, observable sampling provenance, empty truth fields. No validator acceptance, score, predicted subject, ranking, suggested answer, author privilege or other reviewer annotations. The custodian delivers separate copies to each reviewer. Keep the copies append-only. Supply at least one observed evidence span before labels; offsets are UTF-16 indices into title/description, categories joined by newline, or byline names joined by newline. Never cite unseen bodies. The adjudicator combines both independent annotations, preserves them verbatim, records rationale/version and writes the final labels separately. The harness requires two distinct reviewer IDs; identity checks cannot prove human independence.

`unreviewed`: no annotations. `in_review`: incomplete independent review. `disputed`: unresolved disagreement. `adjudicated`: two reviews, complete final value and required flags, rationale and evidence. `unresolvable`: human review cannot establish a value from available metadata. Every non-adjudicated record has an entirely null/empty final gold object and no adjudication. Null means unknown. It is never a rejection. Review-completion counts include every disposition.

## Value, purpose and scope

| Value | Decision |
| --- | --- |
| `must_read` | Exceptional UPSC consequence or explanatory insight, tied to a syllabus mechanism. Source, author, feed branding and publisher count cannot establish it. |
| `useful` | Substantive, syllabus-relevant reading worth retaining. A useful repeat remains useful at article level. |
| `reject` | Fails scope or substance; identify at least one reject reason. Unclear metadata stays unresolvable rather than being forced here. |

Party-politics-primary means campaign/candidate/alliance arithmetic, personality, party strategy, horse race, accusation or partisan reaction is the main purpose. It requires `reject`/`party_primary`. Record incidental party mention separately; a party litigant does not turn a constitutional ruling into party news. Reject ordinary noise, promotions, entertainment and routine local matters without substantive syllabus value. Record content type independently: news report, explainer, editorial, column, analysis, digest, interview, official release, other or unknown.

| Scope | Required mechanism |
| --- | --- |
| `india_domestic` | Substantive Indian institutional/policy/knowledge development. State origin alone does not confer value. |
| `india_impact` | Metadata establishes an Indian impact mechanism, such as trade, energy, borders, diaspora, treaty obligations or supply chains. |
| `global_knowledge` | Transferable scientific/environmental finding or explanatory knowledge; foreign attribution alone neither admits nor rejects. |
| `global_systemic` | Genuinely systemic global IR/Security/Economy/governance development with a stated mechanism of wider consequence. A literal India mention is unnecessary. A World feed, foreign election, bilateral negotiation or country name is insufficient. |
| `foreign_domestic_no_impact` | Ordinary country-specific foreign domestic matter without a wider mechanism. Requires `reject` and matching reason. |
| `unknown` | Metadata cannot establish scope. Explain uncertainty; never infer an India impact. |

## Subject and identities

Assign dominant primary subject from issue/action/object and explanatory framing: Polity, Governance, Economy, International relations, Security, Sci-Tech, Environment, Geography, History & Culture. Section/category is supporting context, not truth. NASA can frame science, diplomacy or personnel politics; Hormuz can frame Geography, Security, IR or Economy. The place anchor and author are not subject votes. Use null for genuinely unresolved primary; `not_applicable` is only for a non-positive with no applicable primary. Secondary labels are independently supported and never replace exact primary.

Identify one material development (`storyId`), running theme (`themeId`), and separately valuable explanation (`angleId`) when established. IDs are reviewer/custodian-assigned opaque strings, shared across genuine equivalents. Same institution or author is not the same event or angle. Keep separate counterpart negotiations, cases, draft/enactment, reporting periods, new findings and substantive analytical distinctions. Valuable analyses discussing one theme can have separate angles and reading needs.

Novelty is judged at an explicit `cutoff` against `relativeTo` observation IDs, not timelessly. `repeat` requires earlier observed metadata and no new material delta. `new_development` requires a story ID and supported material delta; `distinct_analysis` requires an angle ID and supported distinction. Delta has observed spans and a short reviewer description. Updated timestamp or rephrasing alone is not material. `uncertain` and `not_applicable` remain explicit. No future observation/revision or personal Read/Saved history may support novelty.

## Metadata sufficiency is separate from value

`sufficient`: metadata supports purpose, scope, primary/identity as required; no missing fields. `limited`: some judgement is possible but an important field/frame is missing; name it. `insufficient`: runtime cannot resolve the material issue from metadata; name at least one missing field. Distinguish missing description/byline/category/publication time from missing scope/development/angle evidence. Do not reject because a summary is short or infer quality from length. A resolved positive with limited/insufficient metadata remains a positive and runtime deferral counts as a miss. If even human value cannot be resolved, use `unresolvable` with independent annotations retaining sufficiency assessment and null final gold.

The report stratifies resolved positives by sufficiency and names missing fields. This quantifies the metadata ceiling without promising that every sufficient item is recoverable. Acquisition absence is measured only against an independently bounded listing inventory. Failed feeds differ from successful empty feeds and from entries lost during normalization.

## Pair, anchor and daily sequence review

Use `judgment-schema.json` for event pairs (same/related-distinct/unrelated/uncertain), analytical pairs (equivalent/complementary/redundant/uncertain), quality anchor pairs (comparable/left-better/right-better/uncertain), and clock-bound sequence reading needs. Review substance with publisher identity masked first where practical. Apply TH/IE preference only among comparable coverage after quality judgement; source preference does not create relevance. Cannot-link evidence is explicit, not a guessed negative.

For sequence needs name permissible qualifying URLs, novelty and must-read status at the cutoff. Another report on the theme cannot cover a distinct angle. Repeat units are measured as exposure separately from article value. Uncertain pair/sequence truth is excluded with its unresolved denominator reported. No synthetic test or existing regression fixture becomes natural gold.

## Decisions still requiring the owner

Assign two human reviewers and an independent holdout custodian. Approve this rubric/schema vocabulary, the proposed gates and release sample support before tuning; proposed values are in `gates.proposed.json`. Decide corrections/version procedure and the later seven-day/14-day temporal policy with labelled sequences. None is required to complete the A1 infrastructure or a smaller bootstrap development corpus. No holdout labels are available to implementation jobs.


## A2a curated reading contract (owner amendment)

Today is a curated UPSC reading list with a maximum of 50 visible reading units, never a fill target. Prioritize Precision@20/50, must-read and unique development/reading-need coverage, distinct-analysis preservation, near-zero equivalent/repeat exposure, and quality lost to capacity. Do not optimize P@100. A short high-quality list is valid.

Equivalent reports of a material development contribute one representative reading unit. Compare substantive completeness, explanatory usefulness and direct relevance first. The Hindu and Indian Express have equal publisher preference when quality is comparable. Established verified core publishers are normal trusted candidates; secondary/specialist sources need unique coverage, high substantive confidence or material superiority. Tribune has no ban/quota; comparable core coverage normally wins, and repetition/volume adds no relevance. Publisher reputation never rescues weak material. Recency is a late tiebreaker.

Distinguish same development, related material new development, equivalent report, distinct valuable analysis and redundant analysis. Separate analytical reading needs require materially distinct reasoning, explanation or policy value supported by observable evidence; publisher, author or opinion branding alone is insufficient. An issue-oriented, substantive, revision-worthy editorial standard guides interpretation, without keyword gold or author prestige. Owner positives are held separately by the custodian; no exemplar matches or expected answers are shown in this blind package.

Assess repeated development against actual earlier observations. Approximately 14 days of metadata history and strongest comparison against 7 preceding days are configurable downstream assumptions, not a cooldown. Publisher, wording, headline, timestamp or elapsed time cannot by itself make a development fresh. A consequential new action/order/data/finding/implementation/consequence may be a material delta even inside a recently represented theme. A routine reaction, procedural update, recap or paraphrase is not automatically a material delta. If metadata cannot resolve this, mark limited/insufficient and specify the missing fields.

Keep rejected, qualified duplicate internal-only, qualified unselected internal-only and editorially selected reading units distinct. Archive means the curated history of selected meaningful developments/analyses, not classifier positives or leftovers. A better representative may replace an earlier article for the same development/reading need while preserving both URLs; a new development requires a new identity. Pair and temporal judgments require authentic human evidence and may remain unresolved.

One primary human can adjudicate this bootstrap development/validation corpus under the explicit bootstrap_primary_human policy. Independent second review is required later for the final holdout, protected/must-read slices, disagreements and random overlap. No agent is an independent human reviewer. All initial substantive labels remain blank.
