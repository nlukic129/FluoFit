-- 0031 — commission clearing engine: after the 30-day hold with no clawback, an accrued
-- commission matures to 'payable' automatically. Run daily by pg_cron (scheduled separately);
-- also callable by an admin. Cron runs with no JWT (auth.uid() null) → allowed; a logged-in
-- non-admin is blocked.
create or replace function fn_clear_due_commissions()
returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if auth.uid() is not null and not is_admin() then
    raise exception 'not authorized' using errcode = 'insufficient_privilege';
  end if;
  update commissions
     set state = 'payable', cleared_at = now()
   where state = 'accrued' and hold_until is not null and hold_until < now();
  get diagnostics n = row_count;
  return n;
end $$;
