#!/bin/sh
set -eu
: "${APP_TIMEZONE:=Europe/Rome}"
case "$APP_TIMEZONE" in
  ''|*[!A-Za-z0-9_+/-]*) printf 'Invalid APP_TIMEZONE.\n' >&2; exit 1 ;;
esac
printf '{"timezone":"%s"}\n' "$APP_TIMEZONE" > /tmp/myri-config.json
