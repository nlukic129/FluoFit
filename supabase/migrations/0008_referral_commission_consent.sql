-- 0008 — the referral layer. Commission binds on the SALE EVENT: the paid order for a
-- direct subscriber (ADR-0010), the Activation scan only for a Standalone Box. Lifecycle
-- Accrued → Cleared (30d hold) → Payable → Paid, clawback before clearing (ADR-0008).
-- Consent — not role — is the ONLY door to a client's coaching data (ADR-0003).

create table referrers (
  profile_id         uuid primary key references profiles(id),
  type               referrer_type   not null,
  status             referrer_status not null default 'active',
  ref_code           text not null unique,
  fixed_pct          numeric(5,2),                          -- affiliate only
  current_tier       int,                                   -- agent only, recomputed monthly
  eligibility_met_at timestamptz,
  created_at         timestamptz not null default now()
);

create table attributions (                                 -- first-touch, locked for the sub's life
  subscription_id uuid primary key references subscriptions(id),
  referrer_id     uuid not null references referrers(profile_id),
  ref_code        text not null,
  first_touch_at  timestamptz not null default now(),
  grace_until     timestamptz                               -- 14d / 2nd Box retroactive window
);

create index idx_attributions_referrer on attributions(referrer_id);

create table commissions (
  id              uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references subscriptions(id),
  referrer_id     uuid not null references referrers(profile_id),
  order_id        uuid references orders(id),
  amount          numeric(10,2) not null check (amount >= 0),
  state           commission_state not null default 'accrued',
  hold_until      timestamptz,                              -- 30-day clearing hold
  cleared_at      timestamptz,
  created_at      timestamptz not null default now()
);

create index idx_commissions_referrer on commissions(referrer_id, state);

create table consents (                                     -- client opt-in to be coached
  id                uuid primary key default gen_random_uuid(),
  client_profile_id uuid not null references profiles(id),
  referrer_id       uuid not null references referrers(profile_id),
  granted_at        timestamptz not null default now(),
  revoked_at        timestamptz,
  unique (client_profile_id, referrer_id)
);

create index idx_consents_active on consents(referrer_id, client_profile_id) where revoked_at is null;
