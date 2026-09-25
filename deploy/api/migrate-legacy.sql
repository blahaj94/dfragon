-- Explicit administration step on an isolated, copied cluster; connect to postgres.
-- No application table or credential is rewritten. Rename preserves role OIDs and ACLs.
\set ON_ERROR_STOP on
BEGIN;
DO $$
BEGIN
    IF current_database() <> 'postgres'
       OR NOT EXISTS (SELECT FROM pg_database WHERE datname = 'ldb')
       OR EXISTS (SELECT FROM pg_database WHERE datname = 'dfragon')
       OR (SELECT count(*) FROM pg_roles WHERE rolname IN ('ldb_api', 'ldb_migrator')) <> 2
       OR EXISTS (SELECT FROM pg_roles WHERE rolname IN ('dfragon_api', 'dfragon_migrator', 'dfragon_viewer'))
       OR EXISTS (SELECT FROM pg_roles WHERE rolname LIKE 'ldb\_%' ESCAPE '\' AND rolname NOT IN ('ldb_api', 'ldb_migrator', 'ldb_viewer'))
       OR EXISTS (SELECT FROM pg_stat_activity WHERE datname = 'ldb') THEN
        RAISE EXCEPTION 'Legacy database rename precondition failed';
    END IF;
    -- MD5 passwords contain the old role name and would be cleared by PostgreSQL.
    IF EXISTS (
        SELECT FROM pg_authid
        WHERE rolname IN ('ldb_api', 'ldb_migrator', 'ldb_viewer')
          AND rolcanlogin AND (rolpassword IS NULL OR rolpassword NOT LIKE 'SCRAM-SHA-256$%')
    ) THEN
        RAISE EXCEPTION 'Legacy role password format is not supported';
    END IF;
END
$$;
ALTER DATABASE ldb RENAME TO dfragon;
ALTER ROLE ldb_migrator RENAME TO dfragon_migrator;
ALTER ROLE ldb_api RENAME TO dfragon_api;
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'ldb_viewer') THEN
        ALTER ROLE ldb_viewer RENAME TO dfragon_viewer;
    END IF;
END
$$;
COMMIT;
