-- Run after stopping the OLD API, cleanup and authentication traffic. Do not run on accounts DB.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '5s';
DO $$
BEGIN
    IF current_database() <> 'dfragon'
       OR EXISTS (SELECT FROM pg_stat_activity WHERE usename = 'dfragon_api' AND pid <> pg_backend_pid())
       OR EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'auth_passkeys' AND column_name = 'rp_id') THEN
        RAISE EXCEPTION 'Stop legacy authentication writers and verify the source database first';
    END IF;
END
$$;
LOCK TABLE public.users, public.auth_passkeys, public.auth_sessions, public.auth_refresh_tokens, public.auth_login_requests IN ACCESS EXCLUSIVE MODE;
REVOKE ALL ON public.users, public.auth_passkeys, public.auth_sessions, public.auth_refresh_tokens, public.auth_login_requests FROM dfragon_api, PUBLIC;
DO $$
BEGIN
    IF EXISTS (
        SELECT FROM unnest(ARRAY['users','auth_passkeys','auth_sessions','auth_refresh_tokens','auth_login_requests']) AS t(name)
        WHERE has_table_privilege('dfragon_api', 'public.' || t.name, 'SELECT,INSERT,UPDATE,DELETE')
    ) THEN
        RAISE EXCEPTION 'Inherited authentication privileges must be removed before copying';
    END IF;
END
$$;
COMMIT;
