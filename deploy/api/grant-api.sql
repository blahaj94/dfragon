\set ON_ERROR_STOP on
SET ROLE ldb_migrator;
GRANT SELECT, INSERT, UPDATE, DELETE
    ON public.users, public.auth_sessions, public.auth_refresh_tokens, public.auth_login_requests,
       public.characters, public.character_api_responses
    TO ldb_api;
