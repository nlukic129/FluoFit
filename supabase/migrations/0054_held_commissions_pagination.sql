-- 0054 — paginate the held-commission review list. Adds p_limit/p_offset + total_count. Same rows/
-- filter/order as 0053. OUT-column change → drop + recreate.
drop function if exists fn_admin_list_held_commissions(text);
create function fn_admin_list_held_commissions(
  p_filter text default 'hold',
  p_limit int default 25,
  p_offset int default 0
)
returns table(
  id uuid, amount numeric, state text, hold_until timestamptz, days_left int, created_at timestamptz,
  referrer_id uuid, referrer_email text, referrer_name text, referrer_type text,
  member_id uuid, member_email text, member_name text,
  sub_status text, sub_age_days int, order_amount numeric, order_paid_at timestamptz,
  rapid_churn boolean, total_count bigint
)
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not authorized' using errcode = 'insufficient_privilege'; end if;
  return query
    with base as (
      select c.id, c.amount, c.state::text as st, c.hold_until,
             case when c.hold_until is null then null
                  else ceil(extract(epoch from (c.hold_until - now())) / 86400)::int end as d_left,
             c.created_at,
             r.profile_id as rid, ru.email::text as remail, rp.display_name as rname, r.type::text as rtype,
             mp.id as mid, mu.email::text as memail, mp.display_name as mname,
             s.status::text as sstatus, extract(day from now() - s.created_at)::int as sage,
             o.amount as oamount, o.paid_at as opaid,
             (s.status in ('lapsed','cancelled') and (s.updated_at - s.created_at) <= interval '14 days') as churn
        from commissions c
        join referrers r on r.profile_id = c.referrer_id
        join auth.users ru on ru.id = c.referrer_id
        join profiles rp on rp.id = c.referrer_id
        join subscriptions s on s.id = c.subscription_id
        join profiles mp on mp.id = s.owner_profile_id
        join auth.users mu on mu.id = s.owner_profile_id
        left join orders o on o.id = c.order_id
    ),
    filtered as (
      select * from base b
       where (p_filter = 'all'
              or (p_filter = 'hold' and b.st in ('accrued','cleared'))
              or (p_filter = 'flagged' and b.st in ('accrued','cleared') and b.churn))
    )
    select f.id, f.amount, f.st, f.hold_until, f.d_left, f.created_at,
           f.rid, f.remail, f.rname, f.rtype, f.mid, f.memail, f.mname,
           f.sstatus, f.sage, f.oamount, f.opaid, f.churn, count(*) over()
      from filtered f
     order by f.churn desc, f.d_left asc nulls last, f.created_at desc
     limit p_limit offset p_offset;
end $$;

grant execute on function fn_admin_list_held_commissions(text,int,int) to authenticated, service_role;
