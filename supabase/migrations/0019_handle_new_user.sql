-- 0019 — auto-provision a profile row whenever an auth user is created (OTP, social, or admin
-- "Add user"). Without this, OTP-based logins (admin/partners) leave profiles empty and
-- is_admin()/RLS have nothing to read. The member checkout also upserts a profile — harmless
-- overlap (on conflict do nothing).
create or replace function handle_new_user()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
