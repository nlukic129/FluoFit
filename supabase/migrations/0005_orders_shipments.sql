-- 0005 — Orders (the "proof of a real sale" — ADR-0010) and Shipments (fed by the
-- FulfillmentPort stub — ADR-0014). A captured order's paid_at resets the benefit clock
-- and is the commission sale-event for a direct subscriber. Shipment delivery drives
-- doorstep-aware refill scheduling and the "our-fault" Streak freeze (ADR-0011).

create table orders (
  id              uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references subscriptions(id),
  box_id          uuid references boxes(id),             -- assigned at fulfilment
  amount          numeric(10,2) not null check (amount >= 0),
  charge_status   charge_status not null default 'pending',
  charge_ref      text,                                  -- from PaymentPort stub
  created_at      timestamptz not null default now(),
  paid_at         timestamptz                            -- set when charge_status = 'captured'
);

create index idx_orders_subscription on orders(subscription_id);

create table shipments (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references orders(id),
  status       shipment_status not null default 'created',
  tracking_ref text,                                     -- synthetic in v1 (FulfillmentPort stub)
  shipped_at   timestamptz,
  delivered_at timestamptz,
  updated_at   timestamptz not null default now()
);

create index idx_shipments_order on shipments(order_id);

create trigger trg_shipments_updated_at before update on shipments
  for each row execute function set_updated_at();
