# A2a offline reviewer UX handoff

Implemented on `codex/validator-v3-reviewer-ux` from frozen A2a `c95d63b9740f0cc9aad756dd6a88684d499bf6c6`. HEAD remains that commit. No staging, commit, push, merge or deployment. No C/D/E/F or production changes.

Open the self-contained [offline reviewer](C:/Users/hario/.codex/worktrees/validator-v3-reviewer-ux/Atlas-News/tools/news/evaluation/data/reviewer-ux-ready/reviewer/index.html) in a normal browser. Deliver only `reviewer/` to human reviewers. The full package contains custodian-only frozen evidence outside that folder. Active derivative: `C:/Users/hario/.codex/worktrees/validator-v3-reviewer-ux/Atlas-News/tools/news/evaluation/data/reviewer-ux-ready`. Earlier local derivative directories are superseded, ignored QA artifacts.

The article card shows captured headline, publisher, section, date, legitimate byline and description. Missing descriptions display exactly “No description available in captured metadata”. Warm neutral styling, an 860px reading column, editorial typography, large muted judgment cards, sticky progress/navigation and mobile touch controls replace the JSON editor. Raw JSON and optional story analysis are closed by default. Technical details still expose all blind audit metadata, observations, revisions and hashes.

Value and metadata sufficiency are independent and initially unselected. Every substantive label starts null or an empty collection; no default sufficient, subject, politics, scope or novelty. Subjects include an explicit Unresolved choice storing null. Friendly controls write the existing canonical vocabulary. Reject-reason chips appear only after Reject; missing-context chips appear for Limited/Insufficient. The schema, rubric and annotation meaning are unchanged.

Evidence used buttons cite a complete captured title/description/byline/category field. Text selection can cite an exact phrase. Both derive observation IDs and UTF-16 offsets internally; no JSON or arithmetic is required. Unavailable fields cannot supply evidence. Section labels provide context but are not fabricated as category evidence.

Advanced / story analysis contains optional development/theme/angle IDs, secondary subjects, novelty, earlier observations, material delta and captured-revision inspection. First-pass Save & Next explicitly records Uncertain at the frozen cutoff when novelty has not been assessed, satisfying the existing completed-review contract without inventing identities or material deltas. This behavior is disclosed next to completion controls, inside Advanced and in the reviewer README. Unable to judge retains an unresolvable annotation; the existing A2a importer leaves final gold empty. Pair/sequence judgments remain in their existing separate templates.

Every change saves a corpus-bound local draft. Refresh restores answers, reviewer ID, position and revisit flags. Saved and storage-failure states are visible. Browser/file-mode storage availability varies: when unavailable, current drafts remain in memory and the UI directs the reviewer to download a backup. Draft backups preserve incomplete work; final Download answers validates all started reviews and exports only complete human responses in the unchanged A2a format. Unknown IDs, duplicate IDs, invalid vocabulary, wrong-corpus backups and invalid evidence are rejected before applying imports. Conflicting imports require an explicit replacement choice. Workflow flags never enter gold.

Search, jump and All/Unreviewed/Reviewed/Must read/Useful/Reject/Insufficient/Flagged views retain drafts. Progress counts explicitly completed reviews. Editing substantive answers returns an item to Draft. A single label never advances the article.

| Shortcut | Action |
| --- | --- |
| 1 / 2 / 3 | Must read / Useful / Reject |
| S / L / I | Sufficient / Limited / Insufficient |
| J / Right Arrow | Next, retaining draft |
| K / Left Arrow | Previous, retaining draft |
| Enter | Validate Save & Next |

Shortcuts are inactive in input/select/textarea/contenteditable fields and during IME/modifier use. Buttons retain their normal Enter action.

Browser verification: 100 checks passed at 375/768/1366px; zero network requests, no page errors, zero natural labels entered. Synthetic answers exist only in disposable browser contexts for contract testing; none became corpus gold. Twenty synchronous edits with 1,000 synthetic cards took 13.6ms on this run. No horizontal overflow; reduced motion disables animation. Physical tablet/stylus and every browser's file-mode storage behavior were not tested.

Screenshots: [desktop](C:/Users/hario/.codex/worktrees/validator-v3-reviewer-ux/Atlas-News/tools/news/evaluation/.runs/reviewer-ux-browser/natural-1366.png), [tablet](C:/Users/hario/.codex/worktrees/validator-v3-reviewer-ux/Atlas-News/tools/news/evaluation/.runs/reviewer-ux-browser/natural-768.png), [mobile judgment controls](C:/Users/hario/.codex/worktrees/validator-v3-reviewer-ux/Atlas-News/tools/news/evaluation/.runs/reviewer-ux-browser/judgments-375.png). Desktop and mobile screenshots were visually inspected.

Verification commands and results:

| Command / check | Result |
| --- | --- |
| `node tools/news/evaluation/bootstrap-browser-check.mjs tools/news/evaluation/data/reviewer-ux-ready` | 100 passed |
| `node --test tools/news/evaluation/reviewer-ux.test.ts tools/news/evaluation/bootstrap.test.ts tools/news/evaluation/editorial.test.ts tools/news/evaluation/evaluation.test.ts tools/news/evaluation/source-audit.test.ts` | 56 passed, 0 failed |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed; 0 errors, 133 existing warnings |
| `npm test` | 604 passed across 41 files |
| `npm run test:pipeline` | 39 passed, 6 skipped because canonical ZIP/package is unavailable |
| `npm run build` | Passed |
| Original corpus/schema validation CLI | 1,000 valid records |
| Original partition validation CLI | Valid |
| `git diff --check` | Passed |

The browser checks cover hidden JSON, expandable audit data, null defaults, canonical selections, conditional reasons, progressive disclosure, shortcuts/typing guards, refresh autosave, original-schema export/import, invalid-import atomicity, conflict cancellation, navigation, counts/filters, blind-data exclusions, zero network, responsive layouts, reduced motion, exact automatic spans, storage failure and 1,000-card typing. Logs remain ignored under `tools/news/evaluation/data/`.

Protected evidence remains byte-identical: 1,000 identities, 580 representative / 420 coverage, 750 development / 250 validation, frozen v2, all natural gold, reviewer templates/rubric, raw observations, sampling, partitions and owner exemplars. All 28 original package files were verified before generation; 30 derivative inventory entries were checked afterward. All 41 raw capture hashes match. Original dirty PYQ branch, HEAD, status and all 127 file hashes match its pre-commit snapshot. The frozen A2a checkout remains clean. No final prospective holdout was created or inspected. No article bodies were fetched or stored.

Only these existing package digests changed; the frozen original package was never rewritten:

| File | Frozen SHA-256 | UX derivative SHA-256 |
| --- | --- | --- |
| `reviewer/index.html` | `304063a398dfaf53705e38250aa28177f4c3dd7bc017924b364459abf77e4cf4` | `a4a0313648152f8382c8fde598599e0f37a4e095080666881085326d76355ab5` |
| `artifact-hashes.json` | `e82c5c1bbff8a6c0b433b4f4e118e14c21b52cf7ae5aae08fe1220cb87012f33` | `5881e4e5c883146a9005ec9e6ceb45a1fb1f3c25010ba8a3f3a9a2ef155c250b` |

HTML changed because presentation, controls and standalone validation were replaced. The artifact inventory changed to record that digest and three additions:

| Added file | SHA-256 |
| --- | --- |
| `reviewer/README.md` | `5515155174fa93b5ce541b43114f161a24865a1b6ed39c627c9637c8f1cccc46` |
| `artifact-hashes.a2a.json` | `e82c5c1bbff8a6c0b433b4f4e118e14c21b52cf7ae5aae08fe1220cb87012f33` |
| `reviewer-ux-manifest.json` | `ddcf8d05ba54d41e6d650ca9bf97d7638da6ce620a0e355ad095b8aca7670038` |

The original artifact inventory is preserved verbatim as `artifact-hashes.a2a.json`. `versions.json` stays frozen as A2a/v2 provenance; the new UX manifest separately records the seven UI implementation/test source hashes and fixed capture cutoff. Protected hashes:

| Protected artifact | Unchanged SHA-256 |
| --- | --- |
| corpus | `303f4fa0648201cf810ae2d789fad387d6e053bac6cd4f99c254c8e56ee9f1e6` |
| sampling | `828496b3eaca92c19f089cf5bb61db24f42a49f85d39a9ea7e8435ba3299fa04` |
| partitions | `300decc40e3acdf303acd35072a414f081f4d6c33eb97802b0ebab7ede3a4352` |
| rawObservations | `76f957dac110f212e06b60aebb1335ef4ef556b3154235da0d42698a2fec396c` |
| frozenV2 | `454c79e8c7edfc097957be02ea345eb7ab3cbfbbcca7fb60fe564b44e61e4ac2` |
| ownerExemplars | `3c624bc90c43558950d608c57934a2fd3fba0c068abc662a287f7673c94ee98d` |
| annotations | `a08cb3e072cb2b95ca9398751e5838c607bb9fbadecc5d69448e466fb5adacfe` |

Exact implementation/report files changed (nothing is staged):

- `tools/news/evaluation/bootstrap-browser-check.mjs`
- `tools/news/evaluation/reviewer-ui.ts`
- `tools/news/evaluation/reviewer-app.js`
- `tools/news/evaluation/reviewer-ui.css`
- `tools/news/evaluation/reviewer-schema.ts`
- `tools/news/evaluation/reviewer-ux-package.ts`
- `tools/news/evaluation/reviewer-ux.test.ts`
- `tools/news/evaluation/REVIEWER_UX_REPORT.md`
- `tools/news/evaluation/REVIEWER_UX_EVIDENCE.json`

To derive a fresh package without resampling or replaying v2:

```powershell
node tools/news/evaluation/reviewer-ux-package.ts "C:/Users/hario/.codex/worktrees/validator-v3-a2a/Atlas-News/tools/news/evaluation/data/a2a-bootstrap-2026-10-07/package-owner-final" tools/news/evaluation/data/NEW_REVIEWER_PACKAGE
```

The output must be a new directory. This copies immutable evidence and changes only reviewer assets/inventory. It never runs capture, sampling, partitioning, baseline replay or human annotation. Human adjudication has not started.

`git diff --stat` (Git excludes untracked new files):

```text
 tools/news/evaluation/bootstrap-browser-check.mjs | 108 +++++++++++++++-------
 tools/news/evaluation/reviewer-ui.ts              |  37 ++++++--
 2 files changed, 103 insertions(+), 42 deletions(-)
```

`git status --short`:

```text
 M tools/news/evaluation/bootstrap-browser-check.mjs
 M tools/news/evaluation/reviewer-ui.ts
?? tools/news/evaluation/REVIEWER_UX_EVIDENCE.json
?? tools/news/evaluation/REVIEWER_UX_REPORT.md
?? tools/news/evaluation/reviewer-app.js
?? tools/news/evaluation/reviewer-schema.ts
?? tools/news/evaluation/reviewer-ui.css
?? tools/news/evaluation/reviewer-ux-package.ts
?? tools/news/evaluation/reviewer-ux.test.ts
```
