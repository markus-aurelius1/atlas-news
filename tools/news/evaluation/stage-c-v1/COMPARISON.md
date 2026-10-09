# Stage C versus frozen v2

Owner calibration set — not statistical release evaluation

| Measure | Frozen v2 | Stage C |
| --- | ---: | ---: |
| TP / FP / FN / TN | 14 / 1 / 17 / 15 | 28 / 0 / 3 / 16 |
| Precision | 14/15 (93.33%) | 28/28 (100.00%) |
| Recall | 14/31 (45.16%) | 28/31 (90.32%) |
| Must-read acceptance | 11/17 | 16/17 |
| Unresolvable excluded | 3 | 3 |
| Resolved abstentions (counted as misses) | 0 | 3 |

Recovered baseline misses: #5, #8, #9, #11, #12, #13, #17, #21, #27, #28, #30, #35, #39, #50. Remaining false negatives: #6, #34, #43. Introduced false positives: none.

## Protected slices

| Slice | Resolved / total | TP | FP | FN | TN | Positive retention | Abstentions |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| requestedAuthors | 8/8 | 6 | 0 | 2 | 0 | 6/8 | 2 |
| editorials | 2/3 | 2 | 0 | 0 | 0 | 2/2 | 1 |
| columns | 7/8 | 5 | 0 | 2 | 0 | 5/7 | 3 |
| analysis | 9/10 | 6 | 0 | 1 | 2 | 6/7 | 2 |
| explained | 11/11 | 9 | 0 | 0 | 2 | 9/9 | 0 |
| Science | 6/6 | 6 | 0 | 0 | 0 | 6/6 | 0 |
| IR | 9/9 | 5 | 0 | 2 | 2 | 5/7 | 2 |
| Security | 3/3 | 3 | 0 | 0 | 0 | 3/3 | 0 |
| institutional | 10/10 | 6 | 0 | 0 | 4 | 6/6 | 0 |
| UPSCFeed | 4/4 | 4 | 0 | 0 | 0 | 4/4 | 0 |

## Must read / Useful / Reject

| Slice | Resolved / total | TP | FP | FN | TN | Positive retention | Abstentions |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| must_read | 17/17 | 16 | 0 | 1 | 0 | 16/17 | 1 |
| reject | 16/16 | 0 | 0 | 0 | 16 | 0/0 | 0 |
| unresolvable | 0/3 | 0 | 0 | 0 | 0 | 0/0 | 3 |
| useful | 14/14 | 12 | 0 | 2 | 0 | 12/14 | 2 |

## Authorship sensitivity

| Slice | Resolved / total | TP | FP | FN | TN | Positive retention | Abstentions |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| model_origin_owner_validated | 2/3 | 1 | 0 | 0 | 1 | 1/1 | 1 |
| owner_id | 45/47 | 27 | 0 | 3 | 15 | 27/30 | 5 |

## Publisher

| Slice | Resolved / total | TP | FP | FN | TN | Positive retention | Abstentions |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Al Jazeera | 1/1 | 0 | 0 | 0 | 1 | 0/0 | 0 |
| Anticipating the Unintended | 0/1 | 0 | 0 | 0 | 0 | 0/0 | 1 |
| BBC | 2/2 | 2 | 0 | 0 | 0 | 2/2 | 0 |
| Business Standard | 1/1 | 1 | 0 | 0 | 0 | 1/1 | 0 |
| BusinessLine | 1/1 | 1 | 0 | 0 | 0 | 1/1 | 0 |
| Financial Times | 1/1 | 0 | 0 | 0 | 1 | 0/0 | 0 |
| Frontline | 1/1 | 0 | 0 | 1 | 0 | 0/1 | 1 |
| Gentle Leviathan | 1/1 | 1 | 0 | 0 | 0 | 1/1 | 0 |
| Guardian | 1/1 | 0 | 0 | 0 | 1 | 0/0 | 0 |
| Hindustan Times | 1/1 | 0 | 0 | 0 | 1 | 0/0 | 0 |
| India Today | 1/1 | 0 | 0 | 0 | 1 | 0/0 | 0 |
| India: Politics, Power & Public Discourse | 1/1 | 1 | 0 | 0 | 0 | 1/1 | 0 |
| Indian Express | 16/16 | 13 | 0 | 2 | 1 | 13/15 | 2 |
| Mint | 1/1 | 1 | 0 | 0 | 0 | 1/1 | 0 |
| NDTV | 1/1 | 0 | 0 | 0 | 1 | 0/0 | 0 |
| New York Times | 3/3 | 1 | 0 | 0 | 2 | 1/1 | 0 |
| Northeast Now | 1/1 | 0 | 0 | 0 | 1 | 0/0 | 0 |
| Political Economy, Stats, and Society | 1/1 | 0 | 0 | 0 | 1 | 0/0 | 0 |
| Politico Europe | 1/1 | 0 | 0 | 0 | 1 | 0/0 | 0 |
| Scroll.in | 1/1 | 0 | 0 | 0 | 1 | 0/0 | 0 |
| South China Morning Post | 1/1 | 0 | 0 | 0 | 1 | 0/0 | 0 |
| The Economist | 1/1 | 1 | 0 | 0 | 0 | 1/1 | 0 |
| The Hindu | 5/7 | 4 | 0 | 0 | 1 | 4/4 | 2 |
| The Quantified India | 1/1 | 1 | 0 | 0 | 0 | 1/1 | 0 |
| The Tribune | 1/1 | 1 | 0 | 0 | 0 | 1/1 | 0 |
| Times of India | 1/1 | 0 | 0 | 0 | 1 | 0/0 | 0 |

## Captured author

| Slice | Resolved / total | TP | FP | FN | TN | Positive retention | Abstentions |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| (missing) | 23/25 | 15 | 0 | 1 | 7 | 15/16 | 3 |
| ANI | 1/1 | 1 | 0 | 0 | 0 | 1/1 | 0 |
| Aastha Jha | 1/1 | 0 | 0 | 0 | 1 | 0/0 | 0 |
| Alice Yan + Alice Yan | 1/1 | 0 | 0 | 0 | 1 | 0/0 | 0 |
| Apurva Kumar | 1/1 | 1 | 0 | 0 | 0 | 1/1 | 0 |
| Brad Plumer | 1/1 | 0 | 0 | 0 | 1 | 0/0 | 0 |
| C. Raja Mohan | 5/5 | 4 | 0 | 1 | 0 | 4/5 | 1 |
| Jack Nicas | 1/1 | 0 | 0 | 0 | 1 | 0/0 | 0 |
| Joanna Ruck | 1/1 | 0 | 0 | 0 | 1 | 0/0 | 0 |
| Kate Cantrell, The Conversation | 1/1 | 0 | 0 | 0 | 1 | 0/0 | 0 |
| NE NOW NEWS | 1/1 | 0 | 0 | 0 | 1 | 0/0 | 0 |
| Pranay Kotasthane | 0/1 | 0 | 0 | 0 | 0 | 0/0 | 1 |
| Pratap Bhanu Mehta | 3/3 | 2 | 0 | 1 | 0 | 2/3 | 1 |
| Raveena Baneta | 1/1 | 1 | 0 | 0 | 0 | 1/1 | 0 |
| Rebecca F. Elliott | 1/1 | 1 | 0 | 0 | 0 | 1/1 | 0 |
| Ruchi Gupta | 1/1 | 1 | 0 | 0 | 0 | 1/1 | 0 |
| Sam Blewett | 1/1 | 0 | 0 | 0 | 1 | 0/0 | 0 |
| Soumyarendra Barik | 1/1 | 1 | 0 | 0 | 0 | 1/1 | 0 |
| Tibor Rutar | 1/1 | 0 | 0 | 0 | 1 | 0/0 | 0 |
| venkat | 1/1 | 1 | 0 | 0 | 0 | 1/1 | 0 |

## Owner content type (acceptance, not prediction accuracy)

| Slice | Resolved / total | TP | FP | FN | TN | Positive retention | Abstentions |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| analysis | 9/10 | 6 | 0 | 1 | 2 | 6/7 | 2 |
| column | 7/8 | 5 | 0 | 2 | 0 | 5/7 | 3 |
| digest | 1/1 | 0 | 0 | 0 | 1 | 0/0 | 0 |
| editorial | 2/3 | 2 | 0 | 0 | 0 | 2/2 | 1 |
| explainer | 11/11 | 9 | 0 | 0 | 2 | 9/9 | 0 |
| news_report | 15/15 | 6 | 0 | 0 | 9 | 6/6 | 0 |
| other | 2/2 | 0 | 0 | 0 | 2 | 0/0 | 0 |

## Owner scope

| Slice | Resolved / total | TP | FP | FN | TN | Positive retention | Abstentions |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| foreign_domestic_no_impact | 11/11 | 0 | 0 | 0 | 11 | 0/0 | 0 |
| global_knowledge | 6/6 | 4 | 0 | 1 | 1 | 4/5 | 1 |
| global_systemic | 10/10 | 8 | 0 | 2 | 0 | 8/10 | 2 |
| india_domestic | 18/18 | 14 | 0 | 0 | 4 | 14/14 | 0 |
| india_impact | 2/2 | 2 | 0 | 0 | 0 | 2/2 | 0 |
| unknown | 0/3 | 0 | 0 | 0 | 0 | 0/0 | 3 |

## Owner metadata sufficiency

| Slice | Resolved / total | TP | FP | FN | TN | Positive retention | Abstentions |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| insufficient | 0/3 | 0 | 0 | 0 | 0 | 0/0 | 3 |
| limited | 20/20 | 14 | 0 | 3 | 3 | 14/17 | 3 |
| sufficient | 27/27 | 14 | 0 | 0 | 13 | 14/14 | 0 |

## Missing descriptions

| Slice | Resolved / total | TP | FP | FN | TN | Positive retention | Abstentions |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| missing | 20/22 | 14 | 0 | 3 | 3 | 14/17 | 5 |
| present | 27/28 | 14 | 0 | 0 | 13 | 14/14 | 1 |

## Political noise

| Slice | Resolved / total | TP | FP | FN | TN | Positive retention | Abstentions |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| false | 41/41 | 28 | 0 | 3 | 10 | 28/31 | 3 |
| null | 0/3 | 0 | 0 | 0 | 0 | 0/0 | 3 |
| true | 6/6 | 0 | 0 | 0 | 6 | 0/0 | 0 |

## Gold primary (diagnostic only; Stage D independent)

| Slice | Resolved / total | TP | FP | FN | TN | Positive retention | Abstentions |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Economy | 10/10 | 7 | 0 | 1 | 2 | 7/8 | 1 |
| Environment | 3/3 | 1 | 0 | 0 | 2 | 1/1 | 0 |
| Governance | 2/2 | 1 | 0 | 0 | 1 | 1/1 | 0 |
| International relations | 9/9 | 5 | 0 | 2 | 2 | 5/7 | 2 |
| Polity | 8/8 | 5 | 0 | 0 | 3 | 5/5 | 0 |
| Sci-Tech | 6/6 | 6 | 0 | 0 | 0 | 6/6 | 0 |
| Security | 3/3 | 3 | 0 | 0 | 0 | 3/3 | 0 |
| not_applicable | 6/6 | 0 | 0 | 0 | 6 | 0/0 | 0 |
| unknown | 0/3 | 0 | 0 | 0 | 0 | 0/0 | 3 |

## Original partitions (both exposed calibration)

| Slice | Resolved / total | TP | FP | FN | TN | Positive retention | Abstentions |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| development | 40/42 | 25 | 0 | 2 | 13 | 25/27 | 4 |
| validation | 7/8 | 3 | 0 | 1 | 3 | 3/4 | 2 |

## Limits

- Enriched 50-item owner calibration; descriptive counts only, no statistical release estimates or confidence intervals.
- Model-origin annotations owner-validated, not independent human authorship or inter-rater agreement.
- Original development/validation assignments retained; these 50 are now exposed calibration material, including 8 validation records.
- Novelty uncertain/null is not duplicate, newness or analysis-angle gold; no E/F metrics.
- Publisher/description associations are confounded by deliberate selection and cannot establish causality.
- Unresolvable rows are excluded from binary and subject metrics.
- No absent-from-corpus acquisition recall denominator is available.
- Finite contextual rules are conservative coverage, not general semantic understanding. No unseen-gold performance claim.
- Three resolved positives remain deferred and count as false negatives. Metadata-ceiling diagnoses are implementation judgments, not relabeling.
- Candidate tiers are conservative policy signals; acceptance recall is not must-read tier accuracy. No subject classification, novelty, ranking or selection metrics.
- Index is provenance-pinned but not used for recurrence scoring; mixed CSE/UPPCS frequencies cannot enter UPSC-only Stage C.
