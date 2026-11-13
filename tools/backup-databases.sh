#!/bin/sh
set -eu
umask 077
exec 9>/var/lock/pripyat-database-backup.lock
flock -n 9 || exit 0
dest=/var/backups/pripyat-database
stamp=$(date -u +%Y%m%dT%H%M%SZ)
# A failed snapshot is never published as a valid .sql.gz archive.
for db in stalker stalker_ok stalker_telegram stalker_test stalker_ok_test stalker_telegram_test stalker_site_test; do
 tmp="$dest/$db-$stamp.sql.tmp"
 trap 'rm -f -- "$tmp" "$tmp.gz"' EXIT HUP INT TERM
 mysqldump --single-transaction --quick --routines --events --triggers --hex-blob --set-gtid-purged=OFF --no-tablespaces "$db" > "$tmp"
 test -s "$tmp"
 gzip "$tmp"
 gzip -t "$tmp.gz"
 mv "$tmp.gz" "$dest/$db-$stamp.sql.gz"
 trap - EXIT HUP INT TERM
done
python3 - "$dest" "$stamp" <<'PY'
from pathlib import Path
import sys,json,hashlib,shutil
dest=Path(sys.argv[1]);stamp=sys.argv[2]
names=['stalker','stalker_ok','stalker_telegram','stalker_test','stalker_ok_test','stalker_telegram_test','stalker_site_test']
files=[dest/(db+'-'+stamp+'.sql.gz') for db in names]
ledger=dest/('privacy-ledger-'+stamp+'.json')
source=Path('/var/lib/pripyat-privacy/deletions.json')
ledger.write_bytes(source.read_bytes() if source.exists() else b'{"entries":{}}');ledger.chmod(0o600);files.append(ledger)
manifest={'stamp':stamp,'files':[{'name':p.name,'size':p.stat().st_size,'sha256':hashlib.file_digest(p.open('rb'),'sha256').hexdigest()} for p in files]}
tmp=dest/'latest.json.new';tmp.write_text(json.dumps(manifest));tmp.chmod(0o600);tmp.replace(dest/'latest.json')
PY
