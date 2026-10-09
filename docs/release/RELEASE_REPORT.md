# Validator v3 + Reader Highlights H3 combined release

**Final production status: BLOCKED.** Local engineering stages C verification → D → E → F → controlled A3 adapter → Highlights integration → combined regression are complete. V3 stays off by default; the final build uses v2. This branch must not be represented as production-ready or deployed before the documented quality and real-world gates are resolved and the owner explicitly authorizes publication.

Branch: `codex/validator-v3-highlights-release`, isolated worktree `9498/Atlas-News`. Final release SHA is the commit containing this report (`git log -1 --format=%H -- docs/release/RELEASE_REPORT.md`); H3 merge output is the commit containing `HIGHLIGHTS_HANDOFF.md`. The final checkpoint records exact preceding milestone SHAs in `ORCHESTRATION.md`.

## Milestones

| Stage | Local commit |
| --- | --- |
| Frozen gold | `349c86c4a57eaeb8f0d7f1928fdac61505e7479f` |
| Existing C, verified without retuning | `ec125e3eb80b9eedc64804636955465d9580742d` |
| Independent D subject classification | `3f01fc386a29651ea1cf44866c4fd26f42484d19` |
| E story replay/selected ledger | `bb6faf93f9b656d83becae91be75f8cae8ea814a` |
| F evidence-first selection/shadow diagnostics | `99f5a357da4dc6e11250df2c84490008693faca5` |
| Controlled A3 application adapter | `e0a243b61c79b50830ce0fdfc01742bb075a1631` |
| Frozen Highlights chain imported | `82926e114f1af10302d568ceb5ee2fa40cdfa632` (H2 parent `61c3070b05c33000432dfee5336cf74367a4edff`) |
| Combined H3 integration merge | `b48d9d3e9ba93c722795b6107100768f32616827` |

Each engineering stage has a durable handoff. The H3 merge preserves both verified parent chains. A final evidence checkpoint follows the integration merge; it changes documentation/evidence tooling only. No other worktree was modified.

## Validator findings

Frozen C enriched calibration: TP 28 / FP 0 / FN 3 / TN 16, precision 28/28 = 100%, recall 28/31 = 90.32%, must-read retention 16/17 = 94.12%. Must-read retention is below the proposed 95% target. Three unresolvable metadata abstentions (#3/#23/#36) stay outside binary truth; three resolved deferred positives (#6/#34/#43) remain misses. No data or policy was changed to improve these figures. The exposed 50-item set is not statistically representative production evaluation.

D exact primary subject is 29/31 on the exposed positive calibration; #6/#34 abstain. Macro F1 is 0.97619 over seven supported subject labels, not independent nine-subject validation. Geographic references, source/category and acceptance cannot vote for primary subject. Synthetic/metamorphic regressions protect dominant frames and independent stage contracts; general semantic coverage remains limited and needs naturally reviewed broader examples.

The 1,000-article / 3,143-observation captured metadata shadow preserves the same output hash and permutation result after integration hardening. V2 accepts 326, frozen C accepts 36 and defers 940; 20 overlap, 16 are v3-only and 306 v2-only. Unreviewed differences are not false-negative labels, but this is inadequate evidence of production coverage. At the explicit historical clock, Today has four reading units, 100% secondary sources, maximum source share 50%, and capacity loss zero. The preferred-source/content coverage gate is BLOCKED, not fixed by filling weak articles or retuning frozen C.

Calibration ranking exposes only two Today units (2/2 judged relevant); full P@20/P@50 cannot be calculated. Today must-read recall has denominator zero. Wider P@20/P@50, must-read recall, natural distinct-reading-need recall and duplicate exposure have no independently adjudicated truth and remain null. Synthetic 65-unit selection tests demonstrate the 50 ceiling and 15 capacity losses; this is not editorial precision. Equivalent reports use fixed representatives; materially distinct analysis requires explicit angle evidence. Larger semantic merge/split judgments remain unresolved.

Fourteen-day metadata observations and strongest seven-day comparisons, persistent selected identities, material-delta handling, replacement and selected-only chronological Archive are implemented. No cooldown re-entry. A crowded comparison bucket above 512 records abstains explicitly and never supplies a sampled strongest-comparison claim; selected history remains intact. Synthetic scale data in `story-profile.json` is clearly labelled and collected on this host alongside browser tests. Physical phone performance and naturally adjudicated multi-day temporal quality remain BLOCKED. Existing captures span minutes.

## Local verification

| Gate | Result |
| --- | --- |
| Root TypeScript | PASS |
| Lint | PASS: 0 errors, 133 existing warnings |
| Root tests | PASS: 772 tests, 56 files |
| Evaluation/import/gold/source/bootstrap tests | PASS: 77, no skips |
| Atlas pipeline | 39 passed, 6 guarded skips, 0 failed; missing external canonical ZIP |
| Production Vite build | PASS v3 fixture build and restored default v2; physical assets verified, 166 PWA entries |
| Shell/Atlas/labels/canonical question and offline browser checks | PASS desktop/mobile; light/dark; recall regression PASS |
| Default News | PASS: 276; repeated on final restored build after the v3 Saved-only correction |
| Reader | PASS: 320, no page errors; original popup timeout resolved with loopback fixture |
| H1 native Highlights | PASS: 92 |
| Highlight responsiveness | PASS: 60; original 100 ms preview threshold unchanged |
| Highlights library | PASS: 140, no page errors |
| Combined v3 + Highlights browser | PASS: 68 across 375/1366 light/dark, including native excerpt, classified snapshot, real reload identity and personal Saved separation |
| Local workerd/D1/Access/sync | PASS: 42, no page errors; both actual migrations applied only to ephemeral local D1 |
| H3 unit and subject/personal identity preservation | PASS: 21 H3 regressions plus saved-highlight integration regression, included in root |
| Protected files | PASS: all 161 SHA-256 commitments match |
| Original dirty PYQ checkout | PASS: HEAD, 127 status rows and all 127 file hashes match initial read-only capture |
| Imported Highlights core | PASS: exact diff against frozen H3 is empty |
| Whitespace/staging scope | PASS; final worktree verified clean after freeze |

Full default browser execution first failed at local-server startup under the sandbox; the permitted loopback run started successfully. It then passed through Reader and stopped at Highlights because the frozen H3 fixture lacked the current registryGeneration. Only the three fixture envelopes were corrected; the runner resumed explicitly from that failed suite through recall. No failed suite was silently skipped, no production gateway check weakened and no assertion or interaction threshold relaxed. The combined v3 and final default News checks use the final source/build.

Phone light and desktop dark Highlights library and combined Today screenshots were visually inspected: readable subject grouping, matching typography, no horizontal overflow, and preserved compact News layout. Touch and pen completion are simulated browser lifecycles; physical stylus/native selection handles are not certified.

The local D1/JWT checks exercise independent accounts/browser profiles, automatic upload/download, offline recoloring/reconnect, conflict convergence, terminal tombstones, general-sync independence and body-free wire/storage. Idle Highlights exchange uses one indexed query, one read and zero writes. Saved UUID/quote/anchor/authored subject/category/timestamps survive Validator subject changes and backup merge. Backup v4 remains additive; older backups and historical opaque compatibility data are protected. No full article body is stored, cached or synced.

Compact durable evidence: `verification.json`, `local-checks.json`, `preservation.json`, `protected-hashes.json`, `runtime-inventory.json`, `evaluation.json`, `subject-calibration.json`, `story-profile.json`. Detailed reproducible logs/screenshots remain in ignored local cache/browser output directories, with evidence digests in verification.json.

## Remaining gates and owner action

Independent broader development/validation labels, natural pair/angle/anchor/temporal truth, and an independent sealed future-holdout custodian are absent. Sealed A3 evaluation was not invoked. The owner-requested A3 application adapter is an engineering integration milestone, not that independent evaluation. Resolve the observed wider coverage/source failures before activation.

Real multi-day evidence, physical phone/S-Pen/native devices, hosted Access expiry, production D1 concurrency/latency, actual publisher behavior and deployed Free-plan CPU/daily traffic/D1 storage capacity remain unverified. Six external canonical-ZIP pipeline tests remain unavailable. Production canonical SITE_URL is intentionally unset in the local test artifact and must be confirmed for any later approved build.

`FREE_PLAN_ASSESSMENT.md` records a static per-invocation structure pass against the repository's documented budget; it does not certify deployed billing/capacity. `DEPLOYMENT_ROLLBACK.md` contains prerequisites, controlled build mode, additive migration sequencing and non-destructive rollback instructions. No push, main merge, remote migration, deployment, remote CI, provisioning, paid API, credit purchase/top-up or billing change occurred. No background internet capture or scheduled polling was started.

Owner deployment/publication and remote-migration approval remains required after the evidence gates are resolved. The completed local branch is preserved with a clean worktree; the task is stopped, with no claimed ongoing background execution.
