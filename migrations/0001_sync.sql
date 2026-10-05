-- Sync storage. One row per (account, collection, key); `seq` numbers an account's accepted rows so a device
-- reads only what it has not seen, through the (user_id, seq) index. `updated_at` is the client change time
-- that decides conflicts; `deleted = 1` rows are tombstones and carry no value.
CREATE TABLE IF NOT EXISTS sync_users (
  user_id TEXT PRIMARY KEY,
  seq INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS sync_records (
  user_id TEXT NOT NULL,
  collection TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT,
  updated_at INTEGER NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0,
  seq INTEGER NOT NULL,
  PRIMARY KEY (user_id, collection, key)
) WITHOUT ROWID;

CREATE INDEX IF NOT EXISTS sync_records_cursor ON sync_records (user_id, seq);
