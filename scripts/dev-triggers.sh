#!/bin/bash
set -euo pipefail

root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
action=${1:-}
if [[ "$action" != disable && "$action" != enable ]]; then
    printf 'Usage: bash scripts/dev-triggers.sh disable|enable\n' >&2
    exit 1
fi
if [[ "${MYRI_DEV_DATABASE_CONFIRM:-}" != fictitious-data-only ]]; then
    printf 'Requires MYRI_DEV_DATABASE_CONFIRM=fictitious-data-only. Never use on real data.\n' >&2
    exit 1
fi
compose=(docker compose --project-directory "$root" --env-file "${MYRI_ENV_FILE:-"$root/.env"}")
if ! "${compose[@]}" exec -T backend sh -c '
    case ",${SPRING_PROFILES_ACTIVE:-}," in *,dev,*) exit 0 ;; *) exit 1 ;; esac
'; then
    printf 'Refusing: the running backend must explicitly use the dev profile.\n' >&2
    exit 1
fi

mysql_command='
    case "$MYSQL_DATABASE" in *_dev|*_test) ;; *) echo "Refusing: database name must end in _dev or _test." >&2; exit 1 ;; esac
    MYSQL_PWD="$DB_MIGRATION_PASSWORD" exec mysql --protocol=SOCKET \
      --user="$DB_MIGRATION_USERNAME" --database="$MYSQL_DATABASE" --batch --skip-column-names
'
migrations="$root/backend/src/main/resources/db/migration"
{
    migration="$migrations/V2__protect_history_and_prevent_physical_deletes.sql"
    awk '/^CREATE TRIGGER / { print "DROP TRIGGER IF EXISTS `" $3 "`;" }' "$migration"
    if [[ "$action" == enable ]]; then
        cat "$migration"
    fi
} | "${compose[@]}" exec -T db sh -c "$mysql_command"

printf 'Development triggers: %s completed. Runtime grants and API rules are unchanged.\n' "$action"
