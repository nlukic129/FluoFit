-- 0004 — Batches & Boxes. The point where physical product enters the system
-- (admin-console §4). Codes are opaque, high-entropy, NEVER sequential. A Box lives
-- Manufactured/Unbound → Activated (or Void). First scan of a Subscription Box transfers
-- the WHOLE Subscription onto the scanner (ADR-0012); a retail Box with no subscription_id
-- makes the scanner a Standalone Box holder (ADR-0007). A scanned Box is locked.

create table batches (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,                              -- "Batch #12 — March, 500 units"
  unit_count int  not null check (unit_count > 0),
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

create table boxes (
  id              uuid primary key default gen_random_uuid(),
  opaque_token    text not null unique,                  -- QR payload, high-entropy random
  human_code      text not null unique,                  -- ~12-char fallback under the tamper seal
  batch_id        uuid not null references batches(id),
  status          box_status not null default 'unbound',
  subscription_id uuid references subscriptions(id),     -- set on Activation of a Subscription Box
  activated_by    uuid references profiles(id),
  activated_at    timestamptz,
  void_reason     text,
  created_at      timestamptz not null default now(),
  -- an activated Box must record who + when; a void Box must say why
  constraint activated_has_owner check (
    status <> 'activated' or (activated_by is not null and activated_at is not null)
  ),
  constraint void_has_reason check (status <> 'void' or void_reason is not null)
);

create index idx_boxes_batch        on boxes(batch_id);
create index idx_boxes_activated_by on boxes(activated_by) where status = 'activated';
create index idx_boxes_subscription on boxes(subscription_id);
