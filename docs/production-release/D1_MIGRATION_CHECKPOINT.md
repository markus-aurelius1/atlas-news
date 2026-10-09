# Production D1 migration checkpoint

**Do not execute: production migration approval has not been requested or granted. Publication is stopped by the systemic editorial defect.** The following additive change and recoverable backup are ready for owner review once that release blocker is resolved. No production database write has occurred.

Account: 5d8f8fb2f5df3b6125098fe367cab4f9. Pages project: tars-atlas-news. Binding: SYNC_DB. Database: tars-sync. UUID: 824fd651-a92c-4716-a618-232624fa5bcc. Live schema contains sync_users, sync_records and d1_migrations (plus Cloudflare’s internal _cf_KV). Only 0001_sync.sql is recorded, applied 2026-10-05 14:20:59 UTC. H3 tables/index are absent.

Migration: migrations/0002_highlights.sql. SHA-256: fc4bd74c4f7d00a26de374259312e09a7c4e497d8dfd7b3d613d10650f18670e. Exact SQL:

```sql
-- Independent account counter and cursor index. No legacy query can read this stream.
-- Terminal tombstones are retained indefinitely; no article or News foreign key/cascade.
CREATE TABLE IF NOT EXISTS highlight_sync_users (
  user_id TEXT PRIMARY KEY,
  seq INTEGER NOT NULL DEFAULT 0
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS highlight_sync_records (
  user_id TEXT NOT NULL,
  highlight_id TEXT NOT NULL,
  value TEXT NOT NULL,
  updated_at REAL NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0,
  seq INTEGER NOT NULL,
  PRIMARY KEY (user_id, highlight_id)
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS highlight_sync_cursor ON highlight_sync_records (user_id, seq);
```

Adds two tables (highlight_sync_users, highlight_sync_records) and one index (highlight_sync_cursor). It leaves legacy tables, account identities, Saved/article metadata, reader counters, news tombstones and both existing cursors unchanged. Older clients remain on /api/sync and cannot query this separate stream. No DROP, DELETE, ALTER or reset.

Private backup: tools/news/.cache/production-release/private-backup/tars-sync-before-h3.sql, absolute path under this isolated worktree. SHA-256: 3242aceef809c836c0b435c5875ccde957bcdd273bd2a2b4a4ecf4cf98f42cf9; 23856 bytes; captured 2026-10-09T11:29:56.549Z. Time Travel bookmark: 0000007f-00000000-000050ff-7cbf103c4ea0f3640fefc6293fde0253. Backup is ignored/private and must never be committed or shared. It was restored into local in-memory SQLite; integrity_check returned ok; all three user rows, 65 legacy records and legacy schema remained exactly equal before/after this actual additive migration and a repeated local apply. Synthetic local workerd/D1/JWT checks separately exercise old/new stream interoperability and account isolation.

Recovery: rerun production-backup-verify.py to restore/check the preserved SQL privately without production writes. Before any later approved migration, take a fresh export and bookmark, verify its hash/restore and compare production migration status again (the current snapshot can become stale). Retain this export independently. Time Travel restore is available for seven days on Workers Free, but invoking a production restore can discard newer writes and needs separate owner approval and reconciliation. It was not executed. For an application failure, restore the known-good application or v2-with-H3 build; keep H3 tables, highlights/tombstones, legacy rows and cursors.

Billing: live signed-in dashboard confirms Workers Free and Teams Free Base active, no payment method. D1 metadata reports 73,728 bytes; export is only 23,856 bytes. Free caps fail rather than auto-bill. No plan/payment changes, paid resources, chargeable CI, scheduled polling or paid API were used. Current per-day usage must be checked again before any additional operation. Sources: [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/), [Pages Functions pricing](https://developers.cloudflare.com/pages/functions/pricing/).

When the systemic publication blocker is resolved, ask explicitly to approve **only migrations/0002_highlights.sql against this exact existing UUID**, after refreshing these checks. Application publication authorization does not authorize it.
