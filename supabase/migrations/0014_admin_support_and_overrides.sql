-- 0014 — Admin support surface + override toolkit (admin-console §6). All SECURITY DEFINER,
-- is_admin()-gated, audited with a mandatory reason on sensitive actions. The XP/Streak
-- correction carries a LOUD-EXCEPTION guard so it can never silently break the fraud floor.

-- Member search (admin reads auth.users for email; not exposed to anyone else).
create or replace function fn_admin_search_members(p_query text default null)
returns table(profile_id uuid, email text, display_name text, sub_status text, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not authorized' using errcode = 'insufficient_privilege'; end if;
  return query
    select p.id,
           u.email::text,
           p.display_name,
           (select s.status::text from subscriptions s
             where s.owner_profile_id = p.id order by s.created_at desc limit 1),
           p.created_at
      from profiles p
      join auth.users u on u.id = p.id
     where p_query is null
        or u.email ilike '%' || p_query || '%'
        or coalesce(p.display_name, '') ilike '%' || p_query || '%'
     order by p.created_at desc
     limit 50;
end $$;

-- Member 360 — everything the admin needs on one member.
create or replace function fn_admin_member_360(p_profile uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  if not is_admin() then raise exception 'not authorized' using errcode = 'insufficient_privilege'; end if;
  select jsonb_build_object(
    'profile',       to_jsonb(p),
    'email',         (select u.email::text from auth.users u where u.id = p_profile),
    'subscription',  (select to_jsonb(s) from subscriptions s
                       where s.owner_profile_id = p_profile order by s.created_at desc limit 1),
    'progress',      (select to_jsonb(mp) from member_progress mp where mp.profile_id = p_profile),
    'boxes',         coalesce((select jsonb_agg(jsonb_build_object(
                         'id', b.id, 'human_code', b.human_code, 'status', b.status))
                       from boxes b where b.activated_by = p_profile), '[]'::jsonb),
    'recent_orders', coalesce((select jsonb_agg(jsonb_build_object(
                         'id', o.id, 'amount', o.amount, 'charge_status', o.charge_status, 'paid_at', o.paid_at))
                       from orders o join subscriptions s on s.id = o.subscription_id
                       where s.owner_profile_id = p_profile), '[]'::jsonb)
  ) into v
  from profiles p where p.id = p_profile;
  return v;
end $$;

-- Support tickets
create or replace function fn_resolve_ticket(p_ticket uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not authorized' using errcode = 'insufficient_privilege'; end if;
  update support_tickets set status = 'resolved' where id = p_ticket;
  perform fn_log_audit('ticket.resolve', 'support_tickets', p_ticket, p_reason, null);
end $$;

-- Override: manual Box activation (QR unreadable, or a dispute resolved for the Member).
create or replace function fn_admin_manual_activate(p_code text, p_profile uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  if not is_admin() then raise exception 'not authorized' using errcode = 'insufficient_privilege'; end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'manual activation requires a reason' using errcode = 'check_violation'; end if;
  v := fn_activate_box(p_code, p_profile);
  perform fn_log_audit('box.manual_activate', 'boxes', null, p_reason,
                       jsonb_build_object('code', p_code, 'profile', p_profile, 'result', v));
  return v;
end $$;

-- Override: unbind a Box from the wrong account, optionally rebind to another.
create or replace function fn_admin_unbind_rebind(p_box_id uuid, p_new_profile uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v_token text;
begin
  if not is_admin() then raise exception 'not authorized' using errcode = 'insufficient_privilege'; end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'unbind/rebind requires a reason' using errcode = 'check_violation'; end if;

  update boxes set status = 'unbound', activated_by = null, activated_at = null
   where id = p_box_id and status = 'activated'
   returning opaque_token into v_token;
  if not found then raise exception 'box not found or not activated' using errcode = 'no_data_found'; end if;

  if p_new_profile is not null then
    perform fn_activate_box(v_token, p_new_profile);
  end if;
  perform fn_log_audit('box.unbind_rebind', 'boxes', p_box_id, p_reason,
                       jsonb_build_object('rebound_to', p_new_profile));
end $$;

-- Override: XP/Streak correction with the LOUD-EXCEPTION guard (admin-console §6, ADR-0006).
create or replace function fn_admin_adjust_progress(
  p_profile uuid, p_xp bigint, p_streak int, p_reason text
) returns void language plpgsql security definer set search_path = public as $$
declare
  base_xp constant int := 10;
  v_supply int;      -- Sachets = 28 × activated Boxes
  v_max_xp bigint;
  v_earned bigint;
begin
  if not is_admin() then raise exception 'not authorized' using errcode = 'insufficient_privilege'; end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'progress correction requires a reason' using errcode = 'check_violation'; end if;

  select 28 * count(*) into v_supply from boxes where activated_by = p_profile and status = 'activated';
  select coalesce(earning_scans_total, 0) into v_earned from member_progress where profile_id = p_profile;
  v_max_xp := v_supply::bigint * base_xp;

  -- LOUD EXCEPTION: a correction may never push XP above the supply-backed ceiling…
  if p_xp is not null and p_xp > v_max_xp then
    raise exception 'fraud_floor: XP % exceeds ceiling % (28 × Boxes × base)', p_xp, v_max_xp
      using errcode = 'check_violation';
  end if;
  -- …nor claim more streak days than earning scans on record.
  if p_streak is not null and p_streak > v_earned then
    raise exception 'streak % exceeds earning scans on record %', p_streak, v_earned
      using errcode = 'check_violation';
  end if;

  update member_progress
     set cumulative_xp  = coalesce(p_xp, cumulative_xp),
         current_streak = coalesce(p_streak, current_streak)
   where profile_id = p_profile;
  update member_progress
     set current_level = (select coalesce(max(ordinal), 0) + 1 from levels where threshold_xp <= cumulative_xp)
   where profile_id = p_profile;

  perform fn_log_audit('progress.correct', 'member_progress', p_profile, p_reason,
                       jsonb_build_object('xp', p_xp, 'streak', p_streak));
end $$;

-- Commission overrides (used by Support now; the Fraud module surfaces them in M5).
create or replace function fn_admin_release_commission(p_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not authorized' using errcode = 'insufficient_privilege'; end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'release requires a reason' using errcode = 'check_violation'; end if;
  update commissions set state = 'payable', cleared_at = coalesce(cleared_at, now())
   where id = p_id and state in ('accrued', 'cleared');
  if not found then raise exception 'commission not found or not releasable' using errcode = 'no_data_found'; end if;
  perform fn_log_audit('commission.release', 'commissions', p_id, p_reason, null);
end $$;

create or replace function fn_admin_clawback_commission(p_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not authorized' using errcode = 'insufficient_privilege'; end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'clawback requires a reason' using errcode = 'check_violation'; end if;
  update commissions set state = 'clawed_back' where id = p_id and state <> 'paid';
  if not found then raise exception 'commission not found or already paid' using errcode = 'no_data_found'; end if;
  perform fn_log_audit('commission.clawback', 'commissions', p_id, p_reason, null);
end $$;

-- Override: fix / assign attribution (trainer dispute, ref within the grace window).
create or replace function fn_admin_fix_attribution(p_subscription uuid, p_referrer uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not authorized' using errcode = 'insufficient_privilege'; end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'attribution fix requires a reason' using errcode = 'check_violation'; end if;
  insert into attributions(subscription_id, referrer_id, ref_code)
  values (p_subscription, p_referrer, (select ref_code from referrers where profile_id = p_referrer))
  on conflict (subscription_id) do update
    set referrer_id = excluded.referrer_id, ref_code = excluded.ref_code;
  perform fn_log_audit('attribution.fix', 'attributions', p_subscription, p_reason,
                       jsonb_build_object('referrer', p_referrer));
end $$;
