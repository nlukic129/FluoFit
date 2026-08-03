-- 0003 — Subscription. Billed per Box at shipment (ADR-0001). A refill mode is a
-- property of the Subscription, decoupled from the app (ADR-0011). The buyer discount is
-- SNAPSHOT and locked for the Subscription's life (ADR-0004/0013). The benefit clock is
-- ≤60 days from the last PAID order — scanning never resets it (ADR-0011).

create table subscriptions (
  id                       uuid primary key default gen_random_uuid(),
  owner_profile_id         uuid not null references profiles(id),
  status                   sub_status  not null default 'active',
  refill_mode              refill_mode not null,
  smart_substate           smart_substate,                        -- null for manual
  cadence_days             int check (cadence_days between 28 and 60),  -- manual only (ADR-0011)
  ref_code                 text,                                   -- captured first-touch
  buyer_discount_pct       numeric(5,2),                           -- snapshot, locked for life
  last_paid_order_at       timestamptz,
  benefit_clock_expires_at timestamptz,                            -- last_paid_order_at + 60d
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  constraint smart_has_substate check (
    (refill_mode = 'smart'  and smart_substate is not null and cadence_days is null)
    or
    (refill_mode = 'manual' and smart_substate is null     and cadence_days is not null)
  )
);

create index idx_subscriptions_owner on subscriptions(owner_profile_id);

create trigger trg_subscriptions_updated_at before update on subscriptions
  for each row execute function set_updated_at();
