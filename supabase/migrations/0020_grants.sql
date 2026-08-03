-- 0020 — role grants. RLS policies gate ROWS, but the anon/authenticated roles still need
-- table/function GRANTs or PostgREST returns "permission denied for table". This mirrors the
-- standard Supabase setup and was missing. RLS (0011) remains the actual row-level gate.

grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;
grant execute on all functions in schema public to anon, authenticated, service_role;

-- Future objects created in public inherit the same grants.
alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant usage, select on sequences to anon, authenticated, service_role;
alter default privileges in schema public
  grant execute on functions to anon, authenticated, service_role;
