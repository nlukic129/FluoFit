-- 0037 — Members as a support console (grill 2026-08). Internal admin notes + a triage-friendly
-- list (level / last-active / lifetime spend + sortable). Notes are admin-only via RPC (RLS on,
-- no direct policy → forced through the SECURITY DEFINER helpers).

create table if not exists member_notes (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id),
  author_id  uuid references profiles(id),
  body       text not null check (length(trim(body)) > 0),
  created_at timestamptz not null default now()
);
create index if not exists idx_member_notes_profile on member_notes(profile_id, created_at desc);
alter table member_notes enable row level security;

-- Enrich the member list for triage: level, last-active, lifetime spend + a sort key.
-- (OUT-column change → drop old signature first.)
drop function if exists fn_admin_list_members(text, text, text, int, int, text);
create function fn_admin_list_members(
  p_query text default null,
  p_status text default null,
  p_city text default null,
  p_limit int default 20,
  p_offset int default 0,
  p_flag text default null,
  p_sort text default 'joined'
) returns table(
  profile_id uuid, email text, display_name text, sub_status text, city text,
  created_at timestamptz, current_level int, last_active date, lifetime_spend numeric,
  total_count bigint
)
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not authorized' using errcode = 'insufficient_privilege'; end if;
  return query
    with base as (
      select p.id as pid, u.email::text as em, p.display_name as dn, p.created_at as ca,
             ls.status::text as st, ls.ship_city as ct,
             ls.benefit_clock_expires_at as bce, ls.refill_mode::text as rm, ls.smart_substate::text as ss,
             exists (select 1 from sachet_scans sc where sc.profile_id = p.id and sc.earned) as has_scans,
             coalesce(mp.current_level, 1) as lvl,
             mp.last_earning_date as la,
             coalesce((select sum(o.amount) from orders o join subscriptions s2 on s2.id = o.subscription_id
                        where s2.owner_profile_id = p.id and o.charge_status = 'captured'), 0) as spend
        from profiles p
        join auth.users u on u.id = p.id
        left join member_progress mp on mp.profile_id = p.id
        left join lateral (
          select s.status, s.ship_city, s.benefit_clock_expires_at, s.refill_mode, s.smart_substate
            from subscriptions s where s.owner_profile_id = p.id order by s.created_at desc limit 1
        ) ls on true
    )
    select base.pid, base.em, base.dn, base.st, base.ct, base.ca, base.lvl, base.la, base.spend, count(*) over()
      from base
     where (p_query is null or base.em ilike '%' || p_query || '%' or coalesce(base.dn, '') ilike '%' || p_query || '%')
       and (p_status is null or (p_status = 'prospect' and base.st is null) or base.st = p_status)
       and (p_city is null or base.ct = p_city)
       and (p_flag is null
            or (p_flag = 'lapse_risk' and base.st = 'active' and base.bce between now() and now() + interval '5 days')
            or (p_flag = 'smart_pending' and base.rm = 'smart' and base.ss = 'pending' and not base.has_scans))
     order by
       case when p_sort = 'spend' then base.spend end desc nulls last,
       case when p_sort = 'last_active' then base.la end desc nulls last,
       base.ca desc
     limit p_limit offset p_offset;
end $$;

grant execute on function fn_admin_list_members(text,text,text,int,int,text,text) to authenticated, service_role;
