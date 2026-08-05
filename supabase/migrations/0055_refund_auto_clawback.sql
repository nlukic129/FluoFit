-- 0055 — refunding an order must also kill its referral commission (grill 2026-08): the sale reversed,
-- so FluoFit shouldn't pay commission on it. This is the main reason the 30-day hold exists — now it's
-- automatic. Non-paid commissions of the order → clawed_back; if one sat in a DRAFT payout batch it's
-- pulled out. Already-paid commissions can't be undone here (money left to the agency) — left as-is.
create or replace function fn_admin_refund_order(p_order uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v_clawed int;
begin
  if not is_admin() then raise exception 'not authorized' using errcode = 'insufficient_privilege'; end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'refund requires a reason' using errcode = 'check_violation'; end if;

  update orders set charge_status = 'refunded' where id = p_order and charge_status = 'captured';
  if not found then raise exception 'order not found or not refundable (must be captured)' using errcode = 'no_data_found'; end if;

  -- auto-clawback the order's commissions that haven't been paid out yet
  update commissions c
     set state = 'clawed_back',
         payout_batch_id = case
           when c.payout_batch_id is not null
                and (select b.status from payout_batches b where b.id = c.payout_batch_id) = 'draft'
           then null else c.payout_batch_id end
   where c.order_id = p_order and c.state not in ('paid', 'clawed_back');
  get diagnostics v_clawed = row_count;

  perform fn_log_audit('order.refund', 'orders', p_order, p_reason,
                       jsonb_build_object('simulated', true, 'commissions_clawed_back', v_clawed));
end $$;
