-- 0045 — Agents becomes a full management surface (grill 2026-08): roster with earnings + a
-- per-referrer detail + management actions (set tier / status), plus richer intake curation.
-- All admin-gated + audited. Generic by referrer_type so Affiliates can reuse later.
-- Tier is set MANUALLY for now (audited) — the automatic monthly recompute + tier-rate config
-- waits on financial modelling (see OPEN-FLOWS). Commission release/clawback stays on Fraud.

-- Roster: add paid + pending earnings. (OUT-column change → drop + recreate.)
drop function if exists fn_admin_list_referrers(referrer_type);
create function fn_admin_list_referrers(p_type referrer_type default null)
returns table(profile_id uuid, email text, display_name text, kind text, status text, ref_code text,
              fixed_pct numeric, current_tier int, active_subs int,
              paid_earnings numeric, pending_earnings numeric)
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not authorized' using errcode = 'insufficient_privilege'; end if;
  return query
    select r.profile_id, u.email::text, p.display_name, r.type::text, r.status::text, r.ref_code, r.fixed_pct, r.current_tier,
           (select count(*)::int from attributions a join subscriptions s on s.id = a.subscription_id
             where a.referrer_id = r.profile_id and s.status = 'active'),
           coalesce((select sum(amount) from commissions where referrer_id = r.profile_id and state = 'paid'), 0),
           coalesce((select sum(amount) from commissions where referrer_id = r.profile_id and state in ('accrued','cleared','payable')), 0)
      from referrers r
      join auth.users u on u.id = r.profile_id
      join profiles p on p.id = r.profile_id
     where p_type is null or r.type = p_type
     order by r.created_at desc;
end $$;

-- Per-referrer detail: identity + earnings breakdown by state + referred subscriptions.
create or replace function fn_admin_referrer_detail(p_profile uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  if not is_admin() then raise exception 'not authorized' using errcode = 'insufficient_privilege'; end if;
  select jsonb_build_object(
    'profile_id', r.profile_id,
    'email', u.email::text,
    'name', p.display_name,
    'kind', r.type::text,
    'status', r.status::text,
    'ref_code', r.ref_code,
    'fixed_pct', r.fixed_pct,
    'current_tier', r.current_tier,
    'eligibility_met_at', r.eligibility_met_at,
    'active_subs', (select count(*) from attributions a join subscriptions s on s.id = a.subscription_id
                     where a.referrer_id = r.profile_id and s.status = 'active'),
    'earnings', jsonb_build_object(
      'accrued',     coalesce((select sum(amount) from commissions where referrer_id = r.profile_id and state = 'accrued'), 0),
      'cleared',     coalesce((select sum(amount) from commissions where referrer_id = r.profile_id and state = 'cleared'), 0),
      'payable',     coalesce((select sum(amount) from commissions where referrer_id = r.profile_id and state = 'payable'), 0),
      'paid',        coalesce((select sum(amount) from commissions where referrer_id = r.profile_id and state = 'paid'), 0),
      'clawed_back', coalesce((select sum(amount) from commissions where referrer_id = r.profile_id and state = 'clawed_back'), 0),
      'total',       coalesce((select sum(amount) from commissions where referrer_id = r.profile_id and state <> 'clawed_back'), 0)
    ),
    'referred', coalesce((
      select jsonb_agg(jsonb_build_object(
        'member_id', mp.id, 'member_email', mu.email::text, 'member_name', mp.display_name,
        'sub_status', s.status::text,
        'earned', coalesce((select sum(c.amount) from commissions c
                             where c.subscription_id = a.subscription_id and c.referrer_id = r.profile_id and c.state <> 'clawed_back'), 0)
      ) order by s.created_at desc)
      from attributions a
      join subscriptions s on s.id = a.subscription_id
      join profiles mp on mp.id = s.owner_profile_id
      join auth.users mu on mu.id = mp.id
      where a.referrer_id = r.profile_id), '[]'::jsonb)
  ) into v
  from referrers r
  join auth.users u on u.id = r.profile_id
  join profiles p on p.id = r.profile_id
  where r.profile_id = p_profile;
  return v;
end $$;

-- Manual tier set (audited loud exception until the auto engine exists).
create or replace function fn_admin_set_tier(p_profile uuid, p_tier int, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not authorized' using errcode = 'insufficient_privilege'; end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'a reason is required (audited)' using errcode = 'check_violation'; end if;
  if p_tier is null or p_tier < 0 then raise exception 'tier must be >= 0' using errcode = 'check_violation'; end if;
  update referrers set current_tier = p_tier where profile_id = p_profile;
  if not found then raise exception 'referrer not found' using errcode = 'no_data_found'; end if;
  perform fn_log_audit('referrer.set_tier', 'referrers', p_profile, p_reason, jsonb_build_object('tier', p_tier));
end $$;

-- Pause / resume / offboard (generalises fn_offboard_referrer).
create or replace function fn_admin_set_referrer_status(p_profile uuid, p_status text, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not authorized' using errcode = 'insufficient_privilege'; end if;
  if p_status not in ('active','paused','offboarded') then
    raise exception 'status must be active | paused | offboarded' using errcode = 'check_violation'; end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'a reason is required (audited)' using errcode = 'check_violation'; end if;
  update referrers set status = p_status::referrer_status where profile_id = p_profile;
  if not found then raise exception 'referrer not found' using errcode = 'no_data_found'; end if;
  perform fn_log_audit('referrer.set_status', 'referrers', p_profile, p_reason, jsonb_build_object('status', p_status));
end $$;

-- Waves with applicant counts + soft-cap progress.
create or replace function fn_admin_list_waves()
returns table(id uuid, name text, soft_cap int, city_focus text, niche_note text, status text,
              opened_at timestamptz, applied_n int, approved_n int, waitlisted_n int)
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not authorized' using errcode = 'insufficient_privilege'; end if;
  return query
    select w.id, w.name, w.soft_cap, w.city_focus, w.niche_note, w.status, w.opened_at,
           (select count(*)::int from applications a where a.wave_id = w.id and a.status = 'applied'),
           (select count(*)::int from applications a where a.wave_id = w.id and a.status = 'approved'),
           (select count(*)::int from applications a where a.wave_id = w.id and a.status = 'waitlisted')
      from intake_waves w
     order by w.opened_at desc;
end $$;

-- Richer applicant curation: + city, adherence %, longest streak, tenure. (OUT change → drop.)
drop function if exists fn_admin_wave_applicants(uuid);
create function fn_admin_wave_applicants(p_wave uuid)
returns table(application_id uuid, profile_id uuid, email text, display_name text, status text,
              current_level int, current_streak int, longest_streak int, adherence int,
              city text, joined timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not authorized' using errcode = 'insufficient_privilege'; end if;
  return query
    select a.id, a.profile_id, u.email::text, p.display_name, a.status,
           coalesce(mp.current_level, 1), coalesce(mp.current_streak, 0), coalesce(mp.longest_streak, 0),
           coalesce((select case when 28 * bx.cnt > 0 then round(mp.earning_scans_total::numeric / (28 * bx.cnt) * 100)::int else 0 end
                       from (select count(*) cnt from boxes b where b.activated_by = a.profile_id and b.status = 'activated') bx), 0),
           (select s.ship_city from subscriptions s where s.owner_profile_id = a.profile_id order by s.created_at desc limit 1),
           p.created_at
      from applications a
      join profiles p on p.id = a.profile_id
      join auth.users u on u.id = a.profile_id
      left join member_progress mp on mp.profile_id = a.profile_id
     where a.wave_id = p_wave
     order by coalesce(mp.current_level, 1) desc, coalesce(mp.current_streak, 0) desc;
end $$;

grant execute on function
  fn_admin_list_referrers(referrer_type), fn_admin_referrer_detail(uuid),
  fn_admin_set_tier(uuid,int,text), fn_admin_set_referrer_status(uuid,text,text),
  fn_admin_list_waves(), fn_admin_wave_applicants(uuid)
  to authenticated, service_role;
