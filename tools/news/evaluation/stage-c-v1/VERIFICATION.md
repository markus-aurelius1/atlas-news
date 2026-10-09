# Stage C verification and handoff

Isolated worktree: `C:\Users\hario\.codex\worktrees\validator-v3-stage-c\Atlas-News`. Branch `codex/validator-v3-stage-c`, based directly on mandatory parent `349c86c4a57eaeb8f0d7f1928fdac61505e7479f`. This is the precommit handoff snapshot for the owner-authorized single local commit `Implement Validator v3 eligibility and relevance`; the final SHA and Git status are returned separately. Exactly 20 Stage C additions are in the commit manifest. No push, merge, deployment or remote creation.

## Results

| Check | Result |
| --- | --- |
| Root `npm test` | 636/636 passed, 42 files; includes 32 focused Stage C policy tests |
| Evaluation, replay, import and integrity suites | 77/77 passed again after LF normalization; earlier focused calibration rerun 8/8 |
| `npm run test:pipeline` | 39 passed, 6 guarded skips, 0 failed |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed, 0 errors and 133 existing-file warnings; no warning in new Stage C code |
| `npm run build` | Passed, 165 PWA entries; Stage C policy identifier absent from shipped JS |
| Full `npm run test:browser` | **Incomplete**: shell 36, cold-start 6, label/marker 90, remaining Atlas/PYQ and News 276 checks passed before reader timeout |
| Unchanged reader standalone retry | **Failed again** at `tools/browser/reader-check.mjs:231`, `tab.waitForLoadState()` on the fixture publisher popup, 30-second timeout |
| Precommit bounded Reader popup retry | **Failed**: one focused 375-light retry, unchanged 30-second load wait; fixture intercepted but no popup navigation/load event. Root cause unresolved |
| Precommit gold/Stage C integrity rerun | 18/18 passed, 0 skips |
| Recall browser check reached separately | Passed native persistence, Familiar reload, XP and next-day review; no console errors |
| Frozen-v2 exact replay | All 1,000 article predictions and full traces identical, including reverse replay |
| Stage C repeat/permutation | Identical A1 output and complete Stage C trace digests; 20 repeated runs |
| Preservation | Original dirty checkout status and 127 file bytes match the before fingerprint; 15 frozen gold artifacts and 28 protected source-package artifacts and the complete 27-file source inventory match pinned hashes; the gold manifest companion, 16 pinned code hashes and 9 prior verification-log hashes also match |

The six pipeline skips require the unavailable canonical ZIP (`canonical-pyq-v2-final.zip` or `CANONICAL_PYQ_PACKAGE`). No package input or frozen corpus was regenerated and no guard was weakened. The browser reader failure is retained as an unmet verification gate; the full suite is not claimed green. Its publisher navigation is a test fixture, not article acquisition by Stage C. Production files, reader code and browser assertions were not changed to conceal it. Hosted/device/Access production certification was not attempted.

## Calibration outcome

Owner calibration only: TP 28, FP 0, FN 3, TN 16 on 47 resolved cases. Precision 28/28 (100%), recall 28/31 (90.32%); must-read acceptance 16/17. Fourteen of the 17 baseline misses recover, the memorial false positive is rejected and every baseline accepted positive survives. Requested-author retention rises 4/8 to 6/8; Science 6/6, Security 3/3, explained positives 9/9 and institutional positives 6/6 survive. Resolved positives #6/#34/#43 defer, remain misses and receive individual metadata-ceiling explanations; #3/#23/#36 are separate unresolvable abstentions.

These are enriched development diagnostics, not release estimates. The proposed 95% must-read gate is not demonstrated: even the descriptive 16/17 point result is 94.12%. Editorial/column and IR retention remain incomplete, and finite lexical patterns require broader independently reviewed development/validation and a future sealed holdout before integration. No statistical release interval, content-type accuracy, subject classification, E/F metric or acquisition recall is claimed.

## Reproducibility and operational evidence

Twenty repeated runs over 159 observations / 50 URLs: p50 52.40 ms, p95 64.74 ms; sampled heap 114,949,896 bytes. Node v24.19.0 on win32/x64. Timing includes file hashing, A1 validation and replay and varies with host load; heap is a host sample, not process peak or browser/device memory. Hashes, exact baseline replay, rule source inventory and input/output digests are in reproducibility.json and VERIFICATION.json.

The new Stage C additions were normalized to the repository LF policy before the commit so byte-pinned code hashes survive checkout. Derived predictions/comparison/reproducibility reports were regenerated. Root tests (636), all evaluation suites (77), pipeline tests (39 passed / 6 guarded skips), typecheck, lint and build passed again. The 16 pinned code-file hashes match the staged Git blobs; no frozen or production file was normalized. Browser results above remain historical and the Reader gate remains unresolved.

## Review files

- RULES.md: authority conflicts, exact stage contracts, evidence/priors/precedence and limitations.
- COMPARISON.md and comparison.json: all requested protected, publisher, author, type, scope, metadata, political and provenance slices with denominators.
- CASE_ANALYSIS.md: all 50 cases, including every remaining FN, fixed FP, recovered positive and unresolved case.
- predictions.json: separate deterministic C1/C2 decisions, confidence, coverage, bounded dimensions and observation-bound UTF-16 spans.
- CHANGED_FILES.txt and GIT.txt: exact file inventory and the real staged `git diff --cached --stat`/status snapshot immediately before the requested commit. Both unstaged and staged whitespace checks pass.

## Bounded Reader investigation

The failing operation is the modified headline click followed by `tab.waitForLoadState()` in `tools/browser/reader-check.mjs:231`. The existing reader script was copied to ignored diagnostic output, restricted to 375/light and stopped after this popup check. The original route fixture, click, assertion and 30-second load wait were preserved; diagnostic request/navigation/load logging was added. One focused retry took 78.519 seconds and failed with `page.waitForLoadState: Timeout 30000ms exceeded.` at the diagnostic copy `tools/browser/out/stage-c-reader-popup-check.mjs:231:323`. The fixture route intercepted `https://indianexpress.com/article/fixture-rbi`; the popup initial URL was empty and no navigation/load event was logged before timeout.

A separate minimal mocked-popup diagnostic returned from a load wait while still at `about:blank`, which does not prove correct fixture navigation. A popup lifecycle/loading race is a hypothesis; the root cause is not established. No safe fix was established within the bounded investigation. The affected remainder was not rerun, the browser gate remains outstanding, and the complete browser suite did not pass. Diagnostics and logs are ignored local artifacts, excluded from the 20-file commit.

The architecture inputs were read from the original untracked planning files; their bytes are pinned in VERIFICATION.json and conflicts are resolved in RULES.md. Future acquisition/D/E/F work and production integration remain outside this slice.
