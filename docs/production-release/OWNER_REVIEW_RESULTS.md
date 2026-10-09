# Owner review results

Mandatory starting commit: 81dbb22eb171c516b573dc54f8656cd70a995ff6. Measured before tuning at the frozen clock 2026-10-07T13:40:55.600Z; empty selected history. Frozen candidate bytes were reused and the committed runtime reproduced the complete output exactly, including reverse input order. No runtime corrections were applied.

**STOP: systemic admission and subject-coverage defect.** This is a diagnostic safety judgment based on reproducible metadata misses, not a representative production-quality estimate. It is not a demand for another large editorial certification review. Repairing climate, electoral proceedings, investment treaties, conservation, regional security and international AI framing requires more than one narrowly scoped release correction; no C/D/E/F phase was restarted and no architecture was redesigned.

## Import integrity and authorship

Uploaded SHA-256: 81aee61ca6d69333a70fd25f915863b94a0ded2446fe74cccc346152afbec475. Sample SHA-256: 853a8bc657b4a78faeda25a95219dd95248ae7cb0d5f2a6f2651deaa1118b547. Exactly 50 article IDs and ten pair IDs match blind-review-v2; all metadata/observation membership and protected source hashes matched. Vocabulary and original annotation origin/reviewedAt fields were validated. Counts: 11 Must read, 12 Useful, 23 Reject, 4 Unable to judge. Uploaded bytes are in owner-review.original.json, original model annotations in model-annotations.original.json, and owner ratification in owner-attestation.json. These are **owner-ratified, model-assisted evidence, not independently human-authored gold or a sealed holdout**. The supplied ratification is an attestation, not a cryptographic signature. Neither export timestamps nor reviewerId replace model authorship.

Frozen candidate SHA-256: 0e5bcbc13fe2c5d9f400e0739e1b886a8e90846758841eff6066a701f30e48bb; semantic output hash: 362f63e217e1680f1d62ddf2c92453b5be7e0b614bd317569552f018d8a4b0ae. Earlier calibration, samples and frozen predictions remain unchanged.

## Outcomes

| Measure | Count |
| --- | --- |
| TP | 7 |
| FP | 1 |
| FN (explicit rejection only) | 0 |
| TN | 5 |
| Deferred positives | 16 |
| Deferred negatives | 17 |
| Unable-to-judge owner labels (outside denominators) | 4 |
| Must read accepted | 4/11 |
| Must read deferred | 7 |
| Must read rejected | 0 |
| Primary subject matches on all adjudicated cases | 14/46 (30.43%) |
| Primary subject matches on positive cases | 6/23 (26.09%) |

FN=0 does not mean there are no omissions: 16 of 23 positives are deferred. Positive retention is 7/23, distinct from conditional recall on decided positives. Subject accuracy includes correct Unresolved labels; among 37 adjudicated cases with a concrete owner subject, only 6 match. Four owner Unable-to-judge cases are separate; all four machine-defer. No P@20/P@50, temporal recall or population metric is claimed.

All accepted Must reads are outside the 24-hour Today window at the unchanged historical clock; they are suppressed as undated_or_stale. Today membership 0/11 cannot establish current production recall. Ages were not moved to improve scores.

## Exact false-positive admission

#28, India’s constitutional commitment to equality highlighted at UNHRC, https://www.tribuneindia.com/news/geneva/indias-constitutional-commitment-to-equality-highlighted-at-unhrc. C2.institution.v1 pairs “constitutional” in the title with “Trust” in the NGO proper name “Sambhali Trust”. It emits must_read_candidate although metadata describes a general NGO equality statement, with no council decision or concrete institutional change. D returns Unresolved. This is a reproducible lexical support error; no source/title-specific exception was added.

## Every missed Must read inspected

| Case | Publisher | Title | Inspection |
| --- | --- | --- | --- |
| 9 | Times of India | El Niño arrived early. Why its impact was felt from India to the Panama Canal | Detailed transregional monsoon/drought/flood consequences are present. C1/C2 extract no substantive span although D resolves Geography. Serious admission coverage gap; age explains Today exclusion but cannot explain C abstention. |
| 14 | The Hindu | India’s Model BIT — a decade later, amid changes | The investment-treaty object and India retrospective are explicit; the thesis is thin. BIT/investment-treaty coverage is absent from C and D. Partial evidence warrants uncertainty about depth, not ignoring the supplied object. |
| 16 | Business Standard | SC to examine plea to recall split verdict on CEC, EC appointment law | The long description explicitly supplies Supreme Court, appointment law, CJI exclusion and Constitution Bench referral. Neither C nor D recognizes this proceeding. The bounded judgment regex fails when the action and legal object are far apart or phrased as examine/recall. |
| 17 | The Hindu | Bird islands: On India’s bustard conservation programme | The headline identifies India’s bustard conservation programme; the description gives only the editorial stance. Narrow conservation vocabulary misses the explicit programme and leaves D unresolved. Depth uncertainty is real; complete subject loss is reproducible. |
| 30 | South China Morning Post | Yemen’s Houthis attack Aden airport as fighting intensifies | The description names missiles/drones, Aden and Bab el-Mandeb shipping/energy consequences. C and D still find no qualifying security frame. Geographic proper names alone must not admit stories, but this passage includes concrete systemic consequences. |
| 34 | The Tribune | SC to examine plea for recall of split verdict on law governing appointment of CEC, ECs | The second publisher corroborates the CEC/EC legal proceeding. C/D abstain and isolated E fails equivalence as for #16. This is the same development as #16, so seven missed articles represent six separate Must read needs. |
| 45 | The Hindu | AI cooperation: On Artificial Intelligence at a crossroads | The BRICS framework and geopolitical AI-governance framing are explicit, while detail is thin. C abstains; D weights artificial intelligence as Sci-Tech and misses the international-governance frame. |

## Exact deferred positives

| Case | ID | Title | Owner value | Machine subject |
| --- | --- | --- | --- | --- |
| 3 | article:9ec7d4d31398d9419b41a804db3d81f78758fa9ac0306b03b449b64c2011cb78 | COP31 hosts Australia and Türkiye face the fossil-fuel question | useful | Sci-Tech |
| 4 | article:d2414b2f789a43e64606fc2213c6d456dee444700942c9fc7c5027d011c0b114 | Over 20% returns: How NRIs could make a killing after banks hike FCNR(B) deposit rates | useful | Unresolved |
| 9 | article:0b151605f50f059fea59bfbac43f95a5c2f416c88c44687064b1aaaeb12561ab | El Niño arrived early. Why its impact was felt from India to the Panama Canal | must_read | Geography |
| 11 | article:b1ef06152fe8031362308318c0be39fa8612645a6cfad887a2ec8bda7f0c0297 | World’s oceans simmer at record heat, threatening marine life and food security | useful | Unresolved |
| 12 | article:1929d47f1e5d375dc012fbf666436fc99bca2aaf0be2a587975a2a9642f68ccc | The green light for the largest coalmine in NSW history is shocking proof that our governance systems are betraying Australians \| Georgina Woods | useful | Environment |
| 14 | article:8abc6ab2d785561808f8589a88ac8b9b15684fb2b1b7a18e41b46e6181398310 | India’s Model BIT — a decade later, amid changes | must_read | Unresolved |
| 15 | article:7b062422ca1373b63d158b3057c9f15ef504d799cf69b03c93a59e65c8aea691 | Chemistry Nobel awarded for solving mystery of life's asymmetry | useful | Sci-Tech |
| 16 | article:cc226b86cf13ff04f0d3dee18ea67a351641db116930c49631655bd23a1cf44b | SC to examine plea to recall split verdict on CEC, EC appointment law | must_read | Unresolved |
| 17 | article:70458cfa40146919de947fbe0ac2bcbf7640f610a3b2091c870320c035dff34d | Bird islands: On India’s bustard conservation programme | must_read | Unresolved |
| 19 | article:4a305dbd12655ac4735649735f50f5bcaa15c6b2e962f628ed59efe26a670e25 | Punjab reforms its PDS, checks pilferage, boosts savings | useful | Unresolved |
| 21 | article:d4db4de45434e357967a091524166ed4b531617d317b2717808861ac9e10f5cd | India’s IT sector is surviving artificial intelligence | useful | Sci-Tech |
| 29 | article:8aac5ab2e1fd7450c47701b762d0254bdc8237bd72a9d218580b435ed20fb160 | High court refuses to direct Delhi cops to wear body cameras during stirs: ‘Cannot be said a grey area’ | useful | Unresolved |
| 30 | article:543543d1b953f322223df9b75f283c875169e59bc1091129244be24784d82079 | Yemen’s Houthis attack Aden airport as fighting intensifies | must_read | Unresolved |
| 33 | article:e6d4bb9f552c74398e2676c0173034316ee33de441ca31f6e84ee7d3e165339f | Delhi HC refuses to direct security personnel to wear body cameras during protests | useful | Unresolved |
| 34 | article:4bee025eaf8b717fa4b3cee64a486a7405e108345e655d9cc90726ce9b0cd4da | SC to examine plea for recall of split verdict on law governing appointment of CEC, ECs | must_read | Unresolved |
| 45 | article:7200d989d71a7561e91d0c46782d88f9cd259e7d45456521ff6a53eba7f55a43 | AI cooperation: On Artificial Intelligence at a crossroads | must_read | Sci-Tech |

## Priority-tier disagreements

| Case | Title | Owner value | Machine tier |
| --- | --- | --- | --- |
| 20 | Expert Explains \| From Saudi to Kuwait, how US-Iran war is forcing Gulf states to rethink security strategies | must_read | useful |
| 37 | Pakistan’s deft diplomacy is an economic blessing. And a curse | useful | must_read_candidate |
| 40 | A Supreme Court Battle Over Climate Change Begins | useful | must_read_candidate |
| 47 | Burst of Attacks in Gulf Heightens Fears Over Fragile Energy Trade | must_read | useful |

This tier comparison covers accepted positives only; the false-positive must_read_candidate (#28) is disclosed separately. Deferred positives have no comparable accepted priority.

## Ten natural comparisons

| Pair | Cases | Owner development | Direct E equivalence | Pipeline admissions | Angle outcome | Representative |
| --- | --- | --- | --- | --- | --- | --- |
| pair-01 | 16/34 | same_development | false | deferred/deferred | split_or_missing_evidence | not_applicable_no_admissions |
| pair-02 | 1/41 | same_development | false | deferred/deferred | split_or_missing_evidence | not_applicable_no_admissions |
| pair-03 | 22/49 | same_development | false | deferred/deferred | unadjudicated | not_applicable_no_admissions |
| pair-04 | 29/33 | same_development | false | deferred/deferred | split_or_missing_evidence | not_applicable_no_admissions |
| pair-05 | 25/31 | same_development | false | deferred/deferred | split_or_missing_evidence | not_applicable_no_admissions |
| pair-06 | 21/45 | unrelated | false | deferred/deferred | isolated_distinction_detected | unadjudicated |
| pair-07 | 38/39 | related_distinct_development | false | deferred/deferred | unadjudicated | not_applicable_no_admissions |
| pair-08 | 30/44 | related_distinct_development | false | deferred/deferred | isolated_distinction_detected | not_applicable_no_admissions |
| pair-09 | 26/32 | same_development | false | deferred/deferred | split_or_missing_evidence | not_applicable_no_admissions |
| pair-10 | 42/43 | unrelated | false | deferred/deferred | unadjudicated | not_applicable_no_admissions |

Direct E matches 4/10 development expectations: pairs 06, 07, 08 and 10 correctly remain distinct. Six same-development pairs are split in isolation. These are not six admitted duplicates: every pair is gated out by C and no pair has two qualified admissions, so representative selection has **zero applicable pair denominators**. Owner representative preferences remain intact but cannot be scored as production selection. Complementary angles in 06 and 08 remain distinct in isolation; both useful sides are deferred, so actual independent reading needs are not preserved in the selected pipeline. Uncertain angles/representatives remain unadjudicated. Metadata cannot verify article-body analytical quality.

## Failure slices

| Publisher | Cases | TP | FP | Positive deferrals | Subject matches |
| --- | --- | --- | --- | --- | --- |
| Anticipating the Unintended | 1 | 0 | 0 | 0 | 0/0 |
| BBC | 1 | 0 | 0 | 1 | 1/1 |
| Business Standard | 2 | 0 | 0 | 1 | 0/2 |
| BusinessLine | 1 | 0 | 0 | 1 | 0/1 |
| Frontline | 1 | 0 | 0 | 0 | 0/1 |
| Guardian | 3 | 1 | 0 | 1 | 1/3 |
| Hindustan Times | 3 | 0 | 0 | 1 | 1/3 |
| India Today | 2 | 0 | 0 | 0 | 1/2 |
| Indian Express | 10 | 1 | 0 | 2 | 2/9 |
| NDTV | 1 | 0 | 0 | 0 | 0/1 |
| New York Times | 5 | 2 | 0 | 0 | 2/3 |
| Scroll.in | 3 | 1 | 0 | 1 | 1/3 |
| South China Morning Post | 1 | 0 | 0 | 1 | 0/1 |
| The Economist | 4 | 1 | 0 | 1 | 2/4 |
| The Hindu | 7 | 0 | 0 | 4 | 1/7 |
| The Tribune | 4 | 1 | 1 | 1 | 1/4 |
| Times of India | 1 | 0 | 0 | 1 | 1/1 |

| Owner subject | Cases | TP | FP | Positive deferrals | Subject matches |
| --- | --- | --- | --- | --- | --- |
| Economy | 4 | 0 | 0 | 2 | 0/4 |
| Environment | 7 | 2 | 0 | 4 | 2/7 |
| Geography | 1 | 0 | 0 | 1 | 1/1 |
| Governance | 3 | 1 | 0 | 1 | 0/2 |
| International relations | 7 | 3 | 1 | 2 | 1/7 |
| Polity | 10 | 1 | 0 | 4 | 1/10 |
| Sci-Tech | 3 | 0 | 0 | 1 | 1/3 |
| Security | 5 | 0 | 0 | 1 | 0/3 |
| Unresolved | 10 | 0 | 0 | 0 | 8/9 |

| Content-type proxy | Cases | TP | FP | Positive deferrals | Subject matches |
| --- | --- | --- | --- | --- | --- |
| analysis | 4 | 1 | 0 | 2 | 0/3 |
| explainer | 3 | 1 | 0 | 1 | 0/3 |
| report_or_other | 43 | 5 | 1 | 13 | 14/40 |

Section-based content type is a proxy, not verified body genre. The Hindu’s three Must reads all defer; detailed reports at Business Standard and The Tribune also miss, so this is not solely an IE missing-description problem. The only false-positive admission is The Tribune NGO statement. Subject family omissions recur across publishers. Tiny enriched slice counts must not be generalized to publisher quality or production prevalence.

## Complete article decisions

| Case | Article ID | Owner | Decision | Outcome | Owner subject | Machine subject |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | article:91ee5d57ad48dde60145ce6e698602522cbcdf303f3e84d743a62265cd4d3332 | reject | deferred | deferred_negative | Security | Unresolved |
| 2 | article:1d9dc758c308e18f35fe2d439fbc75c65424474fdfad6a7c8ca6b790690b1770 | reject | deferred | deferred_negative | Environment | Unresolved |
| 3 | article:9ec7d4d31398d9419b41a804db3d81f78758fa9ac0306b03b449b64c2011cb78 | useful | deferred | deferred_positive | Environment | Sci-Tech |
| 4 | article:d2414b2f789a43e64606fc2213c6d456dee444700942c9fc7c5027d011c0b114 | useful | deferred | deferred_positive | Economy | Unresolved |
| 5 | article:9f73bba9ab6f5cd45725a2ea7720e3b8c801f8107792ce9e6f6d76a6ae0e1a0f | reject | deferred | deferred_negative | Unresolved | Unresolved |
| 6 | article:1c7c7ec78a72486702a92c86a4711bb7460d001cd281df4e1d81eac73116f4cc | unable_to_judge | deferred | unadjudicated | Governance | Unresolved |
| 7 | article:29d9a222dc278727dd7ac0849c13b8576c73514b119e094fec8fc8be435006a2 | reject | deferred | deferred_negative | Unresolved | Unresolved |
| 8 | article:41c52572a4817294fd6589dd027a4d1875381baa0862ab37c3ac010f897c7775 | reject | deferred | deferred_negative | Polity | Unresolved |
| 9 | article:0b151605f50f059fea59bfbac43f95a5c2f416c88c44687064b1aaaeb12561ab | must_read | deferred | deferred_positive | Geography | Geography |
| 10 | article:7c9f909cb545241d654ae4e28b024c18af4ab57f8c52ece0979f2e1056b44fe8 | unable_to_judge | deferred | unadjudicated | Unresolved | Unresolved |
| 11 | article:b1ef06152fe8031362308318c0be39fa8612645a6cfad887a2ec8bda7f0c0297 | useful | deferred | deferred_positive | Environment | Unresolved |
| 12 | article:1929d47f1e5d375dc012fbf666436fc99bca2aaf0be2a587975a2a9642f68ccc | useful | deferred | deferred_positive | Environment | Environment |
| 13 | article:ba9a2cb90dbe5adee119c7340da73d52740f11d7e47f57420f5f95be73e4b484 | reject | deferred | deferred_negative | Unresolved | Unresolved |
| 14 | article:8abc6ab2d785561808f8589a88ac8b9b15684fb2b1b7a18e41b46e6181398310 | must_read | deferred | deferred_positive | International relations | Unresolved |
| 15 | article:7b062422ca1373b63d158b3057c9f15ef504d799cf69b03c93a59e65c8aea691 | useful | deferred | deferred_positive | Sci-Tech | Sci-Tech |
| 16 | article:cc226b86cf13ff04f0d3dee18ea67a351641db116930c49631655bd23a1cf44b | must_read | deferred | deferred_positive | Polity | Unresolved |
| 17 | article:70458cfa40146919de947fbe0ac2bcbf7640f610a3b2091c870320c035dff34d | must_read | deferred | deferred_positive | Environment | Unresolved |
| 18 | article:7b7b8c95cfec35d9c62aecf48850d4b4dd5c9475a02a95382230651c4b7d66e7 | reject | rejected | TN | Polity | Unresolved |
| 19 | article:4a305dbd12655ac4735649735f50f5bcaa15c6b2e962f628ed59efe26a670e25 | useful | deferred | deferred_positive | Governance | Unresolved |
| 20 | article:bf5751837c667d2bb4145304bfbbbbe18556854d0c9ad2c7175c86fa27c8514a | must_read | accepted | TP | International relations | Unresolved |
| 21 | article:d4db4de45434e357967a091524166ed4b531617d317b2717808861ac9e10f5cd | useful | deferred | deferred_positive | Economy | Sci-Tech |
| 22 | article:2d3e1c747f96a49d0db607b638b2e4eccfdb90b3179dd0a96d7d8e7cc1d588a6 | reject | deferred | deferred_negative | Sci-Tech | Unresolved |
| 23 | article:510614d047f02089eed3dcc2507e643a2643eb402f7c70960a0ec0a434e7e3de | reject | rejected | TN | Polity | Unresolved |
| 24 | article:3f10f4de3f3014a33b9353d72d4aeb4e8ca3c3edd537c03e2299b00b192816b6 | reject | rejected | TN | Unresolved | Sci-Tech |
| 25 | article:daef0f5bc258016da7397b50a3e407d120f7118132e31ea0f758fd906d7ce76a | reject | deferred | deferred_negative | Polity | Unresolved |
| 26 | article:6f3bb9b696f559a66fe793d9564a9a5c507bef1b087a49ac09e5ff05dcbf61c8 | reject | deferred | deferred_negative | Unresolved | Unresolved |
| 27 | article:31cb255425b1c6cf158f236a7a7a3457834ab05ed83e69aad1a9ab772c448f08 | reject | rejected | TN | Unresolved | Unresolved |
| 28 | article:0127ca68ac4fb951c11c8c6f10bed40ba4d709f456f34add5095be56647959f5 | reject | accepted | FP | International relations | Unresolved |
| 29 | article:8aac5ab2e1fd7450c47701b762d0254bdc8237bd72a9d218580b435ed20fb160 | useful | deferred | deferred_positive | Polity | Unresolved |
| 30 | article:543543d1b953f322223df9b75f283c875169e59bc1091129244be24784d82079 | must_read | deferred | deferred_positive | Security | Unresolved |
| 31 | article:3ab02d533a980418096384034dad96971c84133deebec30dd532f2b24f345cca | reject | deferred | deferred_negative | Polity | Unresolved |
| 32 | article:49a6f6aaa1f65fcafad5851b79ec806479b4e823bc6a94a224825c46c38da092 | reject | deferred | deferred_negative | Unresolved | Unresolved |
| 33 | article:e6d4bb9f552c74398e2676c0173034316ee33de441ca31f6e84ee7d3e165339f | useful | deferred | deferred_positive | Polity | Unresolved |
| 34 | article:4bee025eaf8b717fa4b3cee64a486a7405e108345e655d9cc90726ce9b0cd4da | must_read | deferred | deferred_positive | Polity | Unresolved |
| 35 | article:7ef97362b4dab2523f58d1dc150f726a670de0198b218bba1f20adbd68341046 | reject | rejected | TN | Unresolved | Unresolved |
| 36 | article:d2ce1c95b97ab835decdc5dbc7ba31cf80dc1ae8526aefd21b87abf059685074 | unable_to_judge | rejected | unadjudicated | Security | Unresolved |
| 37 | article:1c719d2fe252f07dab309395dffc126aeedccfa2c6c35e1ad2d86ee4f7640e37 | useful | accepted | TP | International relations | International relations |
| 38 | article:6e7d97981a8bd51187d5a0bf1773a0b94e8920a240d66fb2bc6b71665c9e83bf | reject | deferred | deferred_negative | International relations | Unresolved |
| 39 | article:a266156ac1ab5cebb906dbbbeacb39f67b7de0a9b9d3aec9cb90d97c4623ffcd | reject | deferred | deferred_negative | Unresolved | Unresolved |
| 40 | article:4dc8d97acd84db0b39b146a99c464f24e84d755219419ac04eb52212cfb9d727 | useful | accepted | TP | Environment | Environment |
| 41 | article:078fd1e0891fc4fb71bb6bbd67f1bf4b287ed8e6302840580b271112a67f7ca8 | reject | deferred | deferred_negative | Security | Unresolved |
| 42 | article:5fd324da5fb225c71f2afa2d985fb32777ae123f5805ce0a5758fdff3eb00b96 | reject | deferred | deferred_negative | Economy | Unresolved |
| 43 | article:3caa6b5b3d4f4aec1fb2b72dd191783cdbee24fa7b355874cbf062235261a438 | reject | deferred | deferred_negative | Economy | Unresolved |
| 44 | article:590dc09cbacc7cc1925c51301446946439183ad7095b2af6d554ae9361f45216 | unable_to_judge | deferred | unadjudicated | Security | Unresolved |
| 45 | article:7200d989d71a7561e91d0c46782d88f9cd259e7d45456521ff6a53eba7f55a43 | must_read | deferred | deferred_positive | International relations | Sci-Tech |
| 46 | article:ca09a35111a227c20ad9e4ac4639c9d5e67baa6e9dd8f1bebeb6c4ff6d54f9e1 | useful | accepted | TP | Environment | Unresolved |
| 47 | article:57c88696c0da74d291e31da979855488852fd95a6b4e6110da33bb5703a981a5 | must_read | accepted | TP | International relations | Unresolved |
| 48 | article:5fa781050ab5c97ef9781c907aaf0b336d5bf53c71fcc19db52eb22d33f16850 | must_read | accepted | TP | Polity | Polity |
| 49 | article:67f6c7e9466de9ca48026ecf969aaf7ed924eda54a37d02ef53bd65ed774110f | reject | deferred | deferred_negative | Sci-Tech | Unresolved |
| 50 | article:0926aa0ae21ace59c17316a267a64a22c60c6a269de38754dd085bc722145e5e | must_read | accepted | TP | Governance | Unresolved |

Full evidence spans, exact descriptions, subject diagnostics, sample IDs, decisions, tiers and all owner pair rationales are in owner-evaluation.json.

## Selected Today diagnostic

The unchanged sample replay selects two Today primaries: #28 (owner Reject, machine false-positive admission) and #46 (owner Useful, accepted). The NGO false positive is one of two selections, not the only selection. Current CEC/EC proceedings #16 and #34 are deferred despite publication within 24 hours. This reinforces the systemic activation stop; it does not establish a representative production precision or recall metric.
