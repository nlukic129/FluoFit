-- 0009 — operations: intake waves, support tickets, the audit log (an invariant, not a
-- feature — admin-console §2), and the outbox that is the adapter seam for parked domains
-- (ADR-0014). Every mutating admin action records who/when/what/why.

create table intake_waves (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  soft_cap   int,
  city_focus text,
  niche_note text,
  status     text not null default 'open',                 -- open | closed
  opened_at  timestamptz not null default now(),
  closed_at  timestamptz
);

create table applications (
  id         uuid primary key default gen_random_uuid(),
  wave_id    uuid not null references intake_waves(id),
  profile_id uuid not null references profiles(id),
  status     text not null default 'applied',              -- applied | approved | waitlisted
  decided_by uuid references profiles(id),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  unique (wave_id, profile_id)
);

create table support_tickets (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id),
  subject    text,
  body       text,
  status     text not null default 'open',                 -- open | resolved
  created_at timestamptz not null default now()
);

create table audit_log (
  id               uuid primary key default gen_random_uuid(),
  actor_profile_id uuid references profiles(id),
  action           text not null,
  target_table     text,
  target_id        uuid,
  reason           text,                                   -- mandatory on sensitive actions (enforced in fn)
  metadata         jsonb,
  at               timestamptz not null default now()
);

create index idx_audit_target on audit_log(target_table, target_id);

create table outbox (                                       -- payment/fulfillment/payout/notify events
  id           uuid primary key default gen_random_uuid(),
  port         port_name not null,
  event_type   text not null,
  payload      jsonb not null,
  status       text not null default 'pending',            -- pending → sent → failed
  created_at   timestamptz not null default now(),
  processed_at timestamptz
);

create index idx_outbox_pending on outbox(port, created_at) where status = 'pending';
