-- Run on the frozen domain DB only after checking every source user in accounts with a current RP key.
-- The caller must stop authentication writers and verify the accounts DB first.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '5s';
DO $$
BEGIN
    IF current_database() <> 'dfragon'
       OR EXISTS (
           SELECT FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'auth_passkeys' AND column_name = 'rp_id'
       ) THEN
        RAISE EXCEPTION 'Expected the frozen API authentication schema';
    END IF;
    IF EXISTS (
        SELECT FROM unnest(ARRAY['users','auth_passkeys','auth_sessions','auth_refresh_tokens','auth_login_requests']) AS t(name)
        WHERE to_regclass('public.' || t.name) IS NULL
    ) THEN
        RAISE EXCEPTION 'Source authentication tables are already absent or incomplete';
    END IF;
    IF EXISTS (
        SELECT FROM unnest(ARRAY['users','auth_passkeys','auth_sessions','auth_refresh_tokens','auth_login_requests']) AS t(name)
        WHERE has_table_privilege('dfragon_api', 'public.' || t.name, 'SELECT,INSERT,UPDATE,DELETE')
    ) THEN
        RAISE EXCEPTION 'The domain runtime must have no authentication privileges';
    END IF;
END
$$;
LOCK TABLE public.users, public.auth_passkeys, public.auth_sessions, public.auth_refresh_tokens, public.auth_login_requests IN ACCESS EXCLUSIVE MODE;
-- No CASCADE: an unexpected dependency must stop the transaction, not remove other data.
DROP TABLE public.auth_refresh_tokens, public.auth_sessions, public.auth_login_requests, public.auth_passkeys, public.users;
COMMIT;
