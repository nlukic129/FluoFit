-- 0052 — fix fn_admin_payout_batch_detail: aggregate per-referrer lines in a subquery first, then
-- jsonb_agg (can't nest count()/sum() inside jsonb_agg). Same output shape as 0051.
create or replace function fn_admin_payout_batch_detail(p_batch uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  if not is_admin() then raise exception 'not authorized' using errcode = 'insufficient_privilege'; end if;
  select jsonb_build_object(
    'id', b.id, 'period', b.period, 'status', b.status, 'total', b.total,
    'referrer_count', b.referrer_count, 'commission_count', b.commission_count,
    'agency_invoice_ref', b.agency_invoice_ref, 'paid_at', b.paid_at, 'created_at', b.created_at,
    'agent_total', coalesce((select sum(c.amount) from commissions c join referrers r on r.profile_id = c.referrer_id
                              where c.payout_batch_id = b.id and r.type = 'agent'), 0),
    'affiliate_total', coalesce((select sum(c.amount) from commissions c join referrers r on r.profile_id = c.referrer_id
                              where c.payout_batch_id = b.id and r.type = 'affiliate'), 0),
    'lines', coalesce((
      select jsonb_agg(jsonb_build_object(
        'referrer_id', g.referrer_id, 'email', g.email, 'name', g.name,
        'ref_code', g.ref_code, 'kind', g.kind, 'commission_count', g.cnt, 'amount', g.amt
      ) order by g.amt desc)
      from (
        select c.referrer_id, u.email::text as email, p.display_name as name, r.ref_code, r.type::text as kind,
               count(*) as cnt, sum(c.amount) as amt
          from commissions c
          join referrers r on r.profile_id = c.referrer_id
          join profiles p on p.id = c.referrer_id
          join auth.users u on u.id = c.referrer_id
         where c.payout_batch_id = b.id
         group by c.referrer_id, u.email, p.display_name, r.ref_code, r.type
      ) g), '[]'::jsonb)
  ) into v from payout_batches b where b.id = p_batch;
  return v;
end $$;
