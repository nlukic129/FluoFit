-- 0038 — Member support-console actions + "understand" reads (grill 2026-08). All admin-gated,
-- reason-required where mutating, audited (audit invariant). Parked integrations stay simulated:
-- refund only records the resulting state (PaymentPort), resend-login only logs intent (NotifyPort).
-- Reuses existing fn_block_member / fn_admin_manual_activate / fn_admin_adjust_progress.

-- ── Account ────────────────────────────────────────────────────────────────
create or replace function fn_unblock_member(p_profile uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not authorized' using errcode = 'insufficient_privilege'; end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'unblock requires a reason' using errcode = 'check_violation'; end if;
  update profiles set blocked = false where id = p_profile;
  perform fn_log_audit('member.unblock', 'profiles', p_profile, p_reason, null);
end $$;

-- NotifyPort stub: record the intent to resend a passwordless login link (no third-party call here).
create or replace function fn_admin_resend_login(p_profile uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not authorized' using errcode = 'insufficient_privilege'; end if;
  perform fn_log_audit('auth.resend_login', 'profiles', p_profile, p_reason,
                       jsonb_build_object('channel', 'email', 'simulated', true));
end $$;

-- ── Subscription lifecycle ───────────────────────────────────────────────────
-- Pause / Resume (→active) / Cancel the member's latest subscription. Note: this does NOT touch
-- the benefit clock — only a paid order resets that (ADR-0011).
create or replace function fn_admin_set_sub_status(p_profile uuid, p_status text, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v_sub uuid;
begin
  if not is_admin() then raise exception 'not authorized' using errcode = 'insufficient_privilege'; end if;
  if p_status not in ('active','paused','cancelled') then
    raise exception 'status must be active | paused | cancelled' using errcode = 'check_violation'; end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'a reason is required' using errcode = 'check_violation'; end if;

  select id into v_sub from subscriptions where owner_profile_id = p_profile order by created_at desc limit 1;
  if v_sub is null then raise exception 'no subscription for this member' using errcode = 'no_data_found'; end if;

  update subscriptions set status = p_status::sub_status, updated_at = now() where id = v_sub;
  perform fn_log_audit('subscription.set_status', 'subscriptions', v_sub, p_reason,
                       jsonb_build_object('status', p_status));
end $$;

-- ── Financial ────────────────────────────────────────────────────────────────
-- PaymentPort stub: mark a captured order refunded (real refund call is parked behind the port).
create or replace function fn_admin_refund_order(p_order uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not authorized' using errcode = 'insufficient_privilege'; end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'refund requires a reason' using errcode = 'check_violation'; end if;
  update orders set charge_status = 'refunded' where id = p_order and charge_status = 'captured';
  if not found then raise exception 'order not found or not refundable (must be captured)' using errcode = 'no_data_found'; end if;
  perform fn_log_audit('order.refund', 'orders', p_order, p_reason, jsonb_build_object('simulated', true));
end $$;

-- Fix referral attribution by ref code (operator-friendly wrapper): re-point the member's latest
-- subscription to the referrer that owns p_ref_code.
create or replace function fn_admin_set_attribution(p_profile uuid, p_ref_code text, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v_sub uuid; v_ref uuid;
begin
  if not is_admin() then raise exception 'not authorized' using errcode = 'insufficient_privilege'; end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'a reason is required' using errcode = 'check_violation'; end if;

  select id into v_sub from subscriptions where owner_profile_id = p_profile order by created_at desc limit 1;
  if v_sub is null then raise exception 'no subscription for this member' using errcode = 'no_data_found'; end if;
  select profile_id into v_ref from referrers where ref_code = upper(trim(p_ref_code));
  if v_ref is null then raise exception 'no referrer with code %', p_ref_code using errcode = 'no_data_found'; end if;

  insert into attributions(subscription_id, referrer_id, ref_code)
  values (v_sub, v_ref, upper(trim(p_ref_code)))
  on conflict (subscription_id) do update set referrer_id = excluded.referrer_id, ref_code = excluded.ref_code;

  perform fn_log_audit('attribution.fix', 'subscriptions', v_sub, p_reason,
                       jsonb_build_object('ref_code', upper(trim(p_ref_code)), 'referrer', v_ref));
end $$;

-- ── Internal notes ───────────────────────────────────────────────────────────
create or replace function fn_admin_add_note(p_profile uuid, p_body text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not is_admin() then raise exception 'not authorized' using errcode = 'insufficient_privilege'; end if;
  if p_body is null or length(trim(p_body)) = 0 then
    raise exception 'note body required' using errcode = 'check_violation'; end if;
  insert into member_notes(profile_id, author_id, body) values (p_profile, auth.uid(), trim(p_body))
    returning id into v_id;
  perform fn_log_audit('member.note', 'profiles', p_profile, null, jsonb_build_object('note_id', v_id));
  return v_id;
end $$;

create or replace function fn_admin_list_notes(p_profile uuid)
returns table(id uuid, body text, author_email text, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not authorized' using errcode = 'insufficient_privilege'; end if;
  return query
    select n.id, n.body, u.email::text, n.created_at
      from member_notes n
      left join auth.users u on u.id = n.author_id
     where n.profile_id = p_profile
     order by n.created_at desc;
end $$;

-- ── Consent (ADR-0003): view + revoke-on-request. Admin never GRANTS; time-of-day never shared. ──
create or replace function fn_admin_member_consent(p_profile uuid)
returns table(consent_id uuid, referrer_email text, referrer_type text,
              granted_at timestamptz, revoked_at timestamptz, active boolean)
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not authorized' using errcode = 'insufficient_privilege'; end if;
  return query
    select c.id, u.email::text, r.type::text, c.granted_at, c.revoked_at, (c.revoked_at is null)
      from consents c
      join referrers r on r.profile_id = c.referrer_id
      join auth.users u on u.id = c.referrer_id
     where c.client_profile_id = p_profile
     order by c.granted_at desc;
end $$;

create or replace function fn_admin_revoke_consent(p_consent uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not authorized' using errcode = 'insufficient_privilege'; end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'revoke requires a reason (member request)' using errcode = 'check_violation'; end if;
  update consents set revoked_at = now() where id = p_consent and revoked_at is null;
  if not found then raise exception 'consent not found or already revoked' using errcode = 'no_data_found'; end if;
  perform fn_log_audit('consent.revoke', 'consents', p_consent, p_reason, null);
end $$;

-- ── Referrer link-out: is this member also an Agent/Affiliate? ────────────────
create or replace function fn_admin_member_referrer(p_profile uuid)
returns table(kind text, status text, ref_code text, fixed_pct numeric, current_tier int, active_subs int)
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not authorized' using errcode = 'insufficient_privilege'; end if;
  return query
    select r.type::text, r.status::text, r.ref_code, r.fixed_pct, r.current_tier,
           (select count(*)::int from attributions a join subscriptions s on s.id = a.subscription_id
             where a.referrer_id = r.profile_id and s.status = 'active')
      from referrers r where r.profile_id = p_profile;
end $$;

-- ── Unified activity timeline (newest first). Scans are NOT itemised (see the calendar). ────────
create or replace function fn_admin_member_timeline(p_profile uuid, p_limit int default 60)
returns table(at timestamptz, kind text, title text, detail text)
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not authorized' using errcode = 'insufficient_privilege'; end if;
  return query
    with subs as (select id from subscriptions where owner_profile_id = p_profile),
         ords as (select o.* from orders o where o.subscription_id in (select id from subs)),
    ev as (
      select p.created_at as at, 'signup' as kind, 'Signed up' as title, null::text as detail
        from profiles p where p.id = p_profile
      union all
      select o.created_at, 'order', 'Order placed', o.amount::text || ' RSD · ' || o.charge_status from ords o
      union all
      select o.paid_at, 'payment', 'Payment captured', o.amount::text || ' RSD'
        from ords o where o.paid_at is not null
      union all
      select sh.shipped_at, 'shipment', 'Shipped', coalesce(sh.tracking_ref, '')
        from shipments sh where sh.order_id in (select id from ords) and sh.shipped_at is not null
      union all
      select sh.delivered_at, 'shipment', 'Delivered', null
        from shipments sh where sh.order_id in (select id from ords) and sh.delivered_at is not null
      union all
      select t.created_at, 'ticket', 'Ticket: ' || coalesce(t.subject, '—'), t.status
        from support_tickets t where t.profile_id = p_profile
      union all
      select n.created_at, 'note', 'Internal note', n.body from member_notes n where n.profile_id = p_profile
      union all
      select a.at, 'admin', a.action, a.reason
        from audit_log a
       where a.target_id = p_profile
          or a.target_id in (select id from subs)
          or a.target_id in (select id from ords)
    )
    select ev.at, ev.kind, ev.title, ev.detail from ev
     where ev.at is not null
     order by ev.at desc
     limit p_limit;
end $$;

grant execute on function
  fn_unblock_member(uuid,text), fn_admin_resend_login(uuid,text),
  fn_admin_set_sub_status(uuid,text,text), fn_admin_refund_order(uuid,text),
  fn_admin_set_attribution(uuid,text,text), fn_admin_add_note(uuid,text),
  fn_admin_list_notes(uuid), fn_admin_member_consent(uuid), fn_admin_revoke_consent(uuid,text),
  fn_admin_member_referrer(uuid), fn_admin_member_timeline(uuid,int)
  to authenticated, service_role;
