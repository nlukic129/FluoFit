-- 0032 — Batch becomes a manufacturing LOT (admin-console §4, grill 2026-08). A batch is no
-- longer just a print run: it is a physical production lot with traceability (manufactured/expiry),
-- an optional per-lot COGS override, a recall flag, and a print log. Canonical Box states are
-- untouched (unbound → activated | void) — scanning stays the source of truth and the fraud
-- floor (28 × activated Boxes) is preserved. Fulfilment (allocated/shipped/delivered) stays a
-- DERIVED, read-only view from orders.box_id + shipments; we add no writable Box states here.

alter table batches
  add column if not exists manufactured_on date        not null default current_date,
  add column if not exists expiry_date     date,
  add column if not exists cogs_per_unit   numeric(10,2) check (cogs_per_unit is null or cogs_per_unit >= 0),
  add column if not exists recalled_at     timestamptz,
  add column if not exists recall_reason   text,
  add column if not exists last_printed_at timestamptz,
  add column if not exists print_count     int not null default 0,
  -- a recalled lot must record why
  add constraint recall_has_reason check (recalled_at is null or recall_reason is not null);

-- Backfill existing lots: treat creation date as the manufacture date and assume an 18-month
-- shelf life so expiry logic has something to work with. (Real lots set both at creation.)
update batches
   set manufactured_on = created_at::date,
       expiry_date     = coalesce(expiry_date, (created_at::date + interval '18 months')::date)
 where expiry_date is null;
