-- 0056 — Gamification live insight (grill 2026-08): stop editing levels/perks blind. Shows the level
-- distribution, who's near the next level, and perk reach + estimated spend-perk exposure. Also adds
-- the gamification.xp_per_scan dial (how much XP an earning scan carries — the "base" in the fraud
-- floor; applies to future scans, level never drops). Level = sticky state; threshold_xp[N] = the
-- cumulative XP to advance from N to N+1.

insert into config_dials(key, value) values ('gamification.xp_per_scan', '1'::jsonb)
  on conflict (key) do nothing;

create or replace function fn_admin_gamification_insight()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  if not is_admin() then raise exception 'not authorized' using errcode = 'insufficient_privilege'; end if;
  select jsonb_build_object(
    'total_members', (select count(*) from member_progress),
    'xp_per_scan', coalesce((select (value #>> '{}')::numeric from config_dials where key = 'gamification.xp_per_scan'), 1),
    'levels', coalesce((
      select jsonb_agg(jsonb_build_object(
        'ordinal', l.ordinal, 'name', l.name, 'threshold_xp', l.threshold_xp,
        'members', (select count(*) from member_progress mp where mp.current_level = l.ordinal),
        'near_up', (select count(*) from member_progress mp
                     where mp.current_level = l.ordinal and l.threshold_xp > 0
                       and mp.cumulative_xp >= 0.8 * l.threshold_xp and mp.cumulative_xp < l.threshold_xp)
      ) order by l.ordinal) from levels l), '[]'::jsonb),
    'perks', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', g.id, 'name', g.name, 'funding', g.funding, 'cost_hint', g.cost_hint,
        'min_level', g.min_level,
        'reach', case when g.min_level is null then 0
                      else (select count(*) from member_progress mp where mp.current_level >= g.min_level) end,
        'est_cost', case when g.funding = 'spend' and g.min_level is not null
                         then coalesce(g.cost_hint, 0) * (select count(*) from member_progress mp where mp.current_level >= g.min_level)
                         else 0 end
      ) order by g.min_level nulls last, g.name)
      from (
        select p.id, p.name, p.funding::text as funding, p.cost_hint,
               (select min(l.ordinal) from level_perks lp join levels l on l.id = lp.level_id where lp.perk_id = p.id) as min_level
          from perks p
      ) g), '[]'::jsonb)
  ) into v;
  return v;
end $$;

grant execute on function fn_admin_gamification_insight() to authenticated, service_role;
