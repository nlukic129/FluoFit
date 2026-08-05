-- 0058 — RPCs for the unified perk model + Partners management. Perks carry partner/public/level;
-- availability is set on the perk (no more map/unmap). Companion to 0057.

-- Upsert a perk (context sets funding/partner; availability = public or a level).
drop function if exists fn_upsert_perk(uuid, text, perk_funding, numeric, text);
create function fn_upsert_perk(
  p_id uuid, p_name text, p_benefit text, p_funding perk_funding, p_cost_hint numeric,
  p_partner_id uuid, p_is_public boolean, p_level_id uuid, p_reason text
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_level uuid;
begin
  if not is_admin() then raise exception 'not authorized' using errcode = 'insufficient_privilege'; end if;
  if p_reason is null or length(trim(p_reason)) = 0 then raise exception 'a reason is required' using errcode = 'check_violation'; end if;
  if p_funding = 'partner' and p_partner_id is null then raise exception 'a partner-funded perk needs a partner' using errcode = 'check_violation'; end if;
  v_level := case when p_is_public then null else p_level_id end;
  if not p_is_public and v_level is null then raise exception 'a non-public perk must unlock at a level' using errcode = 'check_violation'; end if;

  if p_id is null then
    insert into perks(name, benefit, funding, cost_hint, partner_id, is_public, level_id)
      values (p_name, p_benefit, p_funding, p_cost_hint, p_partner_id, p_is_public, v_level) returning id into v_id;
  else
    update perks set name = p_name, benefit = p_benefit, funding = p_funding, cost_hint = p_cost_hint,
           partner_id = p_partner_id, is_public = p_is_public, level_id = v_level
     where id = p_id returning id into v_id;
    if v_id is null then raise exception 'perk not found' using errcode = 'no_data_found'; end if;
  end if;
  perform fn_log_audit('perk.upsert', 'perks', v_id, p_reason,
                       jsonb_build_object('funding', p_funding, 'is_public', p_is_public, 'level', v_level, 'partner', p_partner_id));
  return v_id;
end $$;

create or replace function fn_delete_perk(p_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not authorized' using errcode = 'insufficient_privilege'; end if;
  if p_reason is null or length(trim(p_reason)) = 0 then raise exception 'a reason is required' using errcode = 'check_violation'; end if;
  delete from perks where id = p_id;
  if not found then raise exception 'perk not found' using errcode = 'no_data_found'; end if;
  perform fn_log_audit('perk.delete', 'perks', p_id, p_reason, null);
end $$;

-- Partner roster + perk count + expiry.
create or replace function fn_admin_list_partners()
returns table(id uuid, name text, kind text, contact text, active boolean, valid_until date,
              perk_count int, expired boolean)
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not authorized' using errcode = 'insufficient_privilege'; end if;
  return query
    select p.id, p.name, p.kind, p.contact, p.active, p.valid_until,
           (select count(*)::int from perks pk where pk.partner_id = p.id),
           (p.valid_until is not null and p.valid_until < current_date)
      from partners p order by p.created_at desc;
end $$;

-- Partner detail + their perks.
create or replace function fn_admin_partner_detail(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  if not is_admin() then raise exception 'not authorized' using errcode = 'insufficient_privilege'; end if;
  select jsonb_build_object(
    'id', p.id, 'name', p.name, 'kind', p.kind, 'contact', p.contact, 'active', p.active,
    'valid_until', p.valid_until, 'expired', (p.valid_until is not null and p.valid_until < current_date),
    'perks', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', pk.id, 'name', pk.name, 'benefit', pk.benefit, 'funding', pk.funding, 'cost_hint', pk.cost_hint,
        'is_public', pk.is_public, 'level_id', pk.level_id, 'level_ordinal', l.ordinal, 'level_name', l.name
      ) order by pk.is_public, l.ordinal nulls last, pk.name)
      from perks pk left join levels l on l.id = pk.level_id where pk.partner_id = p.id), '[]'::jsonb)
  ) into v from partners p where p.id = p_id;
  return v;
end $$;

-- Full reward ladder: for each level, the non-public perks that unlock at it (from any source).
create or replace function fn_admin_rewards_by_level()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  if not is_admin() then raise exception 'not authorized' using errcode = 'insufficient_privilege'; end if;
  select jsonb_agg(jsonb_build_object(
    'ordinal', l.ordinal, 'name', l.name,
    'perks', coalesce((
      select jsonb_agg(jsonb_build_object('name', pk.name, 'benefit', pk.benefit, 'funding', pk.funding,
                                          'source', coalesce(pt.name, 'FluoFit')) order by pk.name)
      from perks pk left join partners pt on pt.id = pk.partner_id
      where pk.level_id = l.id and not pk.is_public), '[]'::jsonb)
  ) order by l.ordinal) into v from levels l;
  return coalesce(v, '[]'::jsonb);
end $$;

grant execute on function
  fn_upsert_perk(uuid,text,text,perk_funding,numeric,uuid,boolean,uuid,text), fn_delete_perk(uuid,text),
  fn_admin_list_partners(), fn_admin_partner_detail(uuid), fn_admin_rewards_by_level()
  to authenticated, service_role;
