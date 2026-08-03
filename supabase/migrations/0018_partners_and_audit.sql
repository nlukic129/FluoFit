-- 0018 — Partner onboarding + Audit Log viewer (M6). Partners are fully admin-managed records
-- (no partner login in v1 — admin-console §7). The audit list surfaces every mutating action.
-- All admin-gated + audited.

create or replace function fn_upsert_partner(
  p_id uuid, p_name text, p_kind text, p_contact text, p_active boolean, p_valid_until date, p_reason text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not is_admin() then raise exception 'not authorized' using errcode = 'insufficient_privilege'; end if;
  if p_id is null then
    insert into partners(name, kind, contact, active, valid_until)
    values (p_name, p_kind, p_contact, coalesce(p_active, true), p_valid_until) returning id into v_id;
  else
    update partners set name = p_name, kind = p_kind, contact = p_contact,
                        active = coalesce(p_active, active), valid_until = p_valid_until
     where id = p_id returning id into v_id;
    if v_id is null then raise exception 'partner not found' using errcode = 'no_data_found'; end if;
  end if;
  perform fn_log_audit('partner.upsert', 'partners', v_id, p_reason, jsonb_build_object('active', p_active));
  return v_id;
end $$;

-- Map a funded Perk to a Partner at a Level (with a discount tier label).
create or replace function fn_map_partner_perk(
  p_partner uuid, p_perk uuid, p_level uuid, p_discount_tier text, p_reason text
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not authorized' using errcode = 'insufficient_privilege'; end if;
  insert into partner_perks(partner_id, perk_id, level_id, discount_tier)
  values (p_partner, p_perk, p_level, p_discount_tier)
  on conflict (partner_id, perk_id, level_id) do update set discount_tier = excluded.discount_tier;
  perform fn_log_audit('partner.map_perk', 'partner_perks', p_partner, p_reason,
                       jsonb_build_object('perk', p_perk, 'level', p_level, 'tier', p_discount_tier));
end $$;

-- Audit viewer: every mutating admin action with the actor's email.
create or replace function fn_admin_list_audit(p_limit int default 200)
returns table(id uuid, actor_email text, action text, target_table text,
              target_id uuid, reason text, at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not authorized' using errcode = 'insufficient_privilege'; end if;
  return query
    select a.id, u.email::text, a.action, a.target_table, a.target_id, a.reason, a.at
      from audit_log a
      left join auth.users u on u.id = a.actor_profile_id
     order by a.at desc
     limit p_limit;
end $$;
