"""Restore the private export locally and prove the actual additive SQL preserves legacy rows."""
import hashlib
import json
import sqlite3
from pathlib import Path

private = Path('tools/news/.cache/production-release/private-backup')
backup = json.loads((private / 'backup.private.json').read_text(encoding='utf-8'))
sql_path = Path(backup['filename'])
assert hashlib.sha256(sql_path.read_bytes()).hexdigest() == backup['sha256']
connection = sqlite3.connect(':memory:')
connection.executescript(sql_path.read_text(encoding='utf-8'))
tables = ['d1_migrations', 'sync_users', 'sync_records']
before = {table: connection.execute(f'SELECT * FROM "{table}" ORDER BY 1,2').fetchall() for table in tables}
assert len(before['sync_users']) == 3
assert len(before['sync_records']) == 65
assert connection.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
legacy_schema = connection.execute("SELECT type,name,sql FROM sqlite_schema WHERE name LIKE 'sync_%' ORDER BY name").fetchall()
migration = Path('migrations/0002_highlights.sql').read_text(encoding='utf-8')
connection.executescript(migration)
for table in tables:
    assert connection.execute(f'SELECT * FROM "{table}" ORDER BY 1,2').fetchall() == before[table], table
assert connection.execute("SELECT type,name,sql FROM sqlite_schema WHERE name LIKE 'sync_%' ORDER BY name").fetchall() == legacy_schema
assert connection.execute('SELECT COUNT(*) FROM highlight_sync_users').fetchone()[0] == 0
assert connection.execute('SELECT COUNT(*) FROM highlight_sync_records').fetchone()[0] == 0
assert connection.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
assert connection.execute("SELECT name FROM sqlite_schema WHERE type='index' AND name='highlight_sync_cursor'").fetchone()
# Execute the exact additive SQL again to verify IF NOT EXISTS is harmless locally.
connection.executescript(migration)
for table in tables:
    assert connection.execute(f'SELECT * FROM "{table}" ORDER BY 1,2').fetchall() == before[table]
output = {
    'databaseId': backup['databaseId'], 'accountId': backup['accountId'], 'binding': backup['binding'],
    'backupLocation': backup['filename'], 'backupSha256': backup['sha256'], 'backupBytes': backup['size'],
    'bookmark': backup['bookmark'], 'backupCreatedAt': backup['createdAt'],
    'migrationFilename': 'migrations/0002_highlights.sql',
    'migrationSha256': hashlib.sha256(Path('migrations/0002_highlights.sql').read_bytes()).hexdigest(),
    'existingMigrations': [{'id': 1, 'name': '0001_sync.sql', 'applied_at': '2026-10-05 14:20:59'}],
    'legacyUsers': 3, 'legacyRows': 65, 'legacyRowsAndSchemaIdenticalAfterMigration': True,
    'privateExportRestoredLocally': True, 'localIntegrityCheck': 'ok', 'localIdempotence': True,
    'newTables': ['highlight_sync_users', 'highlight_sync_records'], 'newIndexes': ['highlight_sync_cursor'],
    'productionMigrationApplied': False,
    'limitations': 'Export snapshot restored into in-memory SQLite; actual workerd/D1/JWT behavior verified separately with synthetic accounts. Production Time Travel restore not executed; would need owner approval and a plan for later writes. No user values or account identities logged.'
}
Path('docs/production-release/backup-verification.json').write_text(json.dumps(output, indent=2) + '\n', encoding='utf-8', newline='\n')
print(json.dumps(output))
