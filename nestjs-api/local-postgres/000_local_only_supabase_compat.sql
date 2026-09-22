-- Chỉ dùng cho PostgreSQL cục bộ do Docker Compose quản lý.
-- Không chạy file này trên Supabase hoặc bất kỳ database production nào.

DO $guard$
BEGIN
  IF current_database() NOT IN ('martial_arts_tracker', 'martial_arts_tracker_e2e') THEN
    RAISE EXCEPTION 'Bootstrap Supabase tương thích chỉ được phép chạy trên database Compose cục bộ';
  END IF;
END
$guard$;

DO $roles$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
END
$roles$;

CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE IF NOT EXISTS auth.users (
  id UUID PRIMARY KEY
);

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS UUID
LANGUAGE sql
STABLE
SET search_path = ''
AS $function$
  SELECT nullif(pg_catalog.current_setting('request.jwt.claim.sub', true), '')::UUID
$function$;

REVOKE ALL ON SCHEMA auth FROM PUBLIC;
REVOKE ALL ON TABLE auth.users FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION auth.uid() FROM PUBLIC;
GRANT USAGE ON SCHEMA auth TO anon, authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;
