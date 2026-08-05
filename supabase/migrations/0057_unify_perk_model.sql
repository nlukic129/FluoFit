-- 0057 — unify the perk model (grill 2026-08). A perk is now the single source of truth: it carries
-- its partner (null = FluoFit's own spend/zero perk), a public flag, its unlock level (non-public only),
-- and a benefit label. The two competing perk→level mappings (level_perks, partner_perks) are folded in
-- and DROPPED. Public perk = available to all (no level); non-public = a level reward. This kills the
-- "map perk → level" UX entirely — availability lives on the perk.

alter table perks
  add column if not exists partner_id uuid references partners(id),
  add column if not exists is_public boolean not null default true,
  add column if not exists level_id uuid references levels(id),
  add column if not exists benefit text;

-- Fold existing mappings into the perk. (level_perks: perk→level; partner_perks: partner+perk→level+tier.)
update perks p set level_id = lp.level_id, is_public = false
  from level_perks lp where lp.perk_id = p.id;
update perks p set partner_id = pp.partner_id, level_id = pp.level_id, is_public = false,
       benefit = coalesce(p.benefit, pp.discount_tier)
  from partner_perks pp where pp.perk_id = p.id;

-- Integrity: public ⇒ no level; non-public ⇒ a level. (funding=partner ⇒ partner enforced in the RPC.)
alter table perks
  add constraint perk_public_no_level check (is_public or level_id is not null),
  add constraint perk_nonpublic_level  check (not is_public or level_id is null);

drop function if exists fn_map_perk_level(uuid, uuid, text);
drop function if exists fn_unmap_perk_level(uuid, uuid, text);
drop function if exists fn_map_partner_perk(uuid, uuid, uuid, text, text);
drop table if exists level_perks;
drop table if exists partner_perks;

-- Recreate the two functions that read the old mapping tables, now reading perks.level_id.
-- (a) member detail: perks unlocked at each level.
create or replace function fn_admin_member_detail(p_profile uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v jsonb; v_boxes int; v_consumed bigint; v_remaining bigint; v_rate numeric; v_rate_life numeric;
begin
  if not is_admin() then raise exception 'not authorized' using errcode = 'insufficient_privilege'; end if;
  select count(*) into v_boxes from boxes where activated_by = p_profile and status = 'activated';
  select coalesce(earning_scans_total, 0) into v_consumed from member_progress where profile_id = p_profile;
  v_remaining := greatest(0, v_boxes * 28 - v_consumed);
  select count(*)::numeric / 28 into v_rate
    from sachet_scans where profile_id = p_profile and earned and scan_date_local > current_date - 28;
  select case when count(*) = 0 then 0 when max(scan_date_local) = min(scan_date_local) then count(*)::numeric
              else count(*)::numeric / ((max(scan_date_local) - min(scan_date_local)) + 1) end
    into v_rate_life from sachet_scans where profile_id = p_profile and earned;

  select jsonb_build_object(
    'profile_id', p.id, 'email', (select u.email::text from auth.users u where u.id = p.id),
    'display_name', p.display_name, 'roles', to_jsonb(p.roles), 'blocked', p.blocked,
    'account_timezone', p.account_timezone, 'joined', p.created_at,
    'subscription', (select to_jsonb(s) from subscriptions s where s.owner_profile_id = p.id order by s.created_at desc limit 1),
    'progress', (select to_jsonb(mp) from member_progress mp where mp.profile_id = p.id),
    'supply', jsonb_build_object('activated_boxes', v_boxes, 'total_sachets', v_boxes * 28, 'consumed', v_consumed, 'remaining', v_remaining),
    'consumption', jsonb_build_object(
      'first_scan', (select min(scan_date_local) from sachet_scans where profile_id = p.id and earned),
      'last_scan',  (select max(scan_date_local) from sachet_scans where profile_id = p.id and earned),
      'active_days', (select count(distinct scan_date_local) from sachet_scans where profile_id = p.id and earned),
      'per_day', round(v_rate, 2), 'per_day_lifetime', round(v_rate_life, 2),
      'days_per_box_est', case when v_rate_life > 0 then round(28 / v_rate_life) else null end,
      'days_to_empty_est', case when v_rate > 0 then round(v_remaining / v_rate) else null end),
    'total_spent', coalesce((select sum(o.amount) from orders o join subscriptions s on s.id = o.subscription_id
                              where s.owner_profile_id = p.id and o.charge_status = 'captured'), 0),
    'levels', coalesce((select jsonb_agg(jsonb_build_object(
        'ordinal', l.ordinal, 'name', l.name, 'threshold_xp', l.threshold_xp,
        'reached', l.ordinal <= coalesce((select current_level from member_progress where profile_id = p.id), 1),
        'perks', coalesce((select jsonb_agg(pk.name) from perks pk where pk.level_id = l.id and not pk.is_public), '[]'::jsonb)
      ) order by l.ordinal) from levels l), '[]'::jsonb),
    'scans', coalesce((select jsonb_agg(jsonb_build_object('d', scan_date_local, 't', scanned_at) order by scan_date_local desc)
                        from (select scan_date_local, scanned_at from sachet_scans where profile_id = p.id and earned order by scan_date_local desc limit 200) x), '[]'::jsonb),
    'boxes', coalesce((select jsonb_agg(jsonb_build_object('human_code', b.human_code, 'status', b.status, 'activated_at', b.activated_at) order by b.activated_at desc nulls last)
                        from boxes b where b.activated_by = p.id), '[]'::jsonb),
    'orders', coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'amount', o.amount, 'charge_status', o.charge_status, 'paid_at', o.paid_at, 'created_at', o.created_at) order by o.created_at desc)
                         from orders o join subscriptions s on s.id = o.subscription_id where s.owner_profile_id = p.id), '[]'::jsonb),
    'shipments', coalesce((select jsonb_agg(jsonb_build_object('status', sh.status, 'tracking_ref', sh.tracking_ref, 'shipped_at', sh.shipped_at, 'delivered_at', sh.delivered_at,
        'days_in_transit', case when sh.shipped_at is not null and sh.delivered_at is null then extract(day from now() - sh.shipped_at)::int else null end) order by sh.shipped_at desc nulls last)
      from shipments sh join orders o on o.id = sh.order_id join subscriptions s on s.id = o.subscription_id where s.owner_profile_id = p.id), '[]'::jsonb),
    'referred_by', (select u2.email::text from attributions a join subscriptions s on s.id = a.subscription_id join auth.users u2 on u2.id = a.referrer_id where s.owner_profile_id = p.id limit 1),
    'is_referrer', exists(select 1 from referrers r where r.profile_id = p.id),
    'tickets', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'subject', t.subject, 'status', t.status, 'created_at', t.created_at) order by t.created_at desc)
                          from support_tickets t where t.profile_id = p.id), '[]'::jsonb)
  ) into v from profiles p where p.id = p_profile;
  return v;
end $$;

-- (b) gamification insight: perk reach from perks.level_id (public = everyone; else members at/above level).
create or replace function fn_admin_gamification_insight()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v jsonb; v_total int;
begin
  if not is_admin() then raise exception 'not authorized' using errcode = 'insufficient_privilege'; end if;
  select count(*) into v_total from member_progress;
  select jsonb_build_object(
    'total_members', v_total,
    'xp_per_scan', coalesce((select (value #>> '{}')::numeric from config_dials where key = 'gamification.xp_per_scan'), 1),
    'levels', coalesce((
      select jsonb_agg(jsonb_build_object(
        'ordinal', l.ordinal, 'name', l.name, 'threshold_xp', l.threshold_xp,
        'members', (select count(*) from member_progress mp where mp.current_level = l.ordinal),
        'near_up', (select count(*) from member_progress mp where mp.current_level = l.ordinal and l.threshold_xp > 0
                     and mp.cumulative_xp >= 0.8 * l.threshold_xp and mp.cumulative_xp < l.threshold_xp)
      ) order by l.ordinal) from levels l), '[]'::jsonb),
    'perks', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', g.id, 'name', g.name, 'funding', g.funding, 'cost_hint', g.cost_hint, 'is_public', g.is_public,
        'source', g.source, 'level_ordinal', g.level_ordinal, 'reach', g.reach,
        'est_cost', case when g.funding = 'spend' then coalesce(g.cost_hint, 0) * g.reach else 0 end
      ) order by g.is_public, g.level_ordinal nulls last, g.name)
      from (
        select p.id, p.name, p.funding::text as funding, p.cost_hint, p.is_public,
               coalesce(pt.name, 'FluoFit') as source, l.ordinal as level_ordinal,
               case when p.is_public then v_total
                    when l.ordinal is null then 0
                    else (select count(*) from member_progress mp where mp.current_level >= l.ordinal) end as reach
          from perks p left join partners pt on pt.id = p.partner_id left join levels l on l.id = p.level_id
      ) g), '[]'::jsonb)
  ) into v;
  return v;
end $$;
