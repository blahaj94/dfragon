\set ON_ERROR_STOP on
SET ROLE dfragon_migrator;
GRANT SELECT, INSERT, UPDATE, DELETE
    ON public.users, public.auth_passkeys, public.auth_sessions, public.auth_refresh_tokens, public.auth_login_requests,
       public.characters, public.character_api_responses
    TO dfragon_api;
GRANT SELECT, INSERT, UPDATE
    ON public.item_catalog, public.skill_catalog, public.set_item_catalog
    TO dfragon_api;
