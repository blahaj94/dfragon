#!/bin/bash
set -euo pipefail

# This runs only for an empty PostgreSQL volume. Application tables are created
# separately by the existing compiled migration command.
psql --no-psqlrc --set=ON_ERROR_STOP=1 --username=postgres --dbname=dfragon_accounts <<'SQL'
CREATE ROLE dfragon_accounts_migrator LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
CREATE ROLE dfragon_accounts LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
REVOKE ALL ON DATABASE dfragon_accounts FROM PUBLIC;
GRANT CONNECT ON DATABASE dfragon_accounts TO dfragon_accounts_migrator, dfragon_accounts;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
ALTER SCHEMA public OWNER TO dfragon_accounts_migrator;
GRANT USAGE ON SCHEMA public TO dfragon_accounts;
SQL

# psql's password command encrypts client-side and avoids plaintext SQL/history.
for dfragon_role in dfragon_accounts_migrator dfragon_accounts; do
    dfragon_password=$(cat "/run/secrets/${dfragon_role}_password")
    printf '%s\n%s\n' "$dfragon_password" "$dfragon_password" |
        psql --no-psqlrc --set=ON_ERROR_STOP=1 --username=postgres --dbname=dfragon_accounts \
            --command="\\password ${dfragon_role}"
    unset dfragon_password
done
