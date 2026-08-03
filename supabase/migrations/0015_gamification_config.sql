-- 0015 — Gamification config management (M3). Levels/Perks CRUD + Perk↔Level mapping, all
-- admin-gated + audited. Also hardens the "Level never drops" invariant (ADR-0013): a Level is
-- now sticky (max ever reached), so raising a threshold can never demote an existing holder.

-- Harden fn_recompute_progress: current_level only ever RISES (greatest of stored vs computed).
create or replace function fn_recompute_progress(p_profile uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  base_xp constant int := 10;
  v_total   bigint;
  v_xp      bigint;
  v_level   int;
  v_streak  int := 0;
  v_last    date;
  v_prev    date;
  v_grace   date;
  d         date;
begin
  select count(*) into v_total from sachet_scans where profile_id = p_profile and earned;
  v_xp := v_total * base_xp;
  select coalesce(max(ordinal), 0) + 1 into v_level from levels where threshold_xp <= v_xp;

  for d in
    select distinct scan_date_local from sachet_scans
     where profile_id = p_profile and earned
     order by scan_date_local desc
  loop
    if v_prev is null then
      v_streak := 1; v_prev := d; v_last := d;
    elsif v_prev - d = 1 then
      v_streak := v_streak + 1; v_prev := d;
    elsif v_prev - d = 2 and (v_grace is null or v_grace - (v_prev - 1) > 7) then
      v_streak := v_streak + 1; v_grace := v_prev - 1; v_prev := d;
    else
      exit;
    end if;
  end loop;

  insert into member_progress(profile_id, earning_scans_total, cumulative_xp, current_level,
                              current_streak, longest_streak, last_earning_date)
  values (p_profile, v_total, v_xp, v_level, v_streak, v_streak, v_last)
  on conflict (profile_id) do update set
    earning_scans_total = excluded.earning_scans_total,
    cumulative_xp       = excluded.cumulative_xp,
    -- Level never drops: keep the highest of the stored and freshly-computed level.
    current_level       = greatest(member_progress.current_level, excluded.current_level),
    current_streak      = excluded.current_streak,
    longest_streak      = greatest(member_progress.longest_streak, excluded.current_streak),
    last_earning_date   = excluded.last_earning_date;
end $$;

-- Create or edit a Level. Cosmetics (name/icon) always editable; threshold is sensitive but
-- allowed — the never-demote rule above absorbs it. A Level with holders is never deleted.
create or replace function fn_upsert_level(
  p_id uuid, p_ordinal int, p_threshold_xp bigint, p_name text, p_icon text, p_reason text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not is_admin() then raise exception 'not authorized' using errcode = 'insufficient_privilege'; end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'level change requires a reason' using errcode = 'check_violation'; end if;

  if p_id is null then
    insert into levels(ordinal, threshold_xp, name, icon)
    values (p_ordinal, p_threshold_xp, p_name, p_icon) returning id into v_id;
  else
    update levels set ordinal = p_ordinal, threshold_xp = p_threshold_xp, name = p_name, icon = p_icon
     where id = p_id returning id into v_id;
    if v_id is null then raise exception 'level not found' using errcode = 'no_data_found'; end if;
  end if;

  perform fn_log_audit('level.upsert', 'levels', v_id, p_reason,
                       jsonb_build_object('ordinal', p_ordinal, 'threshold_xp', p_threshold_xp));
  return v_id;
end $$;

-- Delete a Level ONLY if it has no holders (nobody has reached its ordinal).
create or replace function fn_delete_level(p_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v_ordinal int;
begin
  if not is_admin() then raise exception 'not authorized' using errcode = 'insufficient_privilege'; end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'delete requires a reason' using errcode = 'check_violation'; end if;

  select ordinal into v_ordinal from levels where id = p_id;
  if v_ordinal is null then raise exception 'level not found' using errcode = 'no_data_found'; end if;
  if exists (select 1 from member_progress where current_level > v_ordinal) then
    raise exception 'cannot delete a Level with holders' using errcode = 'check_violation';
  end if;

  delete from levels where id = p_id;
  perform fn_log_audit('level.delete', 'levels', p_id, p_reason, null);
end $$;

-- Perks + Perk↔Level mapping
create or replace function fn_upsert_perk(
  p_id uuid, p_name text, p_funding perk_funding, p_cost_hint numeric, p_reason text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not is_admin() then raise exception 'not authorized' using errcode = 'insufficient_privilege'; end if;
  if p_id is null then
    insert into perks(name, funding, cost_hint) values (p_name, p_funding, p_cost_hint) returning id into v_id;
  else
    update perks set name = p_name, funding = p_funding, cost_hint = p_cost_hint
     where id = p_id returning id into v_id;
    if v_id is null then raise exception 'perk not found' using errcode = 'no_data_found'; end if;
  end if;
  perform fn_log_audit('perk.upsert', 'perks', v_id, p_reason, jsonb_build_object('funding', p_funding));
  return v_id;
end $$;

create or replace function fn_map_perk_level(p_level uuid, p_perk uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not authorized' using errcode = 'insufficient_privilege'; end if;
  insert into level_perks(level_id, perk_id) values (p_level, p_perk) on conflict do nothing;
  perform fn_log_audit('perk.map', 'level_perks', p_level, p_reason, jsonb_build_object('perk', p_perk));
end $$;

create or replace function fn_unmap_perk_level(p_level uuid, p_perk uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not authorized' using errcode = 'insufficient_privilege'; end if;
  delete from level_perks where level_id = p_level and perk_id = p_perk;
  perform fn_log_audit('perk.unmap', 'level_perks', p_level, p_reason, jsonb_build_object('perk', p_perk));
end $$;
