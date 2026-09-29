#!/bin/sh
set -eu

# Defaults only: TypeScript validates and reads explicit ENV or FILE inputs.
if [ "${DB_PASSWORD+x}" != x ] && [ "${DB_PASSWORD_FILE+x}" != x ]; then
    export DB_PASSWORD_FILE=/run/secrets/db_password
fi

exec "$@"
