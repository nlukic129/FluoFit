-- 0059 — split perk CREATION (Perks tab) from LEVEL ATTACHMENT (Gamification), per founder. A
-- non-public perk may now exist UNATTACHED (level_id null = "a level reward, not yet placed"); the
-- level is bound later in Gamification. So: public ⇒ no level (unchanged); non-public ⇒ level OPTIONAL.

alter table perks drop constraint if exists perk_public_no_level;   -- was: non-public ⇒ level required

-- Upsert a perk WITHOUT touching its level (creation/edit sets identity + public flag; attach is separate).
drop function if exists fn_upsert_perk(uuid, text, text, perk_funding, numeric, uuid, boolean, uuid, text);
create function fn_upsert_perk(
  p_id uuid, p_name text, p_benefit text, p_funding perk_funding, p_cost_hint numeric,
  p_partner_id uuid, p_is_public boolean, p_reason text
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not is_admin() then raise exception 'not authorized' using errcode = 'insufficient_privilege'; end if;
  if p_reason is null or length(trim(p_reason)) = 0 then raise exception 'a reason is required' using errcode = 'check_violation'; end if;
  if p_funding = 'partner' and p_partner_id is null then raise exception 'a partner-funded perk needs a partner' using errcode = 'check_violation'; end if;

  if p_id is null then
    insert into perks(name, benefit, funding, cost_hint, partner_id, is_public, level_id)
      values (p_name, p_benefit, p_funding, p_cost_hint, p_partner_id, p_is_public, null) returning id into v_id;
  else
    -- making it public clears any level; otherwise leave the attachment untouched
    update perks set name = p_name, benefit = p_benefit, funding = p_funding, cost_hint = p_cost_hint,
           partner_id = p_partner_id, is_public = p_is_public,
           level_id = case when p_is_public then null else level_id end
     where id = p_id returning id into v_id;
    if v_id is null then raise exception 'perk not found' using errcode = 'no_data_found'; end if;
  end if;
  perform fn_log_audit('perk.upsert', 'perks', v_id, p_reason, jsonb_build_object('funding', p_funding, 'is_public', p_is_public, 'partner', p_partner_id));
  return v_id;
end $$;

-- Attach / unattach a non-public perk to a Level (the Gamification "bind" step). p_level null = unattach.
create or replace function fn_admin_attach_perk_level(p_perk uuid, p_level uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v_public boolean;
begin
  if not is_admin() then raise exception 'not authorized' using errcode = 'insufficient_privilege'; end if;
  if p_reason is null or length(trim(p_reason)) = 0 then raise exception 'a reason is required' using errcode = 'check_violation'; end if;
  select is_public into v_public from perks where id = p_perk;
  if v_public is null then raise exception 'perk not found' using errcode = 'no_data_found'; end if;
  if v_public then raise exception 'public perks are not level rewards' using errcode = 'check_violation'; end if;
  update perks set level_id = p_level where id = p_perk;
  perform fn_log_audit(case when p_level is null then 'perk.unattach' else 'perk.attach' end, 'perks', p_perk, p_reason,
                       jsonb_build_object('level', p_level));
end $$;

-- All non-public (level-reward) perks + source + current level, for the Gamification attach UI.
create or replace function fn_admin_list_reward_perks()
returns table(id uuid, name text, benefit text, funding text, source text,
              level_id uuid, level_ordinal int, level_name text)
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not authorized' using errcode = 'insufficient_privilege'; end if;
  return query
    select p.id, p.name, p.benefit, p.funding::text, coalesce(pt.name, 'FluoFit'),
           p.level_id, l.ordinal, l.name
      from perks p
      left join partners pt on pt.id = p.partner_id
      left join levels l on l.id = p.level_id
     where not p.is_public
     order by l.ordinal nulls first, p.name;
end $$;

grant execute on function
  fn_upsert_perk(uuid,text,text,perk_funding,numeric,uuid,boolean,text),
  fn_admin_attach_perk_level(uuid,uuid,text), fn_admin_list_reward_perks()
  to authenticated, service_role;
