ALTER TABLE needs ADD COLUMN cover_revision TEXT;
CREATE TABLE need_covers (
  need_id TEXT PRIMARY KEY REFERENCES needs(id),
  data BLOB NOT NULL,
  updated_at INTEGER NOT NULL
);
