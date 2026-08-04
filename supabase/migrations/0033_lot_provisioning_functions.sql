-- 0033 — lot-centric provisioning RPCs (grill 2026-08). All admin-gated + audited. Canonical Box
-- states untouched; fulfilment is derived from orders.box_id + shipments. Companion to 0032.

-- Drop the old 2-arg signature so PostgREST doesn't see two overloads (named-arg ambiguity).
drop function if exists fn_provision_batch(text, int);

-- Provision a LOT: N unbound Boxes + traceability (manufactured/expiry) + optional COGS override.
create or replace function fn_provision_batch(
  p_name text,
  p_count int,
  p_manufactured_on date default current_date,
  p_expiry_date date default null,
  p_cogs numeric default null
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_batch uuid;
begin
  if not is_admin() then
    raise exception 'not authorized' using errcode = 'insufficient_privilege';
  end if;
  if p_count is null or p_count < 1 then
    raise exception 'batch size must be >= 1' using errcode = 'check_violation';
  end if;

  insert into batches(name, unit_count, created_by, manufactured_on, expiry_date, cogs_per_unit)
    values (p_name, p_count, auth.uid(), coalesce(p_manufactured_on, current_date), p_expiry_date, p_cogs)
    returning id into v_batch;

  insert into boxes(opaque_token, human_code, batch_id, status)
  select gen_box_token(), gen_human_code(), v_batch, 'unbound'
  from generate_series(1, p_count);

  perform fn_log_audit('box.provision_batch', 'batches', v_batch, null,
    jsonb_build_object('name', p_name, 'count', p_count,
                       'manufactured_on', p_manufactured_on, 'expiry_date', p_expiry_date));
  return v_batch;
end $$;

-- Bulk-void every still-unbound Box in a lot (magacin damage, misprint). Activated Boxes are
-- never touched. Reason mandatory + audited. Returns how many were voided.
create or replace function fn_void_lot_unbound(p_batch_id uuid, p_reason text)
returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not is_admin() then raise exception 'not authorized' using errcode = 'insufficient_privilege'; end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'void requires a reason (audit invariant)' using errcode = 'check_violation';
  end if;
  update boxes set status = 'void', void_reason = p_reason
   where batch_id = p_batch_id and status = 'unbound';
  get diagnostics n = row_count;
  perform fn_log_audit('box.void_lot_unbound', 'batches', p_batch_id, p_reason,
                       jsonb_build_object('voided', n));
  return n;
end $$;

-- Recall a lot: flag the LOT (recalled_at + reason). Canonical Box states are NOT changed — an
-- activated, scanned Box stays activated (fraud-floor invariant + historical truth). Blocks future
-- activation of still-unbound Boxes (see fn_activate_box). Returns the count of already-activated
-- Boxes now in members' hands (the notify list is fn_lot_recall_targets).
create or replace function fn_recall_lot(p_batch_id uuid, p_reason text)
returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not is_admin() then raise exception 'not authorized' using errcode = 'insufficient_privilege'; end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'recall requires a reason (audit invariant)' using errcode = 'check_violation';
  end if;
  update batches set recalled_at = now(), recall_reason = p_reason where id = p_batch_id;
  if not found then raise exception 'lot not found' using errcode = 'no_data_found'; end if;

  select count(*) into n from boxes where batch_id = p_batch_id and status = 'activated';
  perform fn_log_audit('lot.recall', 'batches', p_batch_id, p_reason,
                       jsonb_build_object('affected_activated', n));
  return n;
end $$;

-- Members holding an activated Box from a (recalled) lot — the notify list.
create or replace function fn_lot_recall_targets(p_batch_id uuid)
returns table(box_id uuid, human_code text, profile_id uuid, display_name text, email text, activated_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not authorized' using errcode = 'insufficient_privilege'; end if;
  return query
    select b.id, b.human_code, p.id, p.display_name, u.email::text, b.activated_at
      from boxes b
      join profiles p on p.id = b.activated_by
      join auth.users u on u.id = p.id
     where b.batch_id = p_batch_id and b.status = 'activated'
     order by b.activated_at desc;
end $$;

-- Record that a lot's labels were printed (print log). Idempotent-friendly: bumps count + stamp.
create or replace function fn_record_print(p_batch_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not authorized' using errcode = 'insufficient_privilege'; end if;
  update batches set last_printed_at = now(), print_count = print_count + 1 where id = p_batch_id;
  if not found then raise exception 'lot not found' using errcode = 'no_data_found'; end if;
  perform fn_log_audit('box.print_labels', 'batches', p_batch_id, null, null);
end $$;

-- Per-lot funnel: where are this lot's Boxes now. usable = generated; void subtracted visually.
-- shipped is DERIVED (orders.box_id → shipments in transit/delivered). aging = unbound & never
-- allocated & >30 days (real dead inventory). expired = unbound & lot past expiry.
create or replace function fn_admin_lot_funnel()
returns table(
  id uuid, name text, unit_count int, manufactured_on date, expiry_date date,
  cogs_per_unit numeric, recalled_at timestamptz, recall_reason text,
  last_printed_at timestamptz, print_count int, created_at timestamptz,
  total_boxes bigint, activated bigint, unbound bigint, void bigint,
  shipped bigint, aging_unbound bigint, expired_unbound bigint
)
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not authorized' using errcode = 'insufficient_privilege'; end if;
  return query
    select bt.id, bt.name, bt.unit_count, bt.manufactured_on, bt.expiry_date,
           bt.cogs_per_unit, bt.recalled_at, bt.recall_reason,
           bt.last_printed_at, bt.print_count, bt.created_at,
           count(b.*),
           count(b.*) filter (where b.status = 'activated'),
           count(b.*) filter (where b.status = 'unbound'),
           count(b.*) filter (where b.status = 'void'),
           count(b.*) filter (where exists (
             select 1 from orders o join shipments s on s.order_id = o.id
              where o.box_id = b.id and s.status in ('shipped','in_transit','delivered'))),
           count(b.*) filter (where b.status = 'unbound'
                                 and b.created_at < now() - interval '30 days'
                                 and not exists (select 1 from orders o where o.box_id = b.id)),
           count(b.*) filter (where b.status = 'unbound'
                                 and bt.expiry_date is not null and bt.expiry_date < current_date)
      from batches bt
      left join boxes b on b.batch_id = bt.id
     group by bt.id
     order by bt.created_at desc;
end $$;

-- Full lifecycle of ONE Box, resolved from opaque_token OR human_code OR uuid — the support /
-- fraud-investigation / recall lookup. Includes derived fulfilment + activating member.
create or replace function fn_admin_box_detail(p_code text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_box boxes%rowtype; v_bt batches%rowtype; v jsonb; v_ord record;
begin
  if not is_admin() then raise exception 'not authorized' using errcode = 'insufficient_privilege'; end if;

  select * into v_box from boxes
   where opaque_token = p_code
      or human_code = upper(trim(p_code))
      or (p_code ~ '^[0-9a-fA-F-]{36}$' and id = p_code::uuid)
   limit 1;
  if not found then return null; end if;

  select * into v_bt from batches where id = v_box.batch_id;

  select o.id as order_id, o.amount, o.charge_status, o.paid_at,
         s.status as ship_status, s.shipped_at, s.delivered_at, s.tracking_ref
    into v_ord
    from orders o
    left join shipments s on s.order_id = o.id
   where o.box_id = v_box.id
   order by o.created_at desc limit 1;

  select jsonb_build_object(
    'id', v_box.id, 'human_code', v_box.human_code, 'opaque_token', v_box.opaque_token,
    'status', v_box.status, 'created_at', v_box.created_at, 'subscription_id', v_box.subscription_id,
    'lot', jsonb_build_object(
      'id', v_bt.id, 'name', v_bt.name, 'manufactured_on', v_bt.manufactured_on,
      'expiry_date', v_bt.expiry_date, 'recalled_at', v_bt.recalled_at, 'recall_reason', v_bt.recall_reason,
      'expired', (v_bt.expiry_date is not null and v_bt.expiry_date < current_date)),
    'activation', case when v_box.status = 'activated' then jsonb_build_object(
        'activated_at', v_box.activated_at,
        'member_id', v_box.activated_by,
        'member_name', (select display_name from profiles where id = v_box.activated_by),
        'member_email', (select u.email::text from auth.users u where u.id = v_box.activated_by))
      else null end,
    'void', case when v_box.status = 'void' then jsonb_build_object('reason', v_box.void_reason) else null end,
    'fulfillment', case when v_ord.order_id is not null then jsonb_build_object(
        'order_id', v_ord.order_id, 'amount', v_ord.amount, 'charge_status', v_ord.charge_status,
        'paid_at', v_ord.paid_at, 'shipment_status', v_ord.ship_status,
        'shipped_at', v_ord.shipped_at, 'delivered_at', v_ord.delivered_at, 'tracking_ref', v_ord.tracking_ref)
      else null end
  ) into v;
  return v;
end $$;

-- Activation now also refuses recalled / expired lots for still-unbound Boxes (canonical states
-- unchanged; this only blocks NEW binds). Rewritten from 0012 with the two extra guards.
create or replace function fn_activate_box(p_code text, p_scanner uuid default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_scanner uuid := coalesce(p_scanner, auth.uid());
  v_box boxes%rowtype;
  v_bt batches%rowtype;
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
    raise exception 'box_already_bound' using errcode = 'unique_violation';
  end if;

  select * into v_bt from batches where id = v_box.batch_id;
  if v_bt.recalled_at is not null then
    raise exception 'box_recalled' using errcode = 'check_violation';
  elsif v_bt.expiry_date is not null and v_bt.expiry_date < current_date then
    raise exception 'box_expired' using errcode = 'check_violation';
  end if;

  update boxes set status = 'activated', activated_by = v_scanner, activated_at = now()
   where id = v_box.id;

  if v_box.subscription_id is not null then
    update subscriptions set owner_profile_id = v_scanner where id = v_box.subscription_id;
    return jsonb_build_object('outcome', 'subscription_transferred',
                              'subscription_id', v_box.subscription_id, 'box_id', v_box.id);
  else
    return jsonb_build_object('outcome', 'standalone_box', 'box_id', v_box.id);
  end if;
end $$;

grant execute on function
  fn_provision_batch(text,int,date,date,numeric),
  fn_void_lot_unbound(uuid,text), fn_recall_lot(uuid,text), fn_lot_recall_targets(uuid),
  fn_record_print(uuid), fn_admin_lot_funnel(), fn_admin_box_detail(text)
  to authenticated, service_role;
