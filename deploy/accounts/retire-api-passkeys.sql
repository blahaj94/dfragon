-- Run on accounts only, with authentication writers stopped after every user has migrated.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '5s';
DO $$
BEGIN
    IF current_database() <> 'dfragon_accounts' THEN
        RAISE EXCEPTION 'Expected the accounts database';
    END IF;
END
$$;
LOCK TABLE public.users, public.auth_passkeys IN SHARE ROW EXCLUSIVE MODE;
DO $$
BEGIN
    IF EXISTS (
        SELECT FROM public.users AS u
        WHERE NOT EXISTS (
            SELECT FROM public.auth_passkeys AS p
            WHERE p.user_id = u.id AND p.rp_id = 'accounts.dfragon.com'
        )
    ) THEN
        RAISE EXCEPTION 'Every account must retain an accounts RP passkey';
    END IF;
END
$$;
DELETE FROM public.auth_passkeys WHERE rp_id = 'api.dfragon.com';
COMMIT;
