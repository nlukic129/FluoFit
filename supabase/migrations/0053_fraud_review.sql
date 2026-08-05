-- 0053 — Fraud tab becomes a held-commission REVIEW QUEUE (grill 2026-08): review commissions during
-- the 30-day hold with full context (referrer ↔ referred member, sub age/status, order, days-left),
-- clawback the bad ones before they pay out. Boundary: Fraud = accrued/cleared (hold); Payouts owns
-- payable→paid. One non-blocking heuristic hint (rapid_churn); no auto-action — the human decides
-- (automated soft-flag detection stays deferred, ADR-0004). Uses existing release/clawback RPCs.

-- Held-commission review list. p_filter: 'hold' (accrued/cleared, default) | 'flagged' | 'all'.
create or replace function fn_admin_list_held_commissions(p_filter text default 'hold')
returns table(
  id uuid, amount numeric, state text, hold_until timestamptz, days_left int, created_at timestamptz,
  referrer_id uuid, referrer_email text, referrer_name text, referrer_type text,
  member_id uuid, member_email text, member_name text,
  sub_status text, sub_age_days int, order_amount numeric, order_paid_at timestamptz,
  rapid_churn boolean
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
    )
    select b.id, b.amount, b.st, b.hold_until, b.d_left, b.created_at,
           b.rid, b.remail, b.rname, b.rtype, b.mid, b.memail, b.mname,
           b.sstatus, b.sage, b.oamount, b.opaid, b.churn
      from base b
     where (p_filter = 'all'
            or (p_filter = 'hold' and b.st in ('accrued','cleared'))
            or (p_filter = 'flagged' and b.st in ('accrued','cleared') and b.churn))
     order by b.churn desc, b.d_left asc nulls last, b.created_at desc
     limit 500;
end $$;

-- Summary tiles: money in the hold, flagged count, clearing within 3 days.
create or replace function fn_admin_fraud_summary()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  if not is_admin() then raise exception 'not authorized' using errcode = 'insufficient_privilege'; end if;
  select jsonb_build_object(
    'in_hold_count', (select count(*) from commissions where state in ('accrued','cleared')),
    'in_hold_sum',   coalesce((select sum(amount) from commissions where state in ('accrued','cleared')), 0),
    'flagged_count', (select count(*) from commissions c join subscriptions s on s.id = c.subscription_id
                       where c.state in ('accrued','cleared')
                         and s.status in ('lapsed','cancelled') and (s.updated_at - s.created_at) <= interval '14 days'),
    'clearing_soon', (select count(*) from commissions where state in ('accrued','cleared')
                       and hold_until is not null and hold_until <= now() + interval '3 days')
  ) into v;
  return v;
end $$;

grant execute on function fn_admin_list_held_commissions(text), fn_admin_fraud_summary()
  to authenticated, service_role;
