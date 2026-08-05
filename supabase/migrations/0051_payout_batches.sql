-- 0051 — Payouts redesigned to the ADR-0008 model: FluoFit pays ONE agency a single monthly amount;
-- the per-referrer breakdown is the agency's distribution instruction. A payout BATCH (draft→paid)
-- snapshots the payable commissions it covers; marking paid records the agency invoice + date. Replaces
-- the old per-referrer "mark paid" flow. Referrers below a min threshold roll over to the next batch.

create table payout_batches (
  id                 uuid primary key default gen_random_uuid(),
  period             text not null,                                  -- run label, e.g. "2026-08"
  status             text not null default 'draft',                  -- draft | paid | cancelled
  total              numeric(12,2) not null default 0,
  referrer_count     int not null default 0,
  commission_count   int not null default 0,
  agency_invoice_ref text,
  paid_at            timestamptz,
  paid_by            uuid references profiles(id),
  created_by         uuid references profiles(id),
  created_at         timestamptz not null default now(),
  constraint payout_status_chk check (status in ('draft','paid','cancelled')),
  constraint payout_paid_has_ref check (status <> 'paid' or agency_invoice_ref is not null)
);

alter table commissions add column if not exists payout_batch_id uuid references payout_batches(id);
create index idx_commissions_batch on commissions(payout_batch_id);

alter table payout_batches enable row level security;

-- Min payout threshold (per-referrer). Config dial (ADR-0013) — default 1000 RSD, tune later.
insert into config_dials(key, value) values ('payout.min_threshold', '1000'::jsonb)
  on conflict (key) do nothing;

-- Create a draft batch: snapshot all currently-payable, unbatched commissions of referrers whose
-- payable total clears the threshold. Below-threshold referrers roll over (stay unbatched).
create or replace function fn_admin_create_payout_batch(p_period text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_batch uuid; v_threshold numeric; v_total numeric; v_rc int; v_cc int;
begin
  if not is_admin() then raise exception 'not authorized' using errcode = 'insufficient_privilege'; end if;
  v_threshold := coalesce((select (value #>> '{}')::numeric from config_dials where key = 'payout.min_threshold'), 1000);

  if not exists (
    select 1 from commissions where state = 'payable' and payout_batch_id is null
     group by referrer_id having sum(amount) >= v_threshold
  ) then
    raise exception 'nothing payable above the threshold (% RSD)', v_threshold using errcode = 'no_data_found';
  end if;

  insert into payout_batches(period, status, created_by)
    values (coalesce(nullif(trim(p_period), ''), to_char(now(), 'YYYY-MM')), 'draft', auth.uid())
    returning id into v_batch;

  update commissions c set payout_batch_id = v_batch
   where c.state = 'payable' and c.payout_batch_id is null
     and c.referrer_id in (
       select referrer_id from commissions where state = 'payable' and payout_batch_id is null
        group by referrer_id having sum(amount) >= v_threshold);

  select coalesce(sum(amount), 0), count(distinct referrer_id), count(*)
    into v_total, v_rc, v_cc from commissions where payout_batch_id = v_batch;
  update payout_batches set total = v_total, referrer_count = v_rc, commission_count = v_cc where id = v_batch;

  perform fn_log_audit('payout.create_batch', 'payout_batches', v_batch, null,
                       jsonb_build_object('total', v_total, 'referrers', v_rc, 'threshold', v_threshold));
  return v_batch;
end $$;

create or replace function fn_admin_list_payout_batches()
returns table(id uuid, period text, status text, total numeric, referrer_count int,
              commission_count int, agency_invoice_ref text, paid_at timestamptz, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not authorized' using errcode = 'insufficient_privilege'; end if;
  return query
    select b.id, b.period, b.status, b.total, b.referrer_count, b.commission_count,
           b.agency_invoice_ref, b.paid_at, b.created_at
      from payout_batches b order by b.created_at desc;
end $$;

-- Batch detail: meta + per-referrer lines (the agency distribution instruction) + agent/affiliate split.
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
        'referrer_id', c.referrer_id, 'email', u.email::text, 'name', p.display_name,
        'ref_code', r.ref_code, 'kind', r.type::text,
        'commission_count', count(*), 'amount', sum(c.amount)
      ) order by sum(c.amount) desc)
      from commissions c
      join referrers r on r.profile_id = c.referrer_id
      join profiles p on p.id = c.referrer_id
      join auth.users u on u.id = c.referrer_id
      where c.payout_batch_id = b.id
      group by c.referrer_id, u.email, p.display_name, r.ref_code, r.type), '[]'::jsonb)
  ) into v from payout_batches b where b.id = p_batch;
  return v;
end $$;

-- Mark the batch paid to the agency: records the invoice ref + date, flips its payable commissions
-- to paid (defensive: only still-payable rows), recomputes the total.
create or replace function fn_admin_mark_batch_paid(p_batch uuid, p_invoice_ref text, p_reason text)
returns int language plpgsql security definer set search_path = public as $$
declare v_status text; v_n int; v_total numeric;
begin
  if not is_admin() then raise exception 'not authorized' using errcode = 'insufficient_privilege'; end if;
  if p_invoice_ref is null or length(trim(p_invoice_ref)) = 0 then
    raise exception 'agency invoice reference is required' using errcode = 'check_violation'; end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'a reason is required (audited)' using errcode = 'check_violation'; end if;
  select status into v_status from payout_batches where id = p_batch;
  if v_status is null then raise exception 'batch not found' using errcode = 'no_data_found'; end if;
  if v_status <> 'draft' then raise exception 'batch is % (only a draft can be paid)', v_status using errcode = 'check_violation'; end if;

  update commissions set state = 'paid' where payout_batch_id = p_batch and state = 'payable';
  get diagnostics v_n = row_count;
  select coalesce(sum(amount), 0) into v_total from commissions where payout_batch_id = p_batch and state = 'paid';
  update payout_batches set status = 'paid', agency_invoice_ref = trim(p_invoice_ref),
         paid_at = now(), paid_by = auth.uid(), total = v_total, commission_count = v_n
   where id = p_batch;
  perform fn_log_audit('payout.mark_paid', 'payout_batches', p_batch, p_reason,
                       jsonb_build_object('invoice', p_invoice_ref, 'commissions_paid', v_n, 'total', v_total));
  return v_n;
end $$;

-- Cancel a draft: release its commissions back to the payable pool (unbatched).
create or replace function fn_admin_cancel_payout_batch(p_batch uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v_status text;
begin
  if not is_admin() then raise exception 'not authorized' using errcode = 'insufficient_privilege'; end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'a reason is required (audited)' using errcode = 'check_violation'; end if;
  select status into v_status from payout_batches where id = p_batch;
  if v_status is null then raise exception 'batch not found' using errcode = 'no_data_found'; end if;
  if v_status <> 'draft' then raise exception 'only a draft can be cancelled' using errcode = 'check_violation'; end if;
  update commissions set payout_batch_id = null where payout_batch_id = p_batch;
  update payout_batches set status = 'cancelled' where id = p_batch;
  perform fn_log_audit('payout.cancel_batch', 'payout_batches', p_batch, p_reason, null);
end $$;

-- Old per-referrer payout flow (contradicts ADR-0008) — removed.
drop function if exists fn_generate_payout_statement(text);
drop function if exists fn_mark_referrer_paid(uuid, text);

grant execute on function
  fn_admin_create_payout_batch(text), fn_admin_list_payout_batches(),
  fn_admin_payout_batch_detail(uuid), fn_admin_mark_batch_paid(uuid,text,text),
  fn_admin_cancel_payout_batch(uuid,text)
  to authenticated, service_role;
