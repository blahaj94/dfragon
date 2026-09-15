#!/bin/bash
set -euo pipefail

# This runs only for an empty PostgreSQL volume. Application tables are created
# separately by the existing compiled migration command.
psql --no-psqlrc --set=ON_ERROR_STOP=1 --username=postgres --dbname=ldb <<'SQL'
CREATE ROLE ldb_migrator LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
CREATE ROLE ldb_api LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
REVOKE ALL ON DATABASE ldb FROM PUBLIC;
GRANT CONNECT ON DATABASE ldb TO ldb_migrator, ldb_api;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
ALTER SCHEMA public OWNER TO ldb_migrator;
GRANT USAGE ON SCHEMA public TO ldb_api;
SQL

# psql's password command encrypts client-side and avoids plaintext SQL/history.
for ldb_role in ldb_migrator ldb_api; do
    ldb_password=$(cat "/run/secrets/${ldb_role}_password")
    printf '%s\n%s\n' "$ldb_password" "$ldb_password" |
        psql --no-psqlrc --set=ON_ERROR_STOP=1 --username=postgres --dbname=ldb \
            --command="\\password ${ldb_role}"
    unset ldb_password
done
