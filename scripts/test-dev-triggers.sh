#!/bin/bash
set -euo pipefail
root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
temporary=$(mktemp -d)
trap 'rm -f -- "$temporary/docker" "$temporary/input" "$temporary/calls"; rmdir -- "$temporary"' EXIT
cat >"$temporary/docker" <<'STUB'
#!/bin/bash
set -euo pipefail
printf '%s\n' "$*" >>"$TRIGGER_TEST_DIR/calls"
if [[ "$*" == *"exec -T backend"* ]]; then exit "${TRIGGER_TEST_PROFILE_EXIT:-0}"; fi
cat >"$TRIGGER_TEST_DIR/input"
exit "${TRIGGER_TEST_DB_EXIT:-0}"
STUB
chmod +x "$temporary/docker"
export PATH="$temporary:$PATH" TRIGGER_TEST_DIR="$temporary"
unset MYRI_DEV_DATABASE_CONFIRM
if bash "$root/scripts/dev-triggers.sh" disable >/dev/null 2>&1; then exit 1; fi
test ! -e "$temporary/calls"
export MYRI_DEV_DATABASE_CONFIRM=fictitious-data-only
if bash "$root/scripts/dev-triggers.sh" invalid >/dev/null 2>&1; then exit 1; fi
export TRIGGER_TEST_PROFILE_EXIT=1
if bash "$root/scripts/dev-triggers.sh" disable >/dev/null 2>&1; then exit 1; fi
test ! -e "$temporary/input"
export TRIGGER_TEST_PROFILE_EXIT=0
bash "$root/scripts/dev-triggers.sh" disable >/dev/null
test "$(grep -c '^DROP TRIGGER IF EXISTS' "$temporary/input")" -eq 16
! grep -q '^CREATE TRIGGER' "$temporary/input"
bash "$root/scripts/dev-triggers.sh" enable >/dev/null
test "$(grep -c '^CREATE TRIGGER' "$temporary/input")" -eq 16
grep -q 'DELIMITER' "$temporary/input"
grep -q 'database name must end in _dev or _test' "$temporary/calls"
export TRIGGER_TEST_DB_EXIT=1
if bash "$root/scripts/dev-triggers.sh" disable >/dev/null 2>&1; then exit 1; fi
printf 'Development trigger script checks passed.\n'
