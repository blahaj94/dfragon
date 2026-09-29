#!/bin/sh
set -eu
if ! DB_PASSWORD=$(cat /run/secrets/db_password); then
    echo 'Accounts database secret could not be read' >&2
    exit 1
fi
export DB_PASSWORD
exec "$@"
