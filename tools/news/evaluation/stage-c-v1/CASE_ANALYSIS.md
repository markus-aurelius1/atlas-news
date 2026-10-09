# Complete 50-case Stage C analysis

All false negatives, false positives, recovered baseline misses, protected positives and three unresolvable cases are included. Exact evidence spans and dimensions are in predictions.json. Gold remains immutable.

| # | Title | Gold | v2 | C | Explanation |
| ---: | --- | --- | --- | --- | --- |
| 1 | Chinese woman snaps up nearly 200 parking spaces to flip to neighbours for profit | reject | TN | TN (rejected) | Rejected by C1.foreign_domestic_no_impact.v1, C1.routine_business.v1; substantive terms or prior evidence cannot override the hard gate. |
| 2 | How to measure the success of India’s capex strategy | must_read | TP | TP (accepted) | Accepted via C2.public-finance.v1 with exact observed spans; author/source priors cannot clear the floor. |
| 3 | #354 When Faced Against a Cannon... | unresolvable | excluded_unresolvable | excluded_unresolvable (deferred) | No sufficient topical, substantive and scope route; missing evidence remains explicit. |
| 4 | France high school students’ protest: What sparked violence, what’s next | reject | TN | TN (rejected) | Rejected by C1.foreign_domestic_no_impact.v1, C1.routine_local.v1; substantive terms or prior evidence cannot override the hard gate. |
| 5 | Why small rivers need distinct rejuvenation strategy | useful | FN | TP (accepted) | Accepted via C2.water-method.v1 with exact observed spans; author/source priors cannot clear the floor. |
| 6 | C Raja Mohan writes: The ghosts of 1945 are being recruited for today’s contest over Asia | must_read | FN | FN (deferred) | Missing summary; historical metaphor and regional contest do not establish the strategic argument or mechanism. Verified byline/column context is retained but cannot supply the absent thesis. |
| 7 | CJI says Supreme Court did not approve Form 6 changes: What the form is, why it matters | must_read | TP | TP (accepted) | Accepted via C2.institution.v1 with exact observed spans; author/source priors cannot clear the floor. |
| 8 | Oil Is Flowing From the Persian Gulf, but Prices Remain High. Why? | must_read | FN | TP (accepted) | Accepted via C2.energy-system.v1 with exact observed spans; author/source priors cannot clear the floor. |
| 9 | Dispatch #125: The floor is rising; the people aren't | useful | FN | TP (accepted) | Accepted via C2.distribution.v1 with exact observed spans; author/source priors cannot clear the floor. |
| 10 | “Not going to trade words for actions”: US VP Vance says Iran must cut nuclear enrichment to end war | useful | TP | TP (accepted) | Accepted via C2.nuclear-security.v1 with exact observed spans; author/source priors cannot clear the floor. |
| 11 | Kaliningrad: Why Russia’s Baltic exclave is a new flashpoint | useful | FN | TP (accepted) | Accepted via C2.strategic-security.v1 with exact observed spans; author/source priors cannot clear the floor. |
| 12 | Knowledge Nugget \| Quantum Computing: What is the new research and why does it matter? | must_read | FN | TP (accepted) | Accepted via C2.research.v1 with exact observed spans; author/source priors cannot clear the floor. |
| 13 | Editorial. Lending transparency | useful | FN | TP (accepted) | Accepted via C2.lending.v1 with exact observed spans; author/source priors cannot clear the floor. |
| 14 | Migration worries, not economic concerns, boost the AfD | reject | TN | TN (rejected) | Rejected by C1.party_primary.v1; substantive terms or prior evidence cannot override the hard gate. |
| 15 | 'Inflation man Modi's reign of terror continues': Congress on repo rate hike | reject | TN | TN (rejected) | Rejected by C1.party_primary.v1; substantive terms or prior evidence cannot override the hard gate. |
| 16 | INDIA bloc MPs detained en route to Jantar Mantar sit-in against Gyanesh Kumar | reject | TN | TN (rejected) | Rejected by C1.party_primary.v1; substantive terms or prior evidence cannot override the hard gate. |
| 17 | Oil prices remain highly flammable | useful | FN | TP (accepted) | Accepted via C2.energy-system.v1 with exact observed spans; author/source priors cannot clear the floor. |
| 18 | Coco Gauff says online racist abuse was ‘draining’ after China Open exit | reject | TN | TN (rejected) | Rejected by C1.entertainment.v1; substantive terms or prior evidence cannot override the hard gate. |
| 19 | C Raja Mohan: AI is now a great-power game. That poses a test for India | must_read | TP | TP (accepted) | Accepted via C2.world-order.v1 with exact observed spans; author/source priors cannot clear the floor. |
| 20 | The week in wildlife: a rescued orangutan, the chonkiest bear and a barn owl’s triumph | reject | TN | TN (rejected) | Rejected by C1.roundup.v1; substantive terms or prior evidence cannot override the hard gate. |
| 21 | Pratap Bhanu Mehta: Election Commission and Court make it harder, not easier, to believe in independent institutions | must_read | FN | TP (accepted) | Accepted via C2.institution.v1 with exact observed spans; author/source priors cannot clear the floor. |
| 22 | Abe Memorial Corridor honouring Shinzo Abe, India-Japan ties opened in Varanasi | reject | FP | TN (rejected) | Rejected by C1.ceremonial_low_value.v1; substantive terms or prior evidence cannot override the hard gate. |
| 23 | Singing, for unity or division | unresolvable | excluded_unresolvable | excluded_unresolvable (deferred) | No sufficient topical, substantive and scope route; missing evidence remains explicit. |
| 24 | Iran must cut enrichment to end war, says US Vice President JD Vance | useful | TP | TP (accepted) | Accepted via C2.nuclear-security.v1 with exact observed spans; author/source priors cannot clear the floor. |
| 25 | VCK demands basic amenities for SC/ST residents in the Nilgiris | reject | TN | TN (rejected) | Rejected by C1.party_primary.v1; substantive terms or prior evidence cannot override the hard gate. |
| 26 | C Raja Mohan: In Iran war, US midterm elections are the new front | must_read | TP | TP (accepted) | Accepted via C2.war-politics.v1 with exact observed spans; author/source priors cannot clear the floor. |
| 27 | Fiscal federalism, efficiency versus equity concerns | must_read | FN | TP (accepted) | Accepted via C2.institution.v1, C2.public-finance.v1 with exact observed spans; author/source priors cannot clear the floor. |
| 28 | ‘Most expensive election ever, anywhere’ | useful | FN | TP (accepted) | Accepted via C2.election-finance.v1 with exact observed spans; author/source priors cannot clear the floor. |
| 29 | As India’s law enforcement agencies turn to AI, the potential benefits, risks | must_read | TP | TP (accepted) | Accepted via C2.technology-governance.v1 with exact observed spans; author/source priors cannot clear the floor. |
| 30 | Who is middle class in India, and why do they feel squeezed? | useful | FN | TP (accepted) | Accepted via C2.distribution.v1 with exact observed spans; author/source priors cannot clear the floor. |
| 31 | How India’s R&D ecosystem shapes its goal of becoming a knowledge-driven economy | must_read | TP | TP (accepted) | Accepted via C2.technology-governance.v1 with exact observed spans; author/source priors cannot clear the floor. |
| 32 | Karl Deisseroth, Peter Hegemann Georg Nagel awarded Nobel Medicine Prize: Who are they? Know their research fields | must_read | TP | TP (accepted) | Accepted via C2.research.v1 with exact observed spans; author/source priors cannot clear the floor. |
| 33 | Robust AI spending sets investors up for another bumper US earnings season | reject | TN | TN (rejected) | Rejected by C1.routine_business.v1; substantive terms or prior evidence cannot override the hard gate. |
| 34 | Pratap Bhanu Mehta writes \| Graham Bill is America confusing its power with virtue — yet again | useful | FN | FN (deferred) | Missing summary; power/virtue rhetoric and America/Graham Bill reference do not establish the bill content, foreign-policy mechanism or argument. No URL-slug, author-topic or prestige inference. |
| 35 | First dinosaur bone from Antarctica found in a drawer | useful | FN | TP (accepted) | Accepted via C2.research.v1 with exact observed spans; author/source priors cannot clear the floor. |
| 36 | The Writer’s House | unresolvable | excluded_unresolvable | excluded_unresolvable (deferred) | No sufficient topical, substantive and scope route; missing evidence remains explicit. |
| 37 | MeitY IndiaAI Centre of Excellence in Artificial Intelligence to be launched on Wednesday | useful | TP | TP (accepted) | Accepted via C2.national-capacity.v1 with exact observed spans; author/source priors cannot clear the floor. |
| 38 | Reform probe clears Farage aides caught in donations sting | reject | TN | TN (rejected) | Rejected by C1.party_primary.v1; substantive terms or prior evidence cannot override the hard gate. |
| 39 | Fossil identified as first dinosaur ever found in Antarctica | useful | FN | TP (accepted) | Accepted via C2.research.v1 with exact observed spans; author/source priors cannot clear the floor. |
| 40 | SA20 2026 Live Streaming: When And Where To Watch Live Telecast | reject | TN | TN (rejected) | Rejected by C1.entertainment.v1; substantive terms or prior evidence cannot override the hard gate. |
| 41 | ‘Swan Song’: Princess Diana’s brother’s book is icy in its contempt for the British royal family | reject | TN | TN (rejected) | Rejected by C1.entertainment.v1; substantive terms or prior evidence cannot override the hard gate. |
| 42 | Should the EC take action against those filing forms for mass deletions? | must_read | TP | TP (accepted) | Accepted via C2.electoral-rights.v1 with exact observed spans; author/source priors cannot clear the floor. |
| 43 | Bridging economics and psychology | useful | FN | FN (deferred) | Missing summary; economics/psychology identifies an interdisciplinary area but no behavioural mechanism, finding, application or thesis. Topic presence alone cannot clear substance. |
| 44 | Pratap Bhanu Mehta writes \| Amid AI, wars and climate change catastrophes, diplomacy is acting ‘normal’ | must_read | TP | TP (accepted) | Accepted via C2.world-order.v1 with exact observed spans; author/source priors cannot clear the floor. |
| 45 | Exasperated by Delays, Congress Tries to Speed Up Energy Permitting | reject | TN | TN (rejected) | Rejected by C1.foreign_domestic_no_impact.v1; substantive terms or prior evidence cannot override the hard gate. |
| 46 | Could US-Iran deal end the elusive quest for ‘New Middle East’? | must_read | TP | TP (accepted) | Accepted via C2.world-order.v1 with exact observed spans; author/source priors cannot clear the floor. |
| 47 | What does the Centre’s new mining law say and why are states opposing it? | must_read | TP | TP (accepted) | Accepted via C2.regulatory-action.v1 with exact observed spans; author/source priors cannot clear the floor. |
| 48 | Brazil Election Could Give Bolsonaro a Key Role in Trump’s Latin America Map | reject | TN | TN (rejected) | Rejected by C1.foreign_domestic_no_impact.v1, C1.party_primary.v1; substantive terms or prior evidence cannot override the hard gate. |
| 49 | Why did I get $90 from Social Security? Trump Medicare payment explained | reject | TN | TN (rejected) | Rejected by C1.foreign_domestic_no_impact.v1; substantive terms or prior evidence cannot override the hard gate. |
| 50 | C Raja Mohan: The multipolar world India wants may be a distant reality | must_read | FN | TP (accepted) | Accepted via C2.world-order.v1 with exact observed spans; author/source priors cannot clear the floor. |

## Metadata ceiling and acquisition handoff

#6: Missing summary; historical metaphor and regional contest do not establish the strategic argument or mechanism. Verified byline/column context is retained but cannot supply the absent thesis.

#34: Missing summary; power/virtue rhetoric and America/Graham Bill reference do not establish the bill content, foreign-policy mechanism or argument. No URL-slug, author-topic or prestige inference.

#43: Missing summary; economics/psychology identifies an interdisciplinary area but no behavioural mechanism, finding, application or thesis. Topic presence alone cannot clear substance.

All three unresolved owner cases (#3, #23, #36) explicitly defer. #3 has a nonempty two-word placeholder, demonstrating why field presence alone is insufficient. Recover permitted feed summaries/bylines only through separately authorized acquisition work; do not fetch article bodies, use URL slugs as hidden summaries or change owner labels. Finite rule coverage can also cause misses; these diagnoses do not prove absent metadata is the only possible cause.
