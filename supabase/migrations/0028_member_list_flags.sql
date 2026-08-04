-- 0028 — the member list gains a `p_flag` cohort filter so the Summary "Needs attention" cards
-- can deep-link to exactly the problematic members:
--   lapse_risk    → active subs whose benefit clock expires within 5 days
--   smart_pending → smart subs still in the 'pending' substate (paid, never scanned)
create or replace function fn_admin_list_members(
  p_query text default null,
  p_status text default null,
  p_city text default null,
  p_limit int default 20,
  p_offset int default 0,
  p_flag text default null
) returns table(
  profile_id uuid, email text, display_name text, sub_status text, city text,
  created_at timestamptz, total_count bigint
)
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not authorized' using errcode = 'insufficient_privilege'; end if;
  return query
    with base as (
      select p.id as pid, u.email::text as em, p.display_name as dn, p.created_at as ca,
             ls.status::text as st, ls.ship_city as ct,
             ls.benefit_clock_expires_at as bce, ls.refill_mode::text as rm, ls.smart_substate::text as ss
        from profiles p
        join auth.users u on u.id = p.id
        left join lateral (
          select s.status, s.ship_city, s.benefit_clock_expires_at, s.refill_mode, s.smart_substate
            from subscriptions s where s.owner_profile_id = p.id order by s.created_at desc limit 1
        ) ls on true
    )
    select pid, em, dn, st, ct, ca, count(*) over()
      from base
     where (p_query is null or em ilike '%' || p_query || '%' or coalesce(dn, '') ilike '%' || p_query || '%')
       and (p_status is null or (p_status = 'prospect' and st is null) or st = p_status)
       and (p_city is null or ct = p_city)
       and (p_flag is null
            or (p_flag = 'lapse_risk' and st = 'active' and bce between now() and now() + interval '5 days')
            or (p_flag = 'smart_pending' and rm = 'smart' and ss = 'pending'))
     order by ca desc
     limit p_limit offset p_offset;
end $$;
