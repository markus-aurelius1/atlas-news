# Frozen-v2 owner calibration error analysis

Owner calibration set — not statistical release evaluation

Resolved binary denominator 47/50; 3 unresolvable excluded. TP 14, FP 1, FN 17, TN 15. Descriptive precision 93.33%, recall 45.16%, F1 60.87%. Must-read retained 11/17 (64.71%); misses 6. Exact-primary correct on ALL positives 13/31 (41.94%), including rejected positives.

- Enriched 50-item owner calibration; descriptive counts only, no statistical release estimates or confidence intervals.
- Model-origin annotations owner-validated, not independent human authorship or inter-rater agreement.
- Original development/validation assignments retained; these 50 are now exposed calibration material, including 8 validation records.
- Novelty uncertain/null is not duplicate, newness or analysis-angle gold; no E/F metrics.
- Publisher/description associations are confounded by deliberate selection and cannot establish causality.
- Unresolvable rows are excluded from binary and subject metrics.
- No absent-from-corpus acquisition recall denominator is available.

## Error matrix

| Outcome | Cases |
| --- | --- |
| FP | #22 |
| FN | #5, #6, #8, #9, #11, #12, #13, #17, #21, #27, #28, #30, #34, #35, #39, #43, #50 |
| TP | #2, #7, #10, #19, #24, #26, #29, #31, #32, #37, #42, #44, #46, #47 |
| TN | #1, #4, #14, #15, #16, #18, #20, #25, #33, #38, #40, #41, #45, #48, #49 |
| excluded_unresolvable | #3, #23, #36 |

## Provenance sensitivity

model_origin_owner_validated: 3 total, 1 unresolvable; resolved n=2, TP=1, FP=0, FN=0, TN=1; precision 100.00%, recall 100.00%.
owner_id: 47 total, 2 unresolvable; resolved n=45, TP=13, FP=1, FN=17, TN=14; precision 92.86%, recall 43.33%.

Requested-author census: 4/8 retained; 4 missed. All eight have missing descriptions. This demonstrates captured-metadata acceptance losses, not missing acquisition.

## Subject and content patterns

Subject classification remains Stage D. The confusion matrix and all primary mismatches are in comparison.json; rejection is not treated as a subject abstention. V2 does not predict content type, so the content-type table measures acceptance by owner type, not content-type accuracy.

## Publisher

| Slice | n | TP | FP | FN | TN | Precision | Recall |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Al Jazeera | 1 | 0 | 0 | 0 | 1 | undefined | undefined |
| BBC | 2 | 0 | 0 | 2 | 0 | undefined | 0.00% |
| Business Standard | 1 | 1 | 0 | 0 | 0 | 100.00% | 100.00% |
| BusinessLine | 1 | 0 | 0 | 1 | 0 | undefined | 0.00% |
| Financial Times | 1 | 0 | 0 | 0 | 1 | undefined | undefined |
| Frontline | 1 | 0 | 0 | 1 | 0 | undefined | 0.00% |
| Gentle Leviathan | 1 | 0 | 0 | 1 | 0 | undefined | 0.00% |
| Guardian | 1 | 0 | 0 | 0 | 1 | undefined | undefined |
| Hindustan Times | 1 | 0 | 0 | 0 | 1 | undefined | undefined |
| India Today | 1 | 0 | 1 | 0 | 0 | 0.00% | undefined |
| India: Politics, Power & Public Discourse | 1 | 0 | 0 | 1 | 0 | undefined | 0.00% |
| Indian Express | 16 | 9 | 0 | 6 | 1 | 100.00% | 60.00% |
| Mint | 1 | 1 | 0 | 0 | 0 | 100.00% | 100.00% |
| NDTV | 1 | 0 | 0 | 0 | 1 | undefined | undefined |
| New York Times | 3 | 0 | 0 | 1 | 2 | undefined | 0.00% |
| Northeast Now | 1 | 0 | 0 | 0 | 1 | undefined | undefined |
| Political Economy, Stats, and Society | 1 | 0 | 0 | 0 | 1 | undefined | undefined |
| Politico Europe | 1 | 0 | 0 | 0 | 1 | undefined | undefined |
| Scroll.in | 1 | 0 | 0 | 0 | 1 | undefined | undefined |
| South China Morning Post | 1 | 0 | 0 | 0 | 1 | undefined | undefined |
| The Economist | 1 | 0 | 0 | 1 | 0 | undefined | 0.00% |
| The Hindu | 5 | 2 | 0 | 2 | 1 | 100.00% | 50.00% |
| The Quantified India | 1 | 0 | 0 | 1 | 0 | undefined | 0.00% |
| The Tribune | 1 | 1 | 0 | 0 | 0 | 100.00% | 100.00% |
| Times of India | 1 | 0 | 0 | 0 | 1 | undefined | undefined |

## Content type

| Slice | n | TP | FP | FN | TN | Precision | Recall |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| analysis | 9 | 0 | 0 | 7 | 2 | undefined | 0.00% |
| column | 7 | 3 | 0 | 4 | 0 | 100.00% | 42.86% |
| digest | 1 | 0 | 0 | 0 | 1 | undefined | undefined |
| editorial | 2 | 1 | 0 | 1 | 0 | 100.00% | 50.00% |
| explainer | 11 | 6 | 0 | 3 | 2 | 100.00% | 66.67% |
| news_report | 15 | 4 | 1 | 2 | 8 | 80.00% | 66.67% |
| other | 2 | 0 | 0 | 0 | 2 | undefined | undefined |

## Gold primary

| Slice | n | TP | FP | FN | TN | Precision | Recall |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Economy | 10 | 1 | 0 | 7 | 2 | 100.00% | 12.50% |
| Environment | 3 | 0 | 0 | 1 | 2 | undefined | 0.00% |
| Governance | 2 | 1 | 0 | 0 | 1 | 100.00% | 100.00% |
| International relations | 9 | 4 | 1 | 3 | 1 | 80.00% | 57.14% |
| Polity | 8 | 3 | 0 | 2 | 3 | 100.00% | 60.00% |
| Sci-Tech | 6 | 3 | 0 | 3 | 0 | 100.00% | 50.00% |
| Security | 3 | 2 | 0 | 1 | 0 | 100.00% | 66.67% |
| not_applicable | 6 | 0 | 0 | 0 | 6 | undefined | undefined |

## Metadata description

| Slice | n | TP | FP | FN | TN | Precision | Recall |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| missing | 20 | 10 | 0 | 7 | 3 | 100.00% | 58.82% |
| present | 27 | 4 | 1 | 10 | 12 | 80.00% | 28.57% |

## Captured author

| Slice | n | TP | FP | FN | TN | Precision | Recall |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| (missing) | 23 | 8 | 1 | 8 | 6 | 88.89% | 50.00% |
| ANI | 1 | 1 | 0 | 0 | 0 | 100.00% | 100.00% |
| Aastha Jha | 1 | 0 | 0 | 0 | 1 | undefined | undefined |
| Alice Yan | 1 | 0 | 0 | 0 | 1 | undefined | undefined |
| Apurva Kumar | 1 | 0 | 0 | 1 | 0 | undefined | 0.00% |
| Brad Plumer | 1 | 0 | 0 | 0 | 1 | undefined | undefined |
| C. Raja Mohan | 5 | 3 | 0 | 2 | 0 | 100.00% | 60.00% |
| Jack Nicas | 1 | 0 | 0 | 0 | 1 | undefined | undefined |
| Joanna Ruck | 1 | 0 | 0 | 0 | 1 | undefined | undefined |
| Kate Cantrell, The Conversation | 1 | 0 | 0 | 0 | 1 | undefined | undefined |
| NE NOW NEWS | 1 | 0 | 0 | 0 | 1 | undefined | undefined |
| Pratap Bhanu Mehta | 3 | 1 | 0 | 2 | 0 | 100.00% | 33.33% |
| Raveena Baneta | 1 | 0 | 0 | 1 | 0 | undefined | 0.00% |
| Rebecca F. Elliott | 1 | 0 | 0 | 1 | 0 | undefined | 0.00% |
| Ruchi Gupta | 1 | 0 | 0 | 1 | 0 | undefined | 0.00% |
| Sam Blewett | 1 | 0 | 0 | 0 | 1 | undefined | undefined |
| Soumyarendra Barik | 1 | 1 | 0 | 0 | 0 | 100.00% | 100.00% |
| Tibor Rutar | 1 | 0 | 0 | 0 | 1 | undefined | undefined |
| venkat | 1 | 0 | 0 | 1 | 0 | undefined | 0.00% |

## Scope

| Slice | n | TP | FP | FN | TN | Precision | Recall |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| foreign_domestic_no_impact | 11 | 0 | 0 | 0 | 11 | undefined | undefined |
| global_knowledge | 6 | 1 | 0 | 4 | 1 | 100.00% | 20.00% |
| global_systemic | 10 | 5 | 0 | 5 | 0 | 100.00% | 50.00% |
| india_domestic | 18 | 7 | 1 | 7 | 3 | 87.50% | 50.00% |
| india_impact | 2 | 1 | 0 | 1 | 0 | 100.00% | 50.00% |

## Party primary

| Slice | n | TP | FP | FN | TN | Precision | Recall |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| false | 41 | 14 | 1 | 17 | 9 | 93.33% | 45.16% |
| true | 6 | 0 | 0 | 0 | 6 | undefined | undefined |

## Original partition

| Slice | n | TP | FP | FN | TN | Precision | Recall |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| development | 40 | 14 | 1 | 13 | 12 | 93.33% | 51.85% |
| validation | 7 | 0 | 0 | 4 | 3 | undefined | 0.00% |

## Original panel

| Slice | n | TP | FP | FN | TN | Precision | Recall |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| coverage | 22 | 11 | 0 | 8 | 3 | 100.00% | 57.89% |
| representative | 25 | 3 | 1 | 9 | 12 | 75.00% | 25.00% |

## Interpretation and ownership

The sole false positive (#22) is a memorial-corridor opening: bilateral names and an India link supply evidence but the owner identifies ceremonial value. Stage C should gate ceremonial events without suppressing material India-Japan agreements. Party-primary and foreign-domestic rejects currently pass as negative controls; avoid undoing them while recovering positives.

False negatives include threshold losses with detected concepts, absent lexical coverage, and a substance gate that requires a factual action even for valuable institutional criticism (#21). The eight requested-author cases are all present with legitimate bylines; missing discovery is not demonstrated here. Their acceptance failures concern captured content and analysis framing, compounded by missing summaries. Authorship is contextual evidence and cannot justify unconditional acceptance.

All 22 empty-description cases are separately tabulated, as are the 28 nonempty descriptions. Nonempty does not mean useful: #3 has a two-word summary. The three unresolvable cases (#3, #23, #36) need acquisition/metadata evidence or explicit abstention, not forced Stage C labels. For resolved sparse cases, title/section/byline may support bounded qualification; opaque rhetoric still limits what can be concluded about the argument. No body fetching or fabricated summary is warranted.

Publisher counts describe this selected set, not publisher quality. Indian Express and The Hindu include deliberately enriched opinion, explainer and missing-summary slices. Other-source losses include oil-market analysis, newsletter economics, palaeontology and behavioural economics. Prefer independent value evidence; do not compensate using publisher quotas.

Science losses #35/#39 and river-rejuvenation #5 demonstrate global-knowledge and environmental-method relevance without country-name prestige. Subject errors (AI law enforcement, R&D ecosystem, diplomacy/climate and mining/federalism) belong to D. Repeated oil, enrichment and fossil stories remain article-level observations: no equivalence, novelty or saturation conclusion is licensed by these labels.

See stage-c-requirements.json and STAGE_C_REQUIREMENTS.md for bounded, prioritized acceptance/regression work. No Stage C/D/E/F logic was implemented.
