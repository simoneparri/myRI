#!/bin/bash
set -euo pipefail
umask 077

root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
work=$(mktemp -d)
trap 'rm -f -- "$work/bin/docker" "$work/backups/"* "$work/backups/.backup.lock" "$work/output" "$work/link"; rmdir -- "$work/bin" "$work/backups" "$work"' EXIT
mkdir -- "$work/bin" "$work/backups"
cat >"$work/bin/docker" <<'STUB'
#!/bin/bash
if [[ ${BACKUP_TEST_FAILURE:-false} == true ]]; then exit 1; fi
printf 'Fictitious dump fixture only.\n'
STUB
chmod 700 "$work/bin/docker"
export PATH="$work/bin:$PATH" BACKUP_DIR="$work/backups" BACKUP_RETENTION=2

bash "$root/scripts/backup.sh" >"$work/output"
oldest=$(find "$BACKUP_DIR" -name '*.sql.gz' -printf '%f')
for i in 2 3; do bash "$root/scripts/backup.sh" >"$work/output"; done
[[ $(find "$BACKUP_DIR" -name '*.sql.gz' | wc -l) == 2 ]]
[[ ! -e "$BACKUP_DIR/$oldest" ]]
while IFS= read -r file; do
    [[ $(stat -c '%a' "$file") == 600 ]]
    gzip -t -- "$file"
done < <(find "$BACKUP_DIR" -name '*.sql.gz')
[[ $(stat -c '%a' "$BACKUP_DIR") == 700 ]]
before=$(find "$BACKUP_DIR" -name '*.sql.gz' -printf '%f\n' | sort)
if BACKUP_TEST_FAILURE=true bash "$root/scripts/backup.sh" >"$work/output" 2>&1; then exit 1; fi
[[ "$before" == "$(find "$BACKUP_DIR" -name '*.sql.gz' -printf '%f\n' | sort)" ]]
[[ $(find "$BACKUP_DIR" -name '*.partial' | wc -l) == 0 ]]
for value in 0 -1 abc 01 3651; do
    if BACKUP_RETENTION="$value" bash "$root/scripts/backup.sh" >"$work/output" 2>&1; then exit 1; fi
done
chmod 755 "$BACKUP_DIR"
if bash "$root/scripts/backup.sh" >"$work/output" 2>&1; then exit 1; fi
chmod 700 "$BACKUP_DIR"
ln -s -- "$BACKUP_DIR" "$work/link"
if BACKUP_DIR="$work/link" bash "$root/scripts/backup.sh" >"$work/output" 2>&1; then exit 1; fi
exec 8>"$BACKUP_DIR/.backup.lock"
flock -n 8
if bash "$root/scripts/backup.sh" >"$work/output" 2>&1; then exit 1; fi
flock -u 8
printf 'Backup tests passed: retention, permissions, lock, validation and failure cleanup.\n'
