-- 0023 — clearer consumption rates in the member detail. "per_day" is the last-28-day rate
-- (0 when a member has gone silent); "per_day_lifetime" is their pace while active. Box
-- longevity is estimated from the lifetime pace (meaningful even when currently silent);
-- days-to-empty uses the current rate (null when not depleting).
create or replace function fn_admin_member_detail(p_profile uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v jsonb;
  v_boxes int;
  v_consumed bigint;
  v_remaining bigint;
  v_rate numeric;       -- earning scans/day over the last 28 days
  v_rate_life numeric;  -- earning scans/day over the active span (first→last scan)
begin
  if not is_admin() then raise exception 'not authorized' using errcode = 'insufficient_privilege'; end if;

  select count(*) into v_boxes from boxes where activated_by = p_profile and status = 'activated';
  select coalesce(earning_scans_total, 0) into v_consumed from member_progress where profile_id = p_profile;
  v_remaining := greatest(0, v_boxes * 28 - v_consumed);

  select count(*)::numeric / 28 into v_rate
    from sachet_scans where profile_id = p_profile and earned and scan_date_local > current_date - 28;

  select case
           when count(*) = 0 then 0
           when max(scan_date_local) = min(scan_date_local) then count(*)::numeric
           else count(*)::numeric / ((max(scan_date_local) - min(scan_date_local)) + 1)
         end
    into v_rate_life
    from sachet_scans where profile_id = p_profile and earned;

  select jsonb_build_object(
    'profile_id', p.id,
    'email', (select u.email::text from auth.users u where u.id = p.id),
    'display_name', p.display_name,
    'roles', to_jsonb(p.roles),
    'blocked', p.blocked,
    'account_timezone', p.account_timezone,
    'joined', p.created_at,

    'subscription', (select to_jsonb(s) from subscriptions s where s.owner_profile_id = p.id order by s.created_at desc limit 1),
    'progress', (select to_jsonb(mp) from member_progress mp where mp.profile_id = p.id),

    'supply', jsonb_build_object(
      'activated_boxes', v_boxes,
      'total_sachets', v_boxes * 28,
      'consumed', v_consumed,
      'remaining', v_remaining
    ),
    'consumption', jsonb_build_object(
      'first_scan', (select min(scan_date_local) from sachet_scans where profile_id = p.id and earned),
      'last_scan',  (select max(scan_date_local) from sachet_scans where profile_id = p.id and earned),
      'active_days', (select count(distinct scan_date_local) from sachet_scans where profile_id = p.id and earned),
      'per_day', round(v_rate, 2),
      'per_day_lifetime', round(v_rate_life, 2),
      'days_per_box_est', case when v_rate_life > 0 then round(28 / v_rate_life) else null end,
      'days_to_empty_est', case when v_rate > 0 then round(v_remaining / v_rate) else null end
    ),

    'total_spent', coalesce((select sum(o.amount) from orders o join subscriptions s on s.id = o.subscription_id
                              where s.owner_profile_id = p.id and o.charge_status = 'captured'), 0),

    'levels', coalesce((select jsonb_agg(jsonb_build_object(
        'ordinal', l.ordinal, 'name', l.name, 'threshold_xp', l.threshold_xp,
        'reached', l.ordinal <= coalesce((select current_level from member_progress where profile_id = p.id), 1),
        'perks', coalesce((select jsonb_agg(pk.name) from level_perks lp join perks pk on pk.id = lp.perk_id where lp.level_id = l.id), '[]'::jsonb)
      ) order by l.ordinal) from levels l), '[]'::jsonb),

    'scans', coalesce((select jsonb_agg(jsonb_build_object('d', scan_date_local, 't', scanned_at) order by scan_date_local desc)
                        from (select scan_date_local, scanned_at from sachet_scans
                               where profile_id = p.id and earned order by scan_date_local desc limit 200) x), '[]'::jsonb),

    'boxes', coalesce((select jsonb_agg(jsonb_build_object('human_code', b.human_code, 'status', b.status, 'activated_at', b.activated_at) order by b.activated_at desc nulls last)
                        from boxes b where b.activated_by = p.id), '[]'::jsonb),
    'orders', coalesce((select jsonb_agg(jsonb_build_object('amount', o.amount, 'charge_status', o.charge_status, 'paid_at', o.paid_at, 'created_at', o.created_at) order by o.created_at desc)
                         from orders o join subscriptions s on s.id = o.subscription_id where s.owner_profile_id = p.id), '[]'::jsonb),

    'shipments', coalesce((select jsonb_agg(jsonb_build_object(
        'status', sh.status, 'tracking_ref', sh.tracking_ref, 'shipped_at', sh.shipped_at, 'delivered_at', sh.delivered_at,
        'days_in_transit', case when sh.shipped_at is not null and sh.delivered_at is null then extract(day from now() - sh.shipped_at)::int else null end
      ) order by sh.shipped_at desc nulls last)
      from shipments sh join orders o on o.id = sh.order_id join subscriptions s on s.id = o.subscription_id
      where s.owner_profile_id = p.id), '[]'::jsonb),

    'referred_by', (select u2.email::text from attributions a
                     join subscriptions s on s.id = a.subscription_id
                     join auth.users u2 on u2.id = a.referrer_id
                     where s.owner_profile_id = p.id limit 1),
    'is_referrer', exists(select 1 from referrers r where r.profile_id = p.id),

    'tickets', coalesce((select jsonb_agg(jsonb_build_object('subject', t.subject, 'status', t.status, 'created_at', t.created_at) order by t.created_at desc)
                          from support_tickets t where t.profile_id = p.id), '[]'::jsonb)
  ) into v
  from profiles p where p.id = p_profile;

  return v;
end $$;
