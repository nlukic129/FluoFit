-- 0002 — identity. One Supabase Auth project; a profile keys to auth.users.
-- roles is an array from day 1 (ARCHITECTURE §1). Prospect/Member/Lapsed is DERIVED
-- from a person's subscriptions, never a stored column.

create table profiles (
  id               uuid primary key references auth.users(id) on delete cascade,
  roles            app_role[]  not null default '{member}',
  account_timezone text        not null default 'Europe/Belgrade',  -- Streak day boundary (CONTEXT: Streak)
  display_name     text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create trigger trg_profiles_updated_at before update on profiles
  for each row execute function set_updated_at();

-- RLS helper: is the current user an Admin? Used across policies.
create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select 'admin'::app_role = any(roles) from profiles where id = auth.uid()), false)
$$;
