-- Table privileges for the API roles. Earlier migrations only granted
-- `execute` on functions and relied on Supabase's default table grants. The
-- local CLI stack still adds those defaults, but hosted projects no longer do,
-- so there every table read (even with the service-role key) failed with
-- "permission denied" (HTTP 403 on /rest/v1/members at first sign-in).
--
-- Row-level security still decides which rows `authenticated` sees; these
-- grants only let the role reach the tables at all. `service_role` bypasses
-- RLS and is used by server code only (workspace bootstrap). `anon` gets
-- nothing: the app reads no table before sign-in.

grant usage on schema public to authenticated, service_role;

grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;

-- Tables and sequences added by later migrations (run as `postgres`) get the same.
alter default privileges for role postgres in schema public
  grant select, insert, update, delete on tables to authenticated, service_role;
alter default privileges for role postgres in schema public
  grant usage, select on sequences to authenticated, service_role;
