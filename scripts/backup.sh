#!/bin/bash
set -euo pipefail
umask 077

root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
directory=${BACKUP_DIR:-"$root/backups"}
retention=${BACKUP_RETENTION:-14}
env_file=${MYRI_ENV_FILE:-"$root/.env"}
if [[ ! "$retention" =~ ^[1-9][0-9]{0,3}$ ]] || (( retention > 3650 )); then
    printf 'BACKUP_RETENTION must be an integer from 1 to 3650.\n' >&2
    exit 1
fi
if [[ -L "$directory" ]]; then
    printf 'Backup directory must not be a symbolic link.\n' >&2
    exit 1
fi
mkdir -p -- "$directory"
directory=$(cd -- "$directory" && pwd -P)
if [[ ! -O "$directory" ]] || (( (8#$(stat -c '%a' "$directory") & 077) != 0 )); then
    printf 'Backup directory must be owned by the current user with mode 700.\n' >&2
    exit 1
fi
if [[ -L "$directory/.backup.lock" ]]; then
    printf 'Invalid backup lock file.\n' >&2
    exit 1
fi
exec 9>"$directory/.backup.lock"
if ! flock -n 9; then
    printf 'A backup is already running.\n' >&2
    exit 1
fi
temporary=$(mktemp "$directory/myri-$(date -u +%Y%m%dT%H%M%S%NZ)-XXXXXXXX.sql.gz.partial")
listing=$(mktemp "$directory/.retention-XXXXXXXX")
trap 'rm -f -- "$temporary" "$listing"' EXIT

# Credentials are expanded only inside the DB container, never as host CLI arguments.
if ! docker compose --project-directory "$root" --env-file "$env_file" exec -T db sh -c '
    MYSQL_PWD="$DB_MIGRATION_PASSWORD" exec mysqldump \
      --user="$DB_MIGRATION_USERNAME" --protocol=SOCKET \
      --single-transaction --skip-lock-tables --no-tablespaces \
      --set-gtid-purged=OFF --hex-blob --triggers -- "$MYSQL_DATABASE"
    ' | gzip -c >"$temporary"; then
    printf 'Database backup failed; retention was not applied.\n' >&2
    exit 1
fi
gzip -t -- "$temporary"
final=${temporary%.partial}
mv -- "$temporary" "$final"

# Only completed backups created by this script are retention candidates.
find "$directory" -maxdepth 1 -type f -name 'myri-*.sql.gz' -printf '%f\n' | LC_ALL=C sort -r >"$listing"
mapfile -t files <"$listing"
kept=0
for file in "${files[@]}"; do
    if [[ "$file" =~ ^myri-[0-9]{8}T[0-9]{15}Z-[A-Za-z0-9]{8}\.sql\.gz$ ]]; then
        ((kept+=1))
        if (( kept > retention )); then rm -- "$directory/$file"; fi
    fi
done
printf 'Backup completed: %s\n' "$final"
