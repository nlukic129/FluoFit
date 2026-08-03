-- 0013 — the habit-loop engine (Phase 2). The device flushes its offline scan queue via
-- fn_sync_scans; the server is canonical (ARCHITECTURE §2): it dedups by idempotency key,
-- clamps future timestamps, derives scan_date_local in the Member's ACCOUNT timezone, applies
-- the one-earning-scan-per-day rule under the fraud floor (0006), then recomputes XP/Streak/Level.

-- Recompute the derived, canonical progress from the scan ledger. Idempotent; safe to re-run.
create or replace function fn_recompute_progress(p_profile uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  base_xp constant int := 10;   -- placeholder XP formula (config-only per ADR-0013; value pending COGS)
  v_total   bigint;
  v_xp      bigint;
  v_level   int;
  v_streak  int := 0;
  v_last    date;
  v_prev    date;
  v_grace   date;               -- date of the most recent forgiven miss
  d         date;
begin
  select count(*) into v_total from sachet_scans where profile_id = p_profile and earned;
  v_xp := v_total * base_xp;

  -- Level = number of crossed thresholds + 1 (never demotes elsewhere; empty config ⇒ Level 1).
  select coalesce(max(ordinal), 0) + 1 into v_level from levels where threshold_xp <= v_xp;

  -- Streak: newest→oldest over earned days; forgive ONE missed day per rolling 7-day window.
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
      -- exactly one missed day (v_prev - 1) → weekly grace holds the streak
      v_streak := v_streak + 1; v_grace := v_prev - 1; v_prev := d;
    else
      exit;  -- gap ≥ 3 days, or grace already spent in this window → streak ends
    end if;
  end loop;

  insert into member_progress(profile_id, earning_scans_total, cumulative_xp, current_level,
                              current_streak, longest_streak, last_earning_date)
  values (p_profile, v_total, v_xp, v_level, v_streak, v_streak, v_last)
  on conflict (profile_id) do update set
    earning_scans_total = excluded.earning_scans_total,
    cumulative_xp       = excluded.cumulative_xp,
    current_level       = excluded.current_level,
    current_streak      = excluded.current_streak,
    longest_streak      = greatest(member_progress.longest_streak, excluded.current_streak),
    last_earning_date   = excluded.last_earning_date;
end $$;

-- Flush a batch of queued scans. p_scans = jsonb array of { key, scanned_at, box_id? }.
-- Returns the recomputed canonical member_progress as jsonb.
create or replace function fn_sync_scans(p_scans jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_profile     uuid := auth.uid();
  v_tz          text;
  v_supply      int;
  v_earned_used int;
  rec           jsonb;
  v_key         text;
  v_box         uuid;
  v_scanned     timestamptz;
  v_date        date;
  v_earned      boolean;
  v_progress    member_progress%rowtype;
begin
  if v_profile is null then
    raise exception 'not authenticated' using errcode = 'insufficient_privilege';
  end if;

  select account_timezone into v_tz from profiles where id = v_profile;
  select 28 * count(*) into v_supply from boxes where activated_by = v_profile and status = 'activated';
  select count(*) into v_earned_used from sachet_scans where profile_id = v_profile and earned;

  for rec in select value from jsonb_array_elements(coalesce(p_scans, '[]'::jsonb)) as t(value)
  loop
    v_key := rec ->> 'key';
    v_box := nullif(rec ->> 'box_id', '')::uuid;
    v_scanned := (rec ->> 'scanned_at')::timestamptz;
    if v_scanned > now() then v_scanned := now(); end if;      -- clamp future
    v_date := (v_scanned at time zone v_tz)::date;             -- day in the account timezone

    -- dedup: an already-seen idempotency key is a no-op
    if exists (select 1 from sachet_scans
                where profile_id = v_profile and client_idempotency_key = v_key) then
      continue;
    end if;

    -- earns iff it is the first scan that local day AND supply remains (fraud floor)
    v_earned := (v_earned_used < v_supply)
      and not exists (select 1 from sachet_scans
                       where profile_id = v_profile and scan_date_local = v_date and earned);

    insert into sachet_scans(profile_id, box_id, scan_date_local, scanned_at,
                             client_idempotency_key, earned)
    values (v_profile, v_box, v_date, v_scanned, v_key, v_earned);

    if v_earned then v_earned_used := v_earned_used + 1; end if;
  end loop;

  perform fn_recompute_progress(v_profile);
  select * into v_progress from member_progress where profile_id = v_profile;
  return to_jsonb(v_progress);
end $$;
