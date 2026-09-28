\set ON_ERROR_STOP on
SET ROLE dfragon_accounts_migrator;
GRANT SELECT, INSERT, UPDATE, DELETE
    ON public.users, public.auth_passkeys, public.auth_sessions, public.auth_refresh_tokens,
       public.auth_login_requests TO dfragon_accounts;
