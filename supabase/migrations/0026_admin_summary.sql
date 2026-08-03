-- 0026 — Summary tab: period KPIs + previous-period values (for Δ trend) + the actionable
-- "Needs attention" panel (lapse-risk, smart-pending, held commissions, aging unbound boxes,
-- open tickets). Admin-gated.
create or replace function fn_admin_summary(
  p_from timestamptz default now() - interval '30 days',
  p_to timestamptz default now(),
  p_city text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  price constant numeric := 29.90;
  v_len interval := p_to - p_from;
  v jsonb;
begin
  if not is_admin() then raise exception 'not authorized' using errcode = 'insufficient_privilege'; end if;

  with scope as (
    select p.id
      from profiles p
      left join lateral (select s.ship_city from subscriptions s
                          where s.owner_profile_id = p.id order by s.created_at desc limit 1) ls on true
     where p_city is null or ls.ship_city = p_city
  )
  select jsonb_build_object(
    'kpis', jsonb_build_object(
      'active_members',  (select count(*) from subscriptions s where s.status='active' and s.owner_profile_id in (select id from scope)),
      'revenue_period',  coalesce((select sum(o.amount) from orders o join subscriptions s on s.id=o.subscription_id
                                    where s.owner_profile_id in (select id from scope) and o.charge_status='captured' and o.paid_at between p_from and p_to), 0),
      'new_members',     (select count(*) from profiles where id in (select id from scope) and created_at between p_from and p_to),
      'lapsed_period',   (select count(*) from subscriptions s where s.status in ('lapsed','cancelled') and s.owner_profile_id in (select id from scope) and s.updated_at between p_from and p_to),
      'pending_payout',  coalesce((select sum(amount) from commissions where state='payable'), 0),
      'arpu', coalesce((select sum(o.amount) from orders o join subscriptions s on s.id=o.subscription_id
                         where s.owner_profile_id in (select id from scope) and o.charge_status='captured'), 0)
              / nullif((select count(distinct s.owner_profile_id) from orders o join subscriptions s on s.id=o.subscription_id
                         where o.charge_status='captured' and s.owner_profile_id in (select id from scope)), 0)
    ),
    'kpis_prev', jsonb_build_object(
      'revenue_period', coalesce((select sum(o.amount) from orders o join subscriptions s on s.id=o.subscription_id
                                   where s.owner_profile_id in (select id from scope) and o.charge_status='captured' and o.paid_at between (p_from - v_len) and p_from), 0),
      'new_members',    (select count(*) from profiles where id in (select id from scope) and created_at between (p_from - v_len) and p_from),
      'lapsed_period',  (select count(*) from subscriptions s where s.status in ('lapsed','cancelled') and s.owner_profile_id in (select id from scope) and s.updated_at between (p_from - v_len) and p_from)
    ),
    'needs_attention', jsonb_build_object(
      'lapse_risk',      (select count(*) from subscriptions s where s.status='active'
                            and s.benefit_clock_expires_at between now() and now() + interval '5 days'
                            and s.owner_profile_id in (select id from scope)),
      'smart_pending',   (select count(*) from subscriptions s where s.refill_mode='smart' and s.smart_substate='pending'
                            and s.owner_profile_id in (select id from scope)),
      'held_commissions_n',   (select count(*) from commissions where state in ('accrued','payable')),
      'held_commissions_sum', coalesce((select sum(amount) from commissions where state in ('accrued','payable')), 0),
      'unbound_aging',   (select count(*) from boxes where status='unbound' and created_at < now() - interval '30 days'),
      'open_tickets',    (select count(*) from support_tickets t where t.status='open' and t.profile_id in (select id from scope))
    )
  ) into v;
  return v;
end $$;
