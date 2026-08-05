-- 0060 — FluoFit's OWN perks must be INTEGRATED into the system, not free-text catalog rows.
-- Founder: "free shipping" must actually make shipping free; "free box with the next order" must
-- actually grant it. So a FluoFit perk is REGISTERED IN CODE (a migration calls fn_register_fluofit_perk,
-- and a developer wires its real behaviour in the fulfilment/pricing engine). The admin form can no
-- longer create/edit/delete them. PARTNER perks stay admin-managed (they're just offers/discounts,
-- often time-limited). Admin's only lever over a FluoFit perk is attaching it to a Level (Gamification).

-- Each FluoFit perk carries a stable engine key. Partner perks have none.
alter table perks add column if not exists code text;

-- Backfill the two seeded FluoFit perks with their engine keys.
update perks set code = 'free_shipping' where partner_id is null and code is null and lower(name) like 'free shipping%';
update perks set code = 'founder_ama'   where partner_id is null and code is null and lower(name) like 'founder ama%';
-- Any other legacy FluoFit perk gets a slug so the constraint below holds (developer renames later).
update perks set code = 'legacy_' || replace(lower(name), ' ', '_') where partner_id is null and code is null;

-- Invariant: code IS the marker of a FluoFit (code-defined) perk; partner perks never carry one.
create unique index if not exists perks_code_uidx on perks(code) where code is not null;
alter table perks drop constraint if exists perk_code_iff_fluofit;
alter table perks add constraint perk_code_iff_fluofit
  check ((partner_id is null and code is not null) or (partner_id is not null and code is null));

-- Developer entrypoint: register (or update) a FluoFit perk from a migration. This is how a NEW
-- FluoFit perk is added once its behaviour is programmed — never via the admin UI. Idempotent by code;
-- never touches the level attachment (that's an admin decision in Gamification).
create or replace function fn_register_fluofit_perk(
  p_code text, p_name text, p_benefit text, p_funding perk_funding, p_cost_hint numeric default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if p_funding = 'partner' then raise exception 'a FluoFit perk cannot be partner-funded' using errcode = 'check_violation'; end if;
  insert into perks(code, name, benefit, funding, cost_hint, partner_id, is_public, level_id)
    values (p_code, p_name, p_benefit, p_funding, p_cost_hint, null, false, null)
  on conflict (code) where code is not null
    do update set name = excluded.name, benefit = excluded.benefit,
                  funding = excluded.funding, cost_hint = excluded.cost_hint
  returning id into v_id;
  return v_id;
end $$;

-- The admin upsert form now manages PARTNER perks only — reject FluoFit (code-defined) perks.
drop function if exists fn_upsert_perk(uuid, text, text, perk_funding, numeric, uuid, boolean, text);
create function fn_upsert_perk(
  p_id uuid, p_name text, p_benefit text, p_funding perk_funding, p_cost_hint numeric,
  p_partner_id uuid, p_is_public boolean, p_reason text
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not is_admin() then raise exception 'not authorized' using errcode = 'insufficient_privilege'; end if;
  if p_reason is null or length(trim(p_reason)) = 0 then raise exception 'a reason is required' using errcode = 'check_violation'; end if;
  if p_partner_id is null then raise exception 'FluoFit perks are code-defined (registered in a migration), not added here' using errcode = 'check_violation'; end if;
  if p_funding <> 'partner' then raise exception 'a partner perk must be partner-funded' using errcode = 'check_violation'; end if;

  if p_id is null then
    insert into perks(name, benefit, funding, cost_hint, partner_id, is_public, level_id, code)
      values (p_name, p_benefit, p_funding, p_cost_hint, p_partner_id, p_is_public, null, null) returning id into v_id;
  else
    -- guard: this RPC never edits a FluoFit perk even if a stale id is passed
    if exists (select 1 from perks where id = p_id and partner_id is null) then
      raise exception 'FluoFit perks are code-defined and cannot be edited here' using errcode = 'check_violation';
    end if;
    update perks set name = p_name, benefit = p_benefit, funding = p_funding, cost_hint = p_cost_hint,
           partner_id = p_partner_id, is_public = p_is_public,
           level_id = case when p_is_public then null else level_id end
     where id = p_id returning id into v_id;
    if v_id is null then raise exception 'perk not found' using errcode = 'no_data_found'; end if;
  end if;
  perform fn_log_audit('perk.upsert', 'perks', v_id, p_reason, jsonb_build_object('funding', p_funding, 'is_public', p_is_public, 'partner', p_partner_id));
  return v_id;
end $$;

-- Deleting a FluoFit perk is a code change (drop it from its migration), never an admin action.
create or replace function fn_delete_perk(p_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not authorized' using errcode = 'insufficient_privilege'; end if;
  if p_reason is null or length(trim(p_reason)) = 0 then raise exception 'a reason is required' using errcode = 'check_violation'; end if;
  if exists (select 1 from perks where id = p_id and partner_id is null) then
    raise exception 'FluoFit perks are code-defined and cannot be deleted here' using errcode = 'check_violation';
  end if;
  delete from perks where id = p_id;
  if not found then raise exception 'perk not found' using errcode = 'no_data_found'; end if;
  perform fn_log_audit('perk.delete', 'perks', p_id, p_reason, null);
end $$;

-- Reward-perk listing (Gamification attach UI) now also returns the code so FluoFit perks read as programmed.
drop function if exists fn_admin_list_reward_perks();
create function fn_admin_list_reward_perks()
returns table(id uuid, name text, benefit text, funding text, source text, code text,
              level_id uuid, level_ordinal int, level_name text)
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not authorized' using errcode = 'insufficient_privilege'; end if;
  return query
    select p.id, p.name, p.benefit, p.funding::text, coalesce(pt.name, 'FluoFit'), p.code,
           p.level_id, l.ordinal, l.name
      from perks p
      left join partners pt on pt.id = p.partner_id
      left join levels l on l.id = p.level_id
     where not p.is_public
     order by l.ordinal nulls first, p.name;
end $$;

grant execute on function
  fn_register_fluofit_perk(text,text,text,perk_funding,numeric),
  fn_upsert_perk(uuid,text,text,perk_funding,numeric,uuid,boolean,text),
  fn_delete_perk(uuid,text), fn_admin_list_reward_perks()
  to service_role;
grant execute on function
  fn_upsert_perk(uuid,text,text,perk_funding,numeric,uuid,boolean,text),
  fn_delete_perk(uuid,text), fn_admin_list_reward_perks()
  to authenticated;

-- Canonical registration of the FluoFit perks that exist today (idempotent; documents the pattern).
-- Their real behaviour lives in the fulfilment/pricing engine (deferred — see docs/OPEN-FLOWS.md).
-- A NEW FluoFit perk is added by (1) wiring its behaviour, then (2) a fn_register_fluofit_perk call here.
select fn_register_fluofit_perk('free_shipping', 'Free shipping', 'Free shipping', 'spend', null);
select fn_register_fluofit_perk('founder_ama',   'Founder AMA',   'AMA invite',    'zero', null);
