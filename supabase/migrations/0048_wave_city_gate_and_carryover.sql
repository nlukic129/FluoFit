-- 0048 — intake model (grill follow-up 2026-08): a city-focused wave is a HARD gate at the source
-- (only members from that city can apply), and the waitlist is a per-city POOL that carries into the
-- next wave for the same city (waitlisted people don't re-apply). city_focus = null → open to all.

-- Member-facing apply: enforces city eligibility. Caller applies for themselves (auth.uid()).
create or replace function fn_apply_to_wave(p_wave uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v uuid := auth.uid(); w intake_waves%rowtype; v_city text; v_app uuid;
begin
  if v is null then raise exception 'not authenticated' using errcode = 'insufficient_privilege'; end if;
  select * into w from intake_waves where id = p_wave;
  if not found or w.status <> 'open' then raise exception 'wave not open' using errcode = 'no_data_found'; end if;
  if w.city_focus is not null then
    select ship_city into v_city from subscriptions where owner_profile_id = v order by created_at desc limit 1;
    if v_city is distinct from w.city_focus then
      raise exception 'not eligible: this wave is for %', w.city_focus using errcode = 'check_violation';
    end if;
  end if;
  insert into applications(wave_id, profile_id, status) values (p_wave, v, 'applied')
    on conflict (wave_id, profile_id) do nothing
    returning id into v_app;
  return v_app;
end $$;

-- Open a wave (admin) — and if it targets a city, auto-carry the waitlisted pool from prior waves of
-- the SAME city (they don't re-apply). Skips anyone who is already a referrer/agent.
create or replace function fn_open_wave(
  p_name text, p_soft_cap int, p_city_focus text, p_niche_note text, p_reason text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_carried int := 0;
begin
  if not is_admin() then raise exception 'not authorized' using errcode = 'insufficient_privilege'; end if;
  insert into intake_waves(name, soft_cap, city_focus, niche_note, status)
    values (p_name, p_soft_cap, p_city_focus, p_niche_note, 'open') returning id into v_id;

  if p_city_focus is not null then
    insert into applications(wave_id, profile_id, status)
    select distinct v_id, a.profile_id, 'waitlisted'
      from applications a
      join intake_waves w on w.id = a.wave_id
     where w.city_focus = p_city_focus and a.status = 'waitlisted' and a.wave_id <> v_id
       and not exists (select 1 from referrers r where r.profile_id = a.profile_id)
    on conflict (wave_id, profile_id) do nothing;
    get diagnostics v_carried = row_count;
  end if;

  perform fn_log_audit('wave.open', 'intake_waves', v_id, p_reason,
                       jsonb_build_object('city_focus', p_city_focus, 'carried_from_waitlist', v_carried));
  return v_id;
end $$;

grant execute on function fn_apply_to_wave(uuid) to authenticated, service_role;
