#!/bin/bash
set -euo pipefail

# This runs only for an empty PostgreSQL volume. Application tables are created
# separately by the existing compiled migration command.
psql --no-psqlrc --set=ON_ERROR_STOP=1 --username=postgres --dbname=dfragon <<'SQL'
CREATE ROLE dfragon_migrator LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
CREATE ROLE dfragon_api LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
REVOKE ALL ON DATABASE dfragon FROM PUBLIC;
GRANT CONNECT ON DATABASE dfragon TO dfragon_migrator, dfragon_api;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
ALTER SCHEMA public OWNER TO dfragon_migrator;
GRANT USAGE ON SCHEMA public TO dfragon_api;
SQL

# psql's password command encrypts client-side and avoids plaintext SQL/history.
for dfragon_role in dfragon_migrator dfragon_api; do
    dfragon_password=$(cat "/run/secrets/${dfragon_role}_password")
    printf '%s\n%s\n' "$dfragon_password" "$dfragon_password" |
        psql --no-psqlrc --set=ON_ERROR_STOP=1 --username=postgres --dbname=dfragon \
            --command="\\password ${dfragon_role}"
    unset dfragon_password
done
