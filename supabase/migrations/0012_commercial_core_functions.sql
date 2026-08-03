-- 0012 — commercial-core RPCs (Phase 1). Box provisioning, subscription + order lifecycle,
-- and Box Activation with the whole-Subscription transfer (ADR-0012) / Standalone branch
-- (ADR-0007). All SECURITY DEFINER; admin actions gated by is_admin() + audited. Payment and
-- fulfilment stay behind ports in the app — these functions only record the resulting state.

-- Opaque, high-entropy, non-sequential Box code (64 hex chars). Human fallback = 12 uppercase.
create or replace function gen_box_token() returns text
language sql volatile as $$
  select replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
$$;
create or replace function gen_human_code() returns text
language sql volatile as $$
  select upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))
$$;

-- Provision a named Batch of N unbound Boxes (admin-only, audited) — admin-console §4.
create or replace function fn_provision_batch(p_name text, p_count int)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_batch uuid;
begin
  if not is_admin() then
    raise exception 'not authorized' using errcode = 'insufficient_privilege';
  end if;
  if p_count is null or p_count < 1 then
    raise exception 'batch size must be >= 1' using errcode = 'check_violation';
  end if;

  insert into batches(name, unit_count, created_by) values (p_name, p_count, auth.uid())
    returning id into v_batch;

  insert into boxes(opaque_token, human_code, batch_id, status)
  select gen_box_token(), gen_human_code(), v_batch, 'unbound'
  from generate_series(1, p_count);

  perform fn_log_audit('box.provision_batch', 'batches', v_batch, null,
                       jsonb_build_object('name', p_name, 'count', p_count));
  return v_batch;
end $$;

-- Void a not-yet-activated Box (admin-only, reason mandatory, audited).
create or replace function fn_void_box(p_box_id uuid, p_reason text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'not authorized' using errcode = 'insufficient_privilege';
  end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'void requires a reason (audit invariant)' using errcode = 'check_violation';
  end if;

  update boxes set status = 'void', void_reason = p_reason
   where id = p_box_id and status = 'unbound';
  if not found then
    raise exception 'box not found or not voidable (already activated?)' using errcode = 'no_data_found';
  end if;

  perform fn_log_audit('box.void', 'boxes', p_box_id, p_reason, null);
end $$;

-- Create a Subscription (mode + cadence chosen at checkout — ADR-0011). Acts for the caller;
-- an Admin may create on behalf of another owner. ref_code is captured; attribution rows land
-- with the referral engine (Phase 4).
create or replace function fn_create_subscription(
  p_owner uuid, p_refill_mode refill_mode, p_smart_substate smart_substate,
  p_cadence int, p_ref_code text default null, p_discount numeric default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid := coalesce(p_owner, auth.uid());
  v_sub uuid;
begin
  if v_owner <> auth.uid() and not is_admin() then
    raise exception 'not authorized to create for another owner' using errcode = 'insufficient_privilege';
  end if;

  insert into subscriptions(owner_profile_id, status, refill_mode, smart_substate, cadence_days,
                            ref_code, buyer_discount_pct)
  values (v_owner, 'active', p_refill_mode,
          case when p_refill_mode = 'smart' then coalesce(p_smart_substate, 'pending') else null end,
          case when p_refill_mode = 'manual' then p_cadence else null end,
          p_ref_code, p_discount)
  returning id into v_sub;
  return v_sub;
end $$;

-- Record a pending order for a Subscription (the app charges via PaymentPort, then marks paid).
create or replace function fn_place_order(p_subscription uuid, p_amount numeric)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_order uuid;
begin
  insert into orders(subscription_id, amount, charge_status)
  values (p_subscription, p_amount, 'pending')
  returning id into v_order;
  return v_order;
end $$;

-- Capture an order (PaymentPort succeeded) → this is the "paid order" that resets the benefit
-- clock (ADR-0011): Perks + referred discount live 60 days from here.
create or replace function fn_mark_order_paid(p_order uuid, p_charge_ref text)
returns void
language plpgsql security definer set search_path = public as $$
declare v_sub uuid;
begin
  update orders set charge_status = 'captured', charge_ref = p_charge_ref, paid_at = now()
   where id = p_order and charge_status <> 'captured'
   returning subscription_id into v_sub;
  if not found then
    raise exception 'order not found or already captured' using errcode = 'no_data_found';
  end if;

  update subscriptions
     set last_paid_order_at = now(),
         benefit_clock_expires_at = now() + interval '60 days'
   where id = v_sub;
end $$;

-- Box Activation: the branch point. One-time; a scanned Box is locked. For a Subscription Box
-- the WHOLE Subscription transfers onto the scanner (ADR-0012); a retail Box makes the scanner
-- a Standalone Box holder (ADR-0007). Accepts either the QR token or the human fallback code.
create or replace function fn_activate_box(p_code text, p_scanner uuid default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_scanner uuid := coalesce(p_scanner, auth.uid());
  v_box boxes%rowtype;
begin
  if p_scanner is not null and p_scanner <> auth.uid() and not is_admin() then
    raise exception 'not authorized to activate for another account' using errcode = 'insufficient_privilege';
  end if;

  select * into v_box from boxes
   where opaque_token = p_code or human_code = upper(p_code)
   for update;

  if not found then
    raise exception 'box_not_found' using errcode = 'no_data_found';
  elsif v_box.status = 'void' then
    raise exception 'box_void' using errcode = 'check_violation';
  elsif v_box.status = 'activated' then
    -- already bound → the app routes this to the "contact support" path, never a silent reject
    raise exception 'box_already_bound' using errcode = 'unique_violation';
  end if;

  update boxes set status = 'activated', activated_by = v_scanner, activated_at = now()
   where id = v_box.id;

  if v_box.subscription_id is not null then
    -- Subscription Box: transfer the whole Subscription onto the scanner (consolidation).
    update subscriptions set owner_profile_id = v_scanner where id = v_box.subscription_id;
    return jsonb_build_object('outcome', 'subscription_transferred',
                              'subscription_id', v_box.subscription_id, 'box_id', v_box.id);
  else
    -- Retail Box: the scanner now holds a Standalone Box (earn, but redeem only once subscribed).
    return jsonb_build_object('outcome', 'standalone_box', 'box_id', v_box.id);
  end if;
end $$;
