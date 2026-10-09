# Owner-validated coverage comparison

**Diagnostic enriched nonrandom targeted sample; production readiness remains BLOCKED.** Exactly 25 frozen IDs: 8 Must read, 12 Useful, 5 Reject. All are model-origin annotations, individually owner-ratified; none is represented as independently human-authored. Original annotation fields and separate owner attestation are preserved byte-for-byte in the input.

The committed C/D/E/F pipeline was measured without rule changes. Observations-only child runners finish before labels join. Explicit clock 2026-10-07T13:40:55.600Z; empty observed/selected history. Both isolated 25-case and wider 1,000-case replay have the same article decisions, subjects, selected members and representatives for the targeted cases. Wider current and pre-recovery decisions, subjects and Today representatives exactly reproduce the committed shadow. Reverse observation order reproduces each complete run.

| Outcome | Before coverage recovery | Committed parent |
| --- | --- | --- |
| TP | 0 | 17 |
| FP | 0 | 0 |
| FN (explicit reject of positive) | 0 | 0 |
| TN (explicit reject of negative) | 0 | 0 |
| Deferred positives | 20 | 3 |
| Deferred negatives | 5 | 5 |
| Positive acceptance retention | 0/20 | 17/20 (85%) |
| Must-read acceptance | 0/8 | 7/8 (87.5%) |


Decided precision: 17/17 (100%). Decided-only recall: 17/17 (100%); this excludes three abstained positives and must never be substituted for 17/20 positive retention. Decided coverage: 17/25 (68%). Eight cases abstain. No negative case is decided, so rejection recall/specificity on decided negatives has a zero denominator (undefined), not 100%. Rejected-positive misses: none. Deferred-positive misses: #7/#11/#21. Today retains five of eight owner Must read articles as primaries; #9/#24 are accepted but stale-suppressed; #21 is deferred. A 24-hour edition is not an all-time must-read inventory.

False positives: none among decided cases. All 17 changed admissions are owner-ratified positives on this targeted sample. The pre-recovery run deferred all 25; recovery introduces zero negative admissions here and changes 12 primary subjects from Unresolved to correct positive subjects. This does not label other wider recovered/unreviewed articles.

## Exact abstentions and subject errors

| Case | ID / title | Owner | Subject owner → v3 |
| --- | --- | --- | --- |
| 7 | article:4271820ec11ad2ce203495f76f9bc320b7d8de02f6ac076533eb92a9e8650e0a — RBI repo rate news LIVE: RBI raises GDP growth forecast to 7.1 per cent for FY27 | useful | Economy → Economy |
| 8 | article:4abb3aac4db00b0aa81a752965530854192eac15112af76eb66ae0f3e153714c — Stop daily drama, learn from Modi to win people’s support: BJP to Congress | reject | Unresolved → Unresolved |
| 11 | article:81088560cc738673df639dd1b54be2e6f3f1256abc8e36811aa11b4df7f2686c — Why Anthropic is turning to religion to shape Claude’s values, and asking if AI can be conscious | useful | Sci-Tech → Unresolved |
| 12 | article:865fb667213b3f2dac8ffe25961417052bf8e99656ac6a5a04c71e57dd37783b — Gold Rate Today, October 7: Check 18, 22 and 24 carat gold prices in Chennai, Mumbai, Delhi, Kolkata and other cities | reject | Unresolved → Unresolved |
| 19 | article:b522c724e22805dfe4a8ff0484f1d4220a7203416614c4e126047ba1b10e4a59 — India News Live Updates, 7 October 2026: Maharashtra CM meets Amit Shah in Delhi to seek special assistance for drought | reject | Unresolved → Unresolved |
| 20 | article:ba773c14dbe91b5846c91056b801c304885ebfceb74ddeb6ca443d1f6179fa94 — Visakhapatnam naval base staffer, driver held for ‘sharing information with Pakistan’ | reject | Security → Unresolved |
| 21 | article:bbe7a1dd20c735adfd269ad998118618e601e55c2f1000f4e6ee3bef4d7a28f1 — Rahul Gandhi detained again: How does detention differ from arrest, what rights do detainees have? | must_read | Polity → Unresolved |
| 22 | article:bcd9ad71d8f5c788e88be88040ddb693e872f2288d8d0ebdb9a4a93ebb283834 — Three with Bhatti links held in J&K, one in Punjab; items ‘drone-dropped from Pakistan’ seized | reject | Security → Unresolved |


Subject errors: #11 Sci-Tech → Unresolved, #21 Polity → Unresolved, #20/#22 Security → Unresolved. All accepted primary subjects match owner judgments (17/17); all-positive primary subjects match 18/20. Positive acceptance and subject classification are separate assessments.

Metadata-sufficiency disagreements: #7/#8/#11/#12/#19/#20/#21/#22 (all v3 insufficient). Owner rates #8/#12 sufficient from explicit negative titles, the other six limited. All eight abstentions have missing descriptions. Twelve IE cases lack descriptions; four are nevertheless accepted. Missing summaries are a captured acquisition limitation, while demonstrable headline concepts and negative forms are narrow rule gaps. AI thesis/depth and individual-incident systemic consequence remain uncertain.

## Publisher and content patterns

| Publisher | Cases | TP | Deferred + | Deferred − |
| --- | --- | --- | --- | --- |
| Business Standard | 3 | 3 | 0 | 0 |
| Guardian | 2 | 2 | 0 | 0 |
| Indian Express | 12 | 4 | 3 | 5 |
| Mint | 1 | 1 | 0 | 0 |
| Scroll.in | 1 | 1 | 0 | 0 |
| The Hindu | 6 | 6 | 0 | 0 |


| Membership content proxy | Cases | TP | Deferred + | Deferred − |
| --- | --- | --- | --- | --- |
| editorial_analysis | 1 | 1 | 0 | 0 |
| explainer | 5 | 3 | 2 | 0 |
| news_or_other | 19 | 13 | 1 | 5 |


Content groups are metadata membership proxies, not independent genre labels. #15 is in the news/other proxy because it is on a Science feed with a video URL; its owner-ratified podcast/explanatory reading need is evaluated separately from the container format. No publisher-wide acceptance or rejection inference follows from these small groups.

## Ranking tier and representative assessment

Accepted owner Must read cases #2/#3/#5/#6/#9/#14 receive Useful, while #24 is must_read_candidate. Useful forecast #25 receives must_read_candidate. These are ranking-tier disagreements; no capacity loss occurs in either context. Chemistry chooses #2 The Hindu among four comparable reports, matching the ratified one-representative need. RBI official decision #3 represents its own unit; #5/#14/#16 each represent their separate analytical unit. Physics remains four units: #4 Scroll, #13 Business Standard, #17 The Hindu reports and #15 Guardian explanation. Only #17 and #15 enter Today; #4/#13 are stale, so correct visible cardinality hides a persistent equivalence split. No owner label establishes a uniquely optimal Physics report, and no counterfactual clustering/ranking correction is asserted.

See STORY_ANGLES.md for all natural group findings, ARTICLE_ERRORS.md / article-errors.json for all 25 causal diagnoses, regression-requirements.json for the bounded requirements, and RELEASE_GATES.md for remaining blockers.
