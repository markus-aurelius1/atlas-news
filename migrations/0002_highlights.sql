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
