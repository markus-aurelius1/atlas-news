# Validator v3 final correction

Starting commit `66471b392047f78f2916d744b5f06f48adee364b` (`release/v3-h3-claude-handoff`). This resolves the systemic stop recorded in OWNER_REVIEW_RESULTS.md. The C → D → E → F architecture, contracts, storage and build switch are unchanged; no source, publisher, author or article identity was whitelisted and no threshold was lowered.

## Root cause

Stage C admitted an article only through 31 narrow topic/support regex routes, and Stage D classified through a separate, equally narrow frame list. Both had been written against the first two reviewed sets, where they score near 100%, and did not generalise:

| Replay of the committed runtime | Before | After |
| --- | --- | --- |
| Calibration 50: positives admitted / must reads / negatives admitted | 28/31 · 16/17 · 0/16 | 28/31 · 16/17 · 0/16 |
| Owner validation 25: positives admitted / must reads / negatives admitted | 20/20 · 8/8 · 0/5 | 20/20 · 8/8 · 0/5 |
| Final owner review 50: positives admitted | 7/23 | 21/23 |
| Final owner review 50: must reads admitted | 4/11 | 11/11 |
| Final owner review 50: negatives admitted (false positives) | 1/23 | 0/23 |
| Final owner review 50: primary subject on positives | 6/23 | 23/23 |
| Final owner review 50: natural pair development agreement | 4/10 | 7/10 |
| Unlabelled 1,000-article capture (2026-10-07): admitted | 56 | 184 |
| Same capture, full pipeline at the frozen clock: Today units | 2 on the review sample | 32 of 201 articles under 24 hours old |

All three reviewed sets are now development data: these figures show the mechanisms are corrected and earlier behaviour is preserved, not held-out production precision or recall. The 1,000-article capture has no labels; its 128 new admissions were read once for obvious noise, which produced the generic market-noise, practice-material and non-reading-format rejections below. No labelling campaign was started.

## What changed

- `lexicon.ts` (new): one syllabus vocabulary of 18 domains shared by C and D. A domain lists examinable objects (instruments, issues, phenomena), never bare actors such as a court, a government, an agency or a country.
- Stage C (`evidence.ts`): a domain route needs an object **and** an independent substantive proposition **in the same field**, so a headline entity cannot borrow an unrelated summary sentence. Domestic domains still need textual Indian jurisdiction (a wider anchor list; never a feed section or publisher); knowledge and systemic domains keep their global scope. Sea-lane place names admit only with a stated trade or energy consequence. The original 31 routes are untouched.
- NGO false positive: a single capitalised word that continues a capitalised name in sentence-case prose (“Sambhali Trust”) is part of the name and can no longer serve as the proposition “trust”. The same guard applies to every route.
- Rejections (`policy.ts`): practice material (quizzes, answer practice), cartoons/satire/watch-only items, index and results-season market copy, and more party names for the existing party-reaction rule.
- Stage D (`subject.ts`): the shared lexicon supplies subject evidence wherever C can admit, counted once per subject per field; six cross-domain compound frames (for example AI with geopolitics, AI with labour, climate with litigation) outweigh either entity alone. `fossil` no longer matches “fossil fuel”.
- Stage E (`stories.ts`): reports of one development under different headlines merge when most of the shorter headline’s distinctive words recur and they were published within three days. Differing figures, counterparts, named subjects, refusal/outcome, explanatory treatment, analytical section or typed action keep them apart, and summaries of unequal length no longer split a pair. Differently worded headlines are nominated for comparison through shared words, including against previously selected readings, so a reworded repeat is suppressed. Award and typed-frame paths are unchanged.

## Remaining, by design or residual

- Abstention is preserved: opaque headlines with no summary (for example column titles with no stated object) still defer. Two reviewed positives defer: The Economist on the IT sector and AI (no proposition in the metadata) and a Guardian opinion headline on a coal-mine approval.
- Three owner same-development pairs stay split: two reject-only political incident pairs with little shared wording, and a podcast follow-up published three and a half days after the first report.
- Tier: 7 of 11 owner must reads carry the must-read tier; four owner-useful items are tiered must read. Tier affects ordering only.
- Admission is wider, so some routine items with a syllabus object and an action verb will appear. Capacity stays 50 and is never force-filled.

## Regressions

`owner-review-corrections.test.ts` adds 50 cases: natural rows from the review with adjacent synthetic controls for each mechanism (object without proposition, proposition without object, place name alone, cross-field borrowing, missing jurisdiction, proper-name guard, cannot-link conditions, order independence, reworded repeat). The previous 125 Validator tests pass unmodified.
