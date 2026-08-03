-- 0027 — real pricing in RSD: box price 4000, COGS 1000 (as config dials per ADR-0013). Now
-- that COGS is known, the Overview computes margin + LTV. Also fixes seed order amounts to RSD
-- and makes recurring/margin read the dials (fallback 4000/1000).

insert into config_dials(key, value) values
  ('pricing.box_price', '4000'::jsonb),
  ('pricing.cogs_per_box', '1000'::jsonb),
  ('pricing.currency', '"RSD"'::jsonb)
on conflict (key) do update set value = excluded.value;

-- Fix seeded order amounts (were placeholder EUR 29.90) to the real RSD price.
update orders set amount = 4000 where amount = 29.90;

create or replace function fn_admin_overview(
  p_from timestamptz default now() - interval '30 days',
  p_to timestamptz default now(),
  p_city text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_price numeric := coalesce((select (value #>> '{}')::numeric from config_dials where key = 'pricing.box_price'), 4000);
  v_cogs  numeric := coalesce((select (value #>> '{}')::numeric from config_dials where key = 'pricing.cogs_per_box'), 1000);
  v jsonb;
begin
  if not is_admin() then raise exception 'not authorized' using errcode = 'insufficient_privilege'; end if;

  with scope as (
    select p.id
      from profiles p
      left join lateral (select s.ship_city from subscriptions s
                          where s.owner_profile_id = p.id order by s.created_at desc limit 1) ls on true
     where p_city is null or ls.ship_city = p_city
  ),
  subs as (
    select distinct on (s.owner_profile_id) s.*
      from subscriptions s
     where s.owner_profile_id in (select id from scope)
     order by s.owner_profile_id, s.created_at desc
  ),
  rev_all as (
    select coalesce(sum(o.amount), 0) total, count(distinct s.owner_profile_id) payers
      from orders o join subscriptions s on s.id = o.subscription_id
     where s.owner_profile_id in (select id from scope) and o.charge_status = 'captured'
  )
  select jsonb_build_object(
    'kpis', jsonb_build_object(
      'active_subs',     (select count(*) from subs where status = 'active'),
      'lapsed',          (select count(*) from subs where status in ('lapsed', 'cancelled')),
      'new_members',     (select count(*) from profiles where id in (select id from scope) and created_at between p_from and p_to),
      'revenue_period',  coalesce((select sum(o.amount) from orders o join subscriptions s on s.id = o.subscription_id
                                    where s.owner_profile_id in (select id from scope) and o.charge_status = 'captured' and o.paid_at between p_from and p_to), 0),
      'recurring_est',   (select count(*) from subs where status = 'active') * v_price,
      'pending_payout',  coalesce((select sum(amount) from commissions where state = 'payable'), 0),
      'boxes_activated', (select count(*) from boxes where status = 'activated' and activated_by in (select id from scope)),
      'open_tickets',    (select count(*) from support_tickets where status = 'open' and profile_id in (select id from scope)),
      'arpu', (select case when payers > 0 then round(total / payers) else null end from rev_all)
    ),
    'margin', jsonb_build_object(
      'box_price', v_price,
      'cogs_per_box', v_cogs,
      'unit_margin', v_price - v_cogs,
      'margin_pct', round((v_price - v_cogs) / nullif(v_price, 0) * 100),
      'gross_margin_period', coalesce((select sum(o.amount) - v_cogs * count(*) from orders o join subscriptions s on s.id = o.subscription_id
                                        where s.owner_profile_id in (select id from scope) and o.charge_status = 'captured' and o.paid_at between p_from and p_to), 0),
      'ltv_est', (select case when payers > 0 then round(total / payers * ((v_price - v_cogs) / nullif(v_price, 0))) else 0 end from rev_all)
    ),
    'members_by_status', jsonb_build_object(
      'active', (select count(*) from subs where status = 'active'),
      'paused', (select count(*) from subs where status = 'paused'),
      'lapsed', (select count(*) from subs where status = 'lapsed'),
      'cancelled', (select count(*) from subs where status = 'cancelled'),
      'prospect', (select count(*) from scope where id not in (select owner_profile_id from subs))
    ),
    'members_by_city', coalesce((select jsonb_agg(jsonb_build_object('city', city, 'n', n) order by n desc)
                                  from (select ship_city as city, count(*) n from subscriptions where ship_city is not null group by ship_city) c), '[]'::jsonb),
    'referrers', jsonb_build_object(
      'agents', (select count(*) from referrers where type = 'agent'),
      'affiliates', (select count(*) from referrers where type = 'affiliate')
    ),
    'top_referrers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'email', u.email::text, 'type', r.type::text, 'ref_code', r.ref_code, 'status', r.status::text,
        'active_subs', (select count(*) from attributions a join subscriptions s on s.id = a.subscription_id where a.referrer_id = r.profile_id and s.status = 'active'),
        'paid', coalesce((select sum(amount) from commissions where referrer_id = r.profile_id and state = 'paid'), 0),
        'pending', coalesce((select sum(amount) from commissions where referrer_id = r.profile_id and state in ('accrued', 'payable')), 0),
        'total', coalesce((select sum(amount) from commissions where referrer_id = r.profile_id and state <> 'clawed_back'), 0)
      ) order by coalesce((select sum(amount) from commissions where referrer_id = r.profile_id and state <> 'clawed_back'), 0) desc)
      from referrers r join auth.users u on u.id = r.profile_id), '[]'::jsonb),
    'commissions', jsonb_build_object(
      'accrued', coalesce((select sum(amount) from commissions where state = 'accrued'), 0),
      'payable', coalesce((select sum(amount) from commissions where state = 'payable'), 0),
      'paid', coalesce((select sum(amount) from commissions where state = 'paid'), 0)
    ),
    'ops', jsonb_build_object(
      'boxes_total', (select count(*) from boxes),
      'boxes_activated', (select count(*) from boxes where status = 'activated'),
      'boxes_unbound', (select count(*) from boxes where status = 'unbound'),
      'tickets_open', (select count(*) from support_tickets where status = 'open'),
      'waves_open', (select count(*) from intake_waves where status = 'open'),
      'shipments_in_transit', (select count(*) from shipments where status <> 'delivered')
    ),
    'engagement', jsonb_build_object(
      'avg_adherence', coalesce((
        select round(avg(case when 28 * bx.cnt > 0 then mp.earning_scans_total::numeric / (28 * bx.cnt) else 0 end) * 100)
          from member_progress mp
          join lateral (select count(*) cnt from boxes b where b.activated_by = mp.profile_id and b.status = 'activated') bx on true
         where mp.profile_id in (select id from scope) and bx.cnt > 0), 0),
      'aged_sachets', coalesce((
        select sum(greatest(0, 28 * bx.cnt - mp.earning_scans_total))
          from member_progress mp
          join lateral (select count(*) cnt from boxes b where b.activated_by = mp.profile_id and b.status = 'activated') bx on true
          join subs s on s.owner_profile_id = mp.profile_id
         where mp.profile_id in (select id from scope) and s.status in ('lapsed', 'cancelled')), 0)
    ),
    'revenue_series', coalesce((
      select jsonb_agg(jsonb_build_object('d', g.d::date, 'v', coalesce(x.rev, 0)) order by g.d)
        from generate_series(p_from::date, p_to::date, interval '1 day') g(d)
        left join lateral (select sum(o.amount) rev from orders o join subscriptions s on s.id = o.subscription_id
                            where s.owner_profile_id in (select id from scope) and o.charge_status = 'captured' and o.paid_at::date = g.d::date) x on true), '[]'::jsonb),
    'signups_series', coalesce((
      select jsonb_agg(jsonb_build_object('d', g.d::date, 'v', coalesce(x.n, 0)) order by g.d)
        from generate_series(p_from::date, p_to::date, interval '1 day') g(d)
        left join lateral (select count(*) n from profiles p where p.id in (select id from scope) and p.created_at::date = g.d::date) x on true), '[]'::jsonb),
    'scans_series', coalesce((
      select jsonb_agg(jsonb_build_object('d', g.d::date, 'v', coalesce(x.n, 0)) order by g.d)
        from generate_series(p_from::date, p_to::date, interval '1 day') g(d)
        left join lateral (select count(*) n from sachet_scans sc where sc.earned and sc.scan_date_local = g.d::date and sc.profile_id in (select id from scope)) x on true), '[]'::jsonb)
  ) into v;
  return v;
end $$;
