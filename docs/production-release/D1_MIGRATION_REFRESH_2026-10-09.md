# Production D1 migration checkpoint — refreshed 2026-10-09

Supersedes the snapshot in D1_MIGRATION_CHECKPOINT.md, which is kept unchanged. Everything below was read from production on 2026-10-09 between 13:55 and 14:00 UTC with read-only commands. No production write had occurred when this was recorded.

## Identity and current state

- Account `5d8f8fb2f5df3b6125098fe367cab4f9`; Pages project `tars-atlas-news` (`tars-atlas-news.pages.dev`, Git provider: none, direct upload); binding `SYNC_DB`.
- Database `tars-sync`, UUID `824fd651-a92c-4716-a618-232624fa5bcc`, region APAC, 73.7 kB.
- Live schema: `sync_users`, `sync_records`, index `sync_records_cursor`, `d1_migrations` (plus SQLite/Cloudflare internals). No `highlight_*` object exists.
- `d1_migrations`: only `0001_sync.sql`, applied 2026-10-05 14:20:59 UTC. Wrangler lists exactly one pending migration: `0002_highlights.sql`.
- Rows: 3 accounts, 65 records (article 3, news 53, reader 3, recall 2, settings 4), of which 8 are tombstones.
- Unauthenticated requests to the origin and to `/api/session`, `/api/sync`, `/api/highlights-sync` and `/api/current-affairs` all redirect to the Access login.

## Migration

`migrations/0002_highlights.sql`, SHA-256 `fc4bd74c4f7d00a26de374259312e09a7c4e497d8dfd7b3d613d10650f18670e`, byte-identical to the reviewed file. Three `CREATE … IF NOT EXISTS` statements: tables `highlight_sync_users` and `highlight_sync_records`, index `highlight_sync_cursor`. No DROP, DELETE, ALTER, UPDATE or INSERT; no statement names a legacy table.

## Fresh backup and restoration

- Private export: `C:\Users\hario\tars-private-backups\20261009T135857Z\tars-sync-before-h3.sql`, 23,732 bytes, SHA-256 `fe0aecaef1024f32cab835791b7542fd014a1d83395607ed913038f8f48f02d2`. Outside every Git checkout; never to be committed or shared.
- Time Travel bookmark taken immediately before the export: `00000081-00000000-000050ff-7e2c514383f6f12af23172fc5391c2cf`.
- Restored into in-memory SQLite: `integrity_check` ok; 3 accounts, 65 records, 8 tombstones and the single applied migration, equal to the live counts above.
- The exact migration applied to the restored copy, then applied again: legacy row digests and legacy schema digest identical before, after and after the repeat; only the three highlight objects were added; `integrity_check` ok. The same folder holds `restore-verification.json` (counts and digests only).

## Free-plan limits

Cloudflare’s D1 pricing page, read 2026-10-09: Workers Free allows 5 million rows read and 100,000 rows written per day and 5 GB storage; when a daily limit is reached queries fail until 00:00 UTC and the account is not billed. The last 24 hours used 259 rows read and 12 rows written. The migration creates two empty tables and one index. The plan and absence of a payment method were confirmed in the dashboard earlier the same day (dashboard-preflight.json); the CLI login cannot read billing.

## Recovery

Application failure: publish the v2-with-H3 build or roll back the Pages deployment; leave the highlight tables in place (older clients never query them). Data failure: the export above restores the legacy tables; a Time Travel restore to the bookmark is available for seven days on Workers Free but discards later writes and needs separate owner approval.

## Applied

Owner approval for exactly this migration against this UUID was given on 2026-10-09 after the evidence above. `wrangler d1 migrations apply tars-sync --remote` executed four commands at about 14:05 UTC. Read back afterwards: `d1_migrations` lists `0001_sync.sql` and `0002_highlights.sql`; `highlight_sync_users`, `highlight_sync_records` and `highlight_sync_cursor` exist with zero highlight rows; legacy counts are unchanged at 3 accounts, 65 records and 8 tombstones. Bookmark after the migration: `00000082-00000004-000050ff-715f012505e385f3cea1a449e9793f61`.
