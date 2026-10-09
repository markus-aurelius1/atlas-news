# Static Cloudflare assessment

Scope: local source inspection and local workerd/D1 evidence against the repository's documented 50-subrequest Free-plan budget. No remote account inspection or current plan certification; daily request volume, CPU time, D1 reads/writes/storage, hosted latency and billing arrangements remain unverified. No infrastructure was provisioned or changed.

| Path | Static per-invocation work | Evidence and limit |
| --- | --- | --- |
| `/api/current-affairs?shard=N` | At most six feed fetches, one cold Access key fetch, cache match and cache put | Fixed six-source shard, manual redirects, shared collection and two-hour cache; at most nine conservatively counted operations, below 50 |
| `/api/article` | Initial page plus at most three allowed redirects; one cold Access key fetch | At most five fetches; allowed-host checking at every hop, 3 MiB/1.5M-char bounds, private no-store, no bulk/preload/body sync |
| `/api/highlights-sync` | One D1 batch: five SQL statements on push, one indexed SQL query on idle; at most one cold Access key fetch | Maximum 100 records and 512,000 UTF-8 request bytes; count/byte bounded pull plus receipts; local 42-check test exercises actual endpoint/migrations/JWT/D1 |
| `/api/sync` | Independent legacy D1 batch plus possible cold Access key fetch | Legacy protocol/account/cursor preserved; local legacy/multidevice/security regressions pass |
| Validator C/D/E/F | Browser-local metadata inference and separate IndexedDB ledger | Zero Worker/model/API calls introduced by classification/selection; build-time local hash generation |

Access signing keys are cached per runtime; the local fixture observed one issuer-key fetch rather than one per request. Feed requests remain sharded rather than combining the entire registry into one invocation. Invalid shard/registry and restricted article addresses fail before upstream article/feed work. No automatic publisher background capture was added.

H3 reuses the existing lifecycle scheduling and adds an independent exchange, so Highlights can increase request/row usage even without a new polling interval. A bounded sync run allows up to 100 exchanges with continuation for larger libraries; this is not a claim that total daily traffic fits a quota. Sequence gaps from replay do not lose records; index `(user_id, seq)` bounds cursor scans. Local idle Highlights evidence: one SQL query, one row read, zero writes. Persistence/history growth and device latency need real operating evidence.

Assessment: **PASS for the inspected per-invocation request structure; BLOCKED for deployed Free-plan capacity/cost certification and production CPU/device performance.** No new paid service, API key, credit top-up, remote migration, CI job or deployment was used. The explicit zero-spend restriction remains in force for any later work.
