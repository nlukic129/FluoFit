-- 0016 — Agent intake waves + Affiliate onboarding (M4). Approving an application grants the
-- Agent surface (roles += agent) and mints a ref code; Affiliates are added by an admin against
-- an existing account on a fixed %. All admin-gated + audited.

-- Explicit block flag (admin-console §5): bar a Member from the Agent program.
alter table profiles add column if not exists blocked boolean not null default false;

create or replace function fn_gen_ref_code() returns text
language sql volatile as $$
  select 'REF-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
$$;

create or replace function fn_open_wave(
  p_name text, p_soft_cap int, p_city_focus text, p_niche_note text, p_reason text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not is_admin() then raise exception 'not authorized' using errcode = 'insufficient_privilege'; end if;
  insert into intake_waves(name, soft_cap, city_focus, niche_note, status)
  values (p_name, p_soft_cap, p_city_focus, p_niche_note, 'open') returning id into v_id;
  perform fn_log_audit('wave.open', 'intake_waves', v_id, p_reason, null);
  return v_id;
end $$;

create or replace function fn_close_wave(p_wave uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not authorized' using errcode = 'insufficient_privilege'; end if;
  update intake_waves set status = 'closed', closed_at = now() where id = p_wave;
  perform fn_log_audit('wave.close', 'intake_waves', p_wave, p_reason, null);
end $$;

-- Decide an application: 'approved' grants the Agent surface + a ref code; 'waitlisted' just marks it.
create or replace function fn_decide_application(p_application uuid, p_decision text, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v_profile uuid;
begin
  if not is_admin() then raise exception 'not authorized' using errcode = 'insufficient_privilege'; end if;
  if p_decision not in ('approved', 'waitlisted') then
    raise exception 'decision must be approved | waitlisted' using errcode = 'check_violation'; end if;

  update applications set status = p_decision, decided_by = auth.uid(), decided_at = now()
   where id = p_application returning profile_id into v_profile;
  if v_profile is null then raise exception 'application not found' using errcode = 'no_data_found'; end if;

  if p_decision = 'approved' then
    update profiles set roles = array_append(roles, 'agent')
     where id = v_profile and not ('agent' = any(roles));
    insert into referrers(profile_id, type, ref_code, eligibility_met_at)
    values (v_profile, 'agent', fn_gen_ref_code(), now())
    on conflict (profile_id) do nothing;
  end if;

  perform fn_log_audit('application.decide', 'applications', p_application, p_reason,
                       jsonb_build_object('decision', p_decision, 'profile', v_profile));
end $$;

create or replace function fn_block_member(p_profile uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not authorized' using errcode = 'insufficient_privilege'; end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'block requires a reason' using errcode = 'check_violation'; end if;
  update profiles set blocked = true where id = p_profile;
  perform fn_log_audit('member.block', 'profiles', p_profile, p_reason, null);
end $$;

-- Affiliate: added by an admin against an EXISTING account (they must have signed up first).
create or replace function fn_add_affiliate(p_email text, p_fixed_pct numeric, p_reason text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_profile uuid;
begin
  if not is_admin() then raise exception 'not authorized' using errcode = 'insufficient_privilege'; end if;
  select id into v_profile from auth.users where email = p_email;
  if v_profile is null then
    raise exception 'no account for %; the person must sign up first', p_email using errcode = 'no_data_found';
  end if;

  update profiles set roles = array_append(roles, 'affiliate')
   where id = v_profile and not ('affiliate' = any(roles));
  insert into referrers(profile_id, type, ref_code, fixed_pct)
  values (v_profile, 'affiliate', fn_gen_ref_code(), p_fixed_pct)
  on conflict (profile_id) do update set type = 'affiliate', fixed_pct = excluded.fixed_pct;

  perform fn_log_audit('affiliate.add', 'referrers', v_profile, p_reason,
                       jsonb_build_object('fixed_pct', p_fixed_pct));
  return v_profile;
end $$;

create or replace function fn_offboard_referrer(p_profile uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not authorized' using errcode = 'insufficient_privilege'; end if;
  update referrers set status = 'offboarded' where profile_id = p_profile;
  if not found then raise exception 'referrer not found' using errcode = 'no_data_found'; end if;
  perform fn_log_audit('referrer.offboard', 'referrers', p_profile, p_reason, null);
end $$;

-- Admin read helper: applicants for a wave with curation data (Level, city proxy, tenure).
create or replace function fn_admin_wave_applicants(p_wave uuid)
returns table(application_id uuid, profile_id uuid, email text, status text,
              current_level int, current_streak int, joined timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not authorized' using errcode = 'insufficient_privilege'; end if;
  return query
    select a.id, a.profile_id, u.email::text, a.status,
           coalesce(mp.current_level, 1), coalesce(mp.current_streak, 0), p.created_at
      from applications a
      join profiles p on p.id = a.profile_id
      join auth.users u on u.id = a.profile_id
      left join member_progress mp on mp.profile_id = a.profile_id
     where a.wave_id = p_wave
     order by coalesce(mp.current_level, 1) desc, coalesce(mp.current_streak, 0) desc;
end $$;

-- Admin read helper: referrers (Agents/Affiliates) with email + active referred-sub count.
create or replace function fn_admin_list_referrers(p_type referrer_type default null)
returns table(profile_id uuid, email text, kind text, status text, ref_code text,
              fixed_pct numeric, current_tier int, active_subs int)
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not authorized' using errcode = 'insufficient_privilege'; end if;
  return query
    select r.profile_id, u.email::text, r.type::text, r.status::text, r.ref_code, r.fixed_pct, r.current_tier,
           (select count(*)::int from attributions a
             join subscriptions s on s.id = a.subscription_id
            where a.referrer_id = r.profile_id and s.status = 'active')
      from referrers r
      join auth.users u on u.id = r.profile_id
     where p_type is null or r.type = p_type
     order by r.created_at desc;
end $$;
