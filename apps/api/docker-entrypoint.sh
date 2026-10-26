#!/bin/sh
set -eu

# Defaults only: TypeScript validates and reads explicit ENV or FILE inputs.
if [ "${NEOPLE_API_KEY+x}" != x ] && [ "${NEOPLE_API_KEY_FILE+x}" != x ]; then
    export NEOPLE_API_KEY_FILE=/run/secrets/neople_api_key
fi

exec "$@"
