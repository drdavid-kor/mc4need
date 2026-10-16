#!/bin/sh
set -eu
mkdir -p .private/backups
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
if ! npx wrangler d1 export mc4need-db --remote --output ".private/backups/mc4need-$STAMP.sql" > ".private/backups/export-$STAMP.log" 2>&1; then
  printf '%s\n' 'Backup failed. Inspect the private export log locally; it may include a temporary signed download URL.'
  exit 1
fi
chmod 600 ".private/backups/export-$STAMP.log"
chmod 600 ".private/backups/mc4need-$STAMP.sql"
printf 'Backup saved locally: .private/backups/mc4need-%s.sql\n' "$STAMP"
