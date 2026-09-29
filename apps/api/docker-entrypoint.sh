#!/bin/sh
set -eu

# Adapt mounted secrets to the existing runtime inputs without printing their values.
if ! DB_PASSWORD=$(cat /run/secrets/db_password); then
    echo 'API database secret could not be read' >&2
    exit 1
fi
export DB_PASSWORD

if [ -f /run/secrets/neople_api_key ]; then
    if ! NEOPLE_API_KEY=$(cat /run/secrets/neople_api_key); then
        echo 'API search secret could not be read' >&2
        exit 1
    fi
    export NEOPLE_API_KEY
fi

exec "$@"
