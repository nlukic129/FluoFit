-- 0036 — replace the arbitrary "aging = 30 days since made, never allocated" signal with the one
-- that actually matters for a perishable supplement: EXPIRING = unbound Box whose lot expires
-- within 90 days (incl. already expired). That's the real "sell/ship or write off" alarm; days
-- since manufacture is meaningless when shelf life is 18 months. (grill follow-up 2026-08)

-- Funnel: rename aging_unbound → expiring_unbound (OUT-column rename needs drop + recreate).
drop function if exists fn_admin_lot_funnel();
create function fn_admin_lot_funnel()
returns table(
  id uuid, name text, unit_count int, manufactured_on date, expiry_date date,
  cogs_per_unit numeric, recalled_at timestamptz, recall_reason text,
  last_printed_at timestamptz, print_count int, created_at timestamptz,
  total_boxes bigint, activated bigint, unbound bigint, void bigint,
  shipped bigint, expiring_unbound bigint, expired_unbound bigint
)
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not authorized' using errcode = 'insufficient_privilege'; end if;
  return query
    select bt.id, bt.name, bt.unit_count, bt.manufactured_on, bt.expiry_date,
           bt.cogs_per_unit, bt.recalled_at, bt.recall_reason,
           bt.last_printed_at, bt.print_count, bt.created_at,
           count(b.*),
           count(b.*) filter (where b.status = 'activated'),
           count(b.*) filter (where b.status = 'unbound'),
           count(b.*) filter (where b.status = 'void'),
           count(b.*) filter (where exists (
             select 1 from orders o join shipments s on s.order_id = o.id
              where o.box_id = b.id and s.status in ('shipped','in_transit','delivered'))),
           count(b.*) filter (where b.status = 'unbound'
                                 and bt.expiry_date is not null and bt.expiry_date <= current_date + 90),
           count(b.*) filter (where b.status = 'unbound'
                                 and bt.expiry_date is not null and bt.expiry_date < current_date)
      from batches bt
      left join boxes b on b.batch_id = bt.id
     group by bt.id
     order by bt.created_at desc;
end $$;

grant execute on function fn_admin_lot_funnel() to authenticated, service_role;

-- Drill-down flag: 'aging' → 'expiring' (unbound + lot expiry within 90 days).
create or replace function fn_admin_lot_boxes(
  p_lot uuid default null,
  p_status text default null,
  p_flag text default null,
  p_limit int default 100,
  p_offset int default 0
)
returns table(
  id uuid, human_code text, status text, created_at timestamptz,
  activated_at timestamptz, allocated boolean, total_count bigint
)
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not authorized' using errcode = 'insufficient_privilege'; end if;
  return query
    with base as (
      select b.id, b.human_code, b.status::text as st, b.created_at, b.activated_at,
             exists (select 1 from orders o where o.box_id = b.id) as alloc,
             bt.expiry_date as exp
        from boxes b
        join batches bt on bt.id = b.batch_id
       where (p_lot is null or b.batch_id = p_lot)
    )
    select base.id, base.human_code, base.st, base.created_at, base.activated_at, base.alloc, count(*) over()
      from base
     where (p_status is null or base.st = p_status)
       and (p_flag is null
            or (p_flag = 'expiring' and base.st = 'unbound' and base.exp is not null and base.exp <= current_date + 90))
     order by base.exp asc nulls last, base.created_at desc
     limit p_limit offset p_offset;
end $$;

grant execute on function fn_admin_lot_boxes(uuid,text,text,int,int) to authenticated, service_role;

-- Summary card: unbound_aging → expiring_stock (unbound, lot expiry within 90 days).
create or replace function fn_admin_summary(
  p_from timestamptz default now() - interval '30 days',
  p_to timestamptz default now(),
  p_city text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
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
      'held_commissions_n',   (select count(*) from commissions where state = 'accrued'),
      'held_commissions_sum', coalesce((select sum(amount) from commissions where state = 'accrued'), 0),
      'expiring_stock',  (select count(*) from boxes b join batches bt on bt.id = b.batch_id
                            where b.status='unbound' and bt.expiry_date is not null and bt.expiry_date <= current_date + 90),
      'open_tickets',    (select count(*) from support_tickets t where t.status='open' and t.profile_id in (select id from scope))
    )
  ) into v;
  return v;
end $$;
