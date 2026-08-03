-- 0017 — Payouts + Fraud review (M5). The commission lifecycle Accrued → Cleared → Payable →
-- Paid (ADR-0008) is driven here: a monthly statement lists payable amounts per recipient; the
-- agency confirms; the admin marks each recipient Paid. Fraud review lists held commissions and
-- uses the release/clawback RPCs from 0014. All admin-gated + audited.

-- Monthly statement: payable totals per referrer (→ the agency). Read-only preview.
create or replace function fn_generate_payout_statement(p_period text)
returns table(referrer_id uuid, email text, ref_code text, total numeric, commission_count int)
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not authorized' using errcode = 'insufficient_privilege'; end if;
  return query
    select c.referrer_id, u.email::text, r.ref_code, sum(c.amount)::numeric, count(*)::int
      from commissions c
      join referrers r on r.profile_id = c.referrer_id
      join auth.users u on u.id = c.referrer_id
     where c.state = 'payable'
     group by c.referrer_id, u.email, r.ref_code
     order by sum(c.amount) desc;
end $$;

-- Mark a recipient's payable commissions as Paid once the agency confirms.
create or replace function fn_mark_referrer_paid(p_referrer uuid, p_reason text)
returns int language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  if not is_admin() then raise exception 'not authorized' using errcode = 'insufficient_privilege'; end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'marking paid requires a reason' using errcode = 'check_violation'; end if;

  update commissions set state = 'paid' where referrer_id = p_referrer and state = 'payable';
  get diagnostics v_count = row_count;
  perform fn_log_audit('payout.mark_paid', 'referrers', p_referrer, p_reason,
                       jsonb_build_object('commissions_paid', v_count));
  return v_count;
end $$;

-- List commissions (optionally by state) with referrer email — for Payouts + Fraud tables.
create or replace function fn_admin_list_commissions(p_state commission_state default null)
returns table(id uuid, referrer_id uuid, email text, amount numeric, state text,
              hold_until timestamptz, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not authorized' using errcode = 'insufficient_privilege'; end if;
  return query
    select c.id, c.referrer_id, u.email::text, c.amount, c.state::text, c.hold_until, c.created_at
      from commissions c
      join auth.users u on u.id = c.referrer_id
     where p_state is null or c.state = p_state
     order by c.created_at desc
     limit 500;
end $$;
