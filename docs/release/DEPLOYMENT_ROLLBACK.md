# Deployment and rollback instructions — not executed

Status: **BLOCKED for Validator v3 activation and combined production release**. The branch integrates the code; it does not establish production editorial quality. Default `VITE_NEWS_VALIDATOR` remains v2. Owner approval is required before any publication, push/main integration, deployment or remote migration, and approval alone does not replace the missing quality evidence.

## Prerequisites

1. Obtain independently adjudicated broader development/validation metadata and natural event/analysis/anchor/temporal judgments without editing frozen calibration data. Resolve the documented coverage/source concentration failures. Keep sealed future evaluation under an independent custodian; do not repeatedly evaluate or tune against it.
2. Collect or reuse authorized real multi-day metadata evidence. Current captures span minutes; synthetic replay is a regression fixture only. Verify real temporal suppression, material changes, representative replacement and selected chronology.
3. Verify real phone/touch/stylus behavior, including Samsung S-Pen/native handles, and two physical authenticated devices. Hosted Access expiry, D1 concurrency/latency and real publisher behavior require separately authorized testing.
4. Confirm the actual production origin and existing account's Free-plan configuration, quotas and non-billable operating arrangements. Static request bounds cannot certify an account's billing, daily demand or CPU/storage limits. No upgrade, paid usage, CI run or provisioning is authorized by this handoff.
5. Preserve user-selected version-4 backups and the previously approved deployment artifact/commit. Record the production migration state without changing it. Confirm additive migration `0002_highlights.sql` has not already been applied before any later approved operation.

## Local preflight

Use existing dependencies. Do not use `build:cloudflare` in this zero-download workflow: that helper runs npm ci. Set the confirmed HTTPS `SITE_URL` and approved `BASE`, then use `npm run build`. The test artifact produced here deliberately uses local canonical metadata; it must be rebuilt with the confirmed production origin before publishing.

Default/unset switch is v2. `shadow` evaluates cached metadata without selection-storage reads/writes; `v3` uses the separate selected-reading ledger. Shadow and v3 do not fetch article bodies or alter the acquisition schedule. A build switch requires a rebuild; it is not a Settings toggle.

Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:pipeline` and `node tools/news/evaluation/release-checks.mjs`. For browser verification set `PLAYWRIGHT_BROWSERS_PATH` to the installed Chromium directory. Build once and run `npm run test:browser` without an overlapping build. For the combined v3 fixture build with `VITE_NEWS_VALIDATOR=v3`, run `node tools/browser/validator-v3-check.mjs`, then restore the default build. Run sync checks only with `WRANGLER_BIN` pointing to the installed CLI; the harness uses loopback workerd and ephemeral local D1. On this Windows host point TEMP/TMP to an existing writable local test cache, as recorded in orchestration state.

## Later owner-approved publication

No remote command is executed or authorized here. After all prerequisites and explicit owner authorization, publish only the reviewed local release commit through a route that does not trigger billable remote CI. Inspect existing production backups/plan before any approved action. Apply the additive Highlights migration to the existing binding only under separate explicit remote-migration authorization; never drop the legacy tables or run a destructive reset. Then publish the reviewed build/functions using the confirmed origin and controlled validator mode.

Highlights uses `/api/highlights-sync`, `tars-highlight-sync/v1`, `highlight_sync_users`/`highlight_sync_records` and a separate cursor. Legacy `/api/sync` tables/cursor are independent. Older clients remain compatible. Browser highlight database version 2 adds sync stores without rewriting version-1 authored rows. A missing H3 endpoint pauses only Highlights sync; local excerpts and general personal sync remain usable.

## Rollback

Set `VITE_NEWS_VALIDATOR=v2` or unset it and rebuild; publish only after explicit owner approval. Alternatively restore the previously approved deployment artifact. Preserve the v3 selected ledger, `lodestar`, historical compatibility rows, highlight records/outbox/account guard, both D1 streams and all terminal tombstones. Do not downgrade, drop or erase databases or infer deletions from missing rows. An older client can coexist with the additive H3 tables; do not reverse the additive SQL migration. Retain version-4 backups without cursor/binding/outbox export. A policy rollback never changes a saved highlight's UUID or authored subject snapshot.
