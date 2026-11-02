#!/bin/bash
set -euo pipefail

if [[ ! "${MYSQL_DATABASE}" =~ ^[a-z][a-z0-9_]{0,63}$ ]] \
    || [[ ! "${DB_USERNAME}" =~ ^[a-z][a-z0-9_]{0,31}$ ]] \
    || [[ ! "${DB_MIGRATION_USERNAME}" =~ ^[a-z][a-z0-9_]{0,31}$ ]] \
    || [[ "${DB_USERNAME}" == "${DB_MIGRATION_USERNAME}" ]] \
    || [[ "${DB_USERNAME}" == root ]] || [[ "${DB_MIGRATION_USERNAME}" == root ]]; then
    printf 'Invalid database/account names; distinct non-root accounts required.\n' >&2
    exit 1
fi

: "${DB_PASSWORD:?Runtime password required}"
: "${DB_MIGRATION_PASSWORD:?Migration password required}"
: "${MYSQL_ROOT_PASSWORD:?Root initialization password required}"

# NO_BACKSLASH_ESCAPES makes doubling quotes sufficient, including for passwords with backslashes.
runtime_password=$(printf '%s' "${DB_PASSWORD}" | sed "s/'/''/g")
migration_password=$(printf '%s' "${DB_MIGRATION_PASSWORD}" | sed "s/'/''/g")
MYSQL_PWD="${MYSQL_ROOT_PASSWORD}" mysql --protocol=SOCKET -uroot <<SQL
SET SESSION sql_mode = 'NO_BACKSLASH_ESCAPES';
CREATE USER '${DB_USERNAME}'@'%' IDENTIFIED BY '${runtime_password}';
CREATE USER '${DB_MIGRATION_USERNAME}'@'%' IDENTIFIED BY '${migration_password}';
GRANT CREATE, ALTER, INDEX, REFERENCES, TRIGGER, SELECT, INSERT, UPDATE
    ON \`${MYSQL_DATABASE}\`.* TO '${DB_MIGRATION_USERNAME}'@'%' WITH GRANT OPTION;
SQL
unset runtime_password migration_password
