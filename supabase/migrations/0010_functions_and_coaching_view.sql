-- 0010 — server-side engine functions and the consent-gated coaching surface.
-- The config engine (ADR-0013) writes a version + updates the live dial + audits, atomically.
-- The coaching view (ADR-0003) exposes day-level consumption to a consented referrer while
-- STRUCTURALLY excluding time-of-day (scanned_at is never selected).

-- Consent gate: may the current user coach this client? (their consented + attributed client)
create or replace function can_coach(client uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
      from consents c
      join attributions a on a.referrer_id = c.referrer_id
      join subscriptions s on s.id = a.subscription_id
     where c.client_profile_id = client
       and c.referrer_id = auth.uid()
       and c.revoked_at is null
       and s.owner_profile_id = client
  )
$$;

-- Audit helper — every mutating admin action records who/when/what/why.
create or replace function fn_log_audit(
  p_action text, p_target_table text, p_target_id uuid, p_reason text, p_metadata jsonb default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into audit_log(actor_profile_id, action, target_table, target_id, reason, metadata)
  values (auth.uid(), p_action, p_target_table, p_target_id, p_reason, p_metadata);
end $$;

-- Config engine (ADR-0013): version + live dial + audit in one call. Admin-only.
create or replace function fn_apply_config(p_key text, p_value jsonb, p_reason text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'not authorized to change config' using errcode = 'insufficient_privilege';
  end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'config change requires a reason (audit invariant)' using errcode = 'check_violation';
  end if;

  insert into config_versions(key, value, changed_by, reason)
  values (p_key, p_value, auth.uid(), p_reason);

  insert into config_dials(key, value, updated_by)
  values (p_key, p_value, auth.uid())
  on conflict (key) do update
    set value = excluded.value, updated_at = now(), updated_by = excluded.updated_by;

  perform fn_log_audit('config.apply', 'config_dials', null, p_reason,
                       jsonb_build_object('key', p_key));
end $$;

-- Coaching plane: day-level consumption for the caller's consented clients ONLY.
-- security_invoker = off → runs as owner (bypasses sachet_scans RLS) but the WHERE clause
-- scopes to the caller's consented clients, and the projection omits scanned_at entirely, so
-- time-of-day can never leak to a referrer (ADR-0003, agent-affiliate-app §2).
create view v_coaching_consumption with (security_invoker = off) as
  select s.profile_id as client_profile_id,
         s.scan_date_local,
         s.earned
    from sachet_scans s
   where can_coach(s.profile_id);

-- NOTE (Phase 2): an Admin XP/Streak correction must re-check the fraud floor and raise a
-- loud exception rather than editing past it (admin-console §6). That guard lands with the
-- XP formula in Phase 2; the ledger-level fraud floor (0006) already holds unconditionally.
