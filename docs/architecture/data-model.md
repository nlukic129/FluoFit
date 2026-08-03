# FluoFit — Data model & RLS

The concrete Postgres schema behind [`ARCHITECTURE.md`](../ARCHITECTURE.md) (which owns the
stack, auth, and offline-sync mechanics) and [ADR-0014](../adr/0014-stack-monorepo-and-ports.md)
(monorepo + ports). Terms in [`/CONTEXT.md`](../../CONTEXT.md); every table encodes a decision
already made in an ADR — this doc **realises** them, it does not decide anything new.

> Status: 🟡 design draft for review — not yet migrations. Becomes `packages/db` + `supabase/migrations`
> in Phase 0. SQL below is illustrative (representative columns, not exhaustive).

## Design principles (from the invariants)

1. **The scan ledger is the source of truth.** `sachet_scans` is append-only; `member_progress`
   (XP/Streak/Level) is a **derived** projection, recomputable from the ledger. ([ARCHITECTURE §2](../ARCHITECTURE.md#2-offline-session--scanning-))
2. **The fraud floor is a DB constraint**, not app logic: earning scans ≤ `28 × activated Boxes`. ([ADR-0006](../adr/0006-aggregate-supply-and-fraud-floor.md))
3. **RLS on every table from day 1**; the consent join is the only door to coaching data. ([ADR-0003](../adr/0003-affiliate-consent-boundary.md))
4. **Config is versioned** so grandfathering is expressible per dial. ([ADR-0013](../adr/0013-dynamic-config-grandfathering-and-manual-margin.md))
5. **Parked domains are `outbox` rows** consumed by adapter ports — the DB never calls a vendor. ([ADR-0014](../adr/0014-stack-monorepo-and-ports.md))

Naming: `snake_case`, UUID PKs (`gen_random_uuid()`), `timestamptz` everywhere, enums as
Postgres `enum` types.

---

## 1. Identity

```sql
create type app_role as enum ('member','agent','affiliate','admin');

create table profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  roles             app_role[] not null default '{member}',   -- array from day 1 (ARCHITECTURE §1)
  account_timezone  text not null default 'Europe/Belgrade',  -- Streak day boundary (CONTEXT: Streak)
  display_name      text,
  created_at        timestamptz not null default now()
);
```

`Prospect / Member / Lapsed Member` is **derived** from the person's subscriptions, not a stored
column — a profile with no subscription is a Prospect; with an `active` one, a Member; with only
`lapsed`/`cancelled`, a Lapsed Member.

---

## 2. Boxes, Batches, Sachet (physical product enters here)

```sql
create type box_status as enum ('unbound','activated','void');  -- Manufactured/Unbound → Activated | Void

create table batches (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,                       -- "Batch #12 — March, 500 units"
  unit_count  int  not null check (unit_count > 0),
  created_by  uuid not null references profiles(id),
  created_at  timestamptz not null default now()
);

create table boxes (
  id               uuid primary key default gen_random_uuid(),
  opaque_token     text not null unique,           -- high-entropy, NEVER sequential (admin-console §4)
  human_code       text not null unique,           -- ~12-char fallback under the tamper seal
  batch_id         uuid not null references batches(id),
  status           box_status not null default 'unbound',
  subscription_id  uuid references subscriptions(id),  -- set on Activation of a Subscription Box
  activated_by     uuid references profiles(id),
  activated_at     timestamptz,
  void_reason      text,
  created_at       timestamptz not null default now()
);
-- Sachet QR is a single non-unique static code (CONTEXT: Sachet) — config, not a table.
```

One-time activation: a row can move `unbound → activated` once; a second scan hits the
"already bound → support" path. First scan of a **Subscription** Box transfers the whole
Subscription onto the scanner ([ADR-0012](../adr/0012-identity-checkout-and-box-ownership.md));
a **retail** Box with no `subscription_id` makes the scanner a Standalone Box holder
([ADR-0007](../adr/0007-standalone-gift-retail-box-activation.md)).

---

## 3. Subscription, orders, shipments

```sql
create type sub_status    as enum ('active','paused','lapsed','cancelled');
create type refill_mode   as enum ('smart','manual');
create type smart_substate as enum ('pending','active');   -- only when refill_mode='smart'

create table subscriptions (
  id                       uuid primary key default gen_random_uuid(),
  owner_profile_id         uuid not null references profiles(id),
  status                   sub_status not null default 'active',
  refill_mode              refill_mode not null,
  smart_substate           smart_substate,                 -- null for manual
  cadence_days             int check (cadence_days between 28 and 60),  -- manual only (ADR-0011)
  ref_code                 text,                            -- captured first-touch
  buyer_discount_pct       numeric(5,2),                    -- SNAPSHOT, locked for life (ADR-0004/0013)
  last_paid_order_at       timestamptz,
  benefit_clock_expires_at timestamptz,                     -- last_paid_order_at + 60d (ADR-0011)
  created_at               timestamptz not null default now(),
  constraint smart_has_substate check (
    (refill_mode='smart' and smart_substate is not null and cadence_days is null)
    or (refill_mode='manual' and smart_substate is null and cadence_days is not null))
);

create type charge_status as enum ('pending','authorized','captured','failed','refunded');

create table orders (                                       -- the "proof of a real sale" (ADR-0010)
  id               uuid primary key default gen_random_uuid(),
  subscription_id  uuid not null references subscriptions(id),
  box_id           uuid references boxes(id),               -- assigned at fulfilment
  amount           numeric(10,2) not null,
  charge_status    charge_status not null default 'pending',
  charge_ref       text,                                    -- from PaymentPort stub
  created_at       timestamptz not null default now(),
  paid_at          timestamptz                              -- sets last_paid_order_at + benefit clock
);

create type shipment_status as enum ('created','shipped','in_transit','delivered');

create table shipments (                                    -- fed by FulfillmentPort stub
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references orders(id),
  status        shipment_status not null default 'created',
  tracking_ref  text,
  shipped_at    timestamptz,
  delivered_at  timestamptz                                 -- doorstep clock + Streak our-fault freeze
);
```

**Benefit clock** (`benefit_clock_expires_at`) and **refill trigger** run in Edge Functions +
`pg_cron`; only `paid_at` (a captured order) resets the clock — scanning never does ([ADR-0011](../adr/0011-refill-mode-decoupled-and-benefit-clock.md)).

---

## 4. Scan ledger → derived progress (the heart)

```sql
create table sachet_scans (
  id                    uuid primary key default gen_random_uuid(),
  profile_id            uuid not null references profiles(id),
  box_id                uuid references boxes(id),          -- best-effort source Box
  scan_date_local       date not null,                      -- day in account timezone, NOT UTC
  scanned_at            timestamptz not null,               -- client wall-clock, clamped on sync
  client_idempotency_key text not null,                     -- offline dedup
  earned                boolean not null default false,     -- true = the one earning scan that day
  received_at           timestamptz not null default now(),
  unique (profile_id, client_idempotency_key),              -- dedup on sync
  unique (profile_id, scan_date_local, earned)              -- ≤ one earning scan per (Member, day)
);

create table member_progress (                              -- DERIVED, server-canonical
  profile_id          uuid primary key references profiles(id),
  earning_scans_total bigint not null default 0,            -- = Sachets consumed
  cumulative_xp       bigint not null default 0,            -- checkpoint XP backing (CONTEXT: XP)
  current_level       int    not null default 1,
  current_streak      int    not null default 0,
  longest_streak      int    not null default 0,
  last_earning_date   date,
  updated_at          timestamptz not null default now()
);
```

`cumulative_xp` and `current_level` are recomputed from the ledger by the `scan-sync` Edge
Function; the device keeps only an **optimistic view** and reconciles on sync. Only one scan per
`(profile, scan_date_local)` earns; extra scans are allowed but `earned=false`.

### Fraud floor — enforced in the DB ([ADR-0006](../adr/0006-aggregate-supply-and-fraud-floor.md))

The hard, physical invariant is **earning scans ≤ 28 × activated Boxes** (each earning scan
consumes one Sachet; "XP ≤ Sachets bought" is the customer-facing shorthand). Enforced by a
trigger so no code path — including an Admin correction — can silently break it:

```sql
create or replace function assert_fraud_floor() returns trigger as $$
declare supply int;
begin
  if NEW.earned then
    select 28 * count(*) into supply
      from boxes where activated_by = NEW.profile_id and status='activated';
    if (select count(*) from sachet_scans
          where profile_id = NEW.profile_id and earned) >= supply then
      raise exception 'fraud_floor: earning scans would exceed 28 × activated Boxes (%).', supply
        using errcode = 'check_violation';
    end if;
  end if;
  return NEW;
end $$ language plpgsql;

create trigger trg_fraud_floor before insert on sachet_scans
  for each row execute function assert_fraud_floor();
```

An Admin XP/Streak correction (admin-console §6) runs through a function that re-checks this and
raises a **loud exception** rather than editing past it.

---

## 5. Gamification config (grandfathering-aware — [ADR-0013](../adr/0013-dynamic-config-grandfathering-and-manual-margin.md))

```sql
create type perk_funding as enum ('partner','spend','zero');

create table levels (                                       -- Admin-editable; never delete a held Level
  id          uuid primary key default gen_random_uuid(),
  ordinal     int not null unique,
  threshold_xp bigint not null,                             -- checkpoint to next Level
  name        text not null,
  icon        text
);

create table perks (
  id       uuid primary key default gen_random_uuid(),
  name     text not null,
  funding  perk_funding not null,
  cost_hint numeric(10,2)                                   -- for the offline margin calculator
);

create table level_perks ( level_id uuid references levels(id), perk_id uuid references perks(id),
  primary key (level_id, perk_id) );

create table partners (                                     -- fully admin-managed, no login (v1)
  id uuid primary key default gen_random_uuid(),
  name text not null, kind text, contact text,
  active boolean not null default true, valid_until date
);
create table partner_perks ( partner_id uuid references partners(id), perk_id uuid references perks(id),
  level_id uuid references levels(id), discount_tier text, primary key (partner_id, perk_id, level_id) );

-- Spend-funded rewards are SNAPSHOTTED at crossing (grandfathered); partner-funded read live.
create table member_reward_snapshots (
  profile_id uuid references profiles(id), perk_id uuid references perks(id),
  level_id uuid references levels(id), snapshotted_at timestamptz not null default now(),
  primary key (profile_id, perk_id)
);

-- Every tunable dial; history table gives per-dial grandfathering.
create table config_dials    ( key text primary key, value jsonb not null,
  updated_at timestamptz not null default now(), updated_by uuid references profiles(id) );
create table config_versions ( id uuid primary key default gen_random_uuid(), key text not null,
  value jsonb not null, effective_from timestamptz not null default now(),
  changed_by uuid references profiles(id), reason text );
```

---

## 6. Referral — referrers, attribution, commission, consent

```sql
create type referrer_type   as enum ('agent','affiliate');
create type referrer_status as enum ('active','paused','offboarded');
create type commission_state as enum ('accrued','cleared','payable','paid','clawed_back');

create table referrers (
  profile_id       uuid primary key references profiles(id),
  type             referrer_type not null,
  status           referrer_status not null default 'active',
  ref_code         text not null unique,
  fixed_pct        numeric(5,2),                            -- affiliate only
  current_tier     int,                                     -- agent only, recomputed monthly
  eligibility_met_at timestamptz
);

create table attributions (                                 -- first-touch, locked for the sub's life
  subscription_id uuid primary key references subscriptions(id),
  referrer_id     uuid not null references referrers(profile_id),
  ref_code        text not null,
  first_touch_at  timestamptz not null,
  grace_until     timestamptz                               -- 14d / 2nd Box retroactive window
);

create table commissions (
  id              uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references subscriptions(id),
  referrer_id     uuid not null references referrers(profile_id),
  order_id        uuid references orders(id),
  amount          numeric(10,2) not null,
  state           commission_state not null default 'accrued',
  hold_until      timestamptz,                              -- 30-day clearing hold
  cleared_at      timestamptz,
  created_at      timestamptz not null default now()
);

create table consents (                                     -- the ONLY door to coaching data
  id                uuid primary key default gen_random_uuid(),
  client_profile_id uuid not null references profiles(id),
  referrer_id       uuid not null references referrers(profile_id),
  granted_at        timestamptz not null default now(),
  revoked_at        timestamptz,
  unique (client_profile_id, referrer_id)
);
```

`Accrued` keys off the **paid order** for a direct subscriber (may never scan), off the
Activation scan only for a Standalone Box ([ADR-0010](../adr/0010-app-optional-scheduled-subscription.md)). Consent revocation gates
**data only** — commission/attribution are untouched.

---

## 7. Intake waves, support, audit, ports

```sql
create table intake_waves ( id uuid primary key default gen_random_uuid(), name text,
  soft_cap int, city_focus text, niche_note text, status text default 'open',
  opened_at timestamptz default now(), closed_at timestamptz );
create table applications ( id uuid primary key default gen_random_uuid(),
  wave_id uuid references intake_waves(id), profile_id uuid references profiles(id),
  status text default 'applied', decided_by uuid references profiles(id), decided_at timestamptz );

create table support_tickets ( id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id), subject text, body text,
  status text default 'open', created_at timestamptz default now() );

create table audit_log (                                    -- invariant, not a feature (admin-console §2)
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid references profiles(id),
  action text not null, target_table text, target_id uuid,
  reason text,                                              -- mandatory on sensitive actions
  metadata jsonb, at timestamptz not null default now()
);

create type port_name as enum ('payment','fulfillment','payout','notify');
create table outbox (                                       -- adapter seam (ADR-0014)
  id uuid primary key default gen_random_uuid(),
  port port_name not null, event_type text not null, payload jsonb not null,
  status text not null default 'pending',                  -- pending → sent → failed
  created_at timestamptz default now(), processed_at timestamptz
);
```

---

## 8. RLS — the enforcement layer ([ADR-0003](../adr/0003-affiliate-consent-boundary.md))

Every table has `enable row level security`. Helpers keep policies readable:

```sql
create or replace function is_admin() returns boolean language sql stable as $$
  select 'admin' = any ((select roles from profiles where id = auth.uid())) $$;

-- referrer sees a client's coaching data ONLY with an active consent AND an attribution link
create or replace function can_coach(client uuid) returns boolean language sql stable as $$
  select exists (
    select 1 from consents c
      join attributions a on a.referrer_id = c.referrer_id
      join subscriptions s on s.id = a.subscription_id
     where c.client_profile_id = client and c.referrer_id = auth.uid()
       and c.revoked_at is null and s.owner_profile_id = client) $$;
```

Representative policies:

```sql
-- profiles: self only (admin via is_admin())
create policy p_profiles_self on profiles for select using (id = auth.uid() or is_admin());

-- scans & progress: the Member; a referrer only through consent (coaching plane)
create policy p_scans_owner on sachet_scans for select
  using (profile_id = auth.uid() or is_admin() or can_coach(profile_id));
create policy p_progress_owner on member_progress for select
  using (profile_id = auth.uid() or is_admin() or can_coach(profile_id));
create policy p_scans_insert on sachet_scans for insert with check (profile_id = auth.uid());

-- subscriptions / orders: owner + admin
create policy p_subs_owner on subscriptions for select using (owner_profile_id = auth.uid() or is_admin());

-- commissions: the referrer sees their own rows (pseudonymous unless can_coach reveals identity)
create policy p_comm_own on commissions for select using (referrer_id = auth.uid() or is_admin());

-- consents: the client manages their own; the referrer may read consents naming them
create policy p_consent_client on consents for all
  using (client_profile_id = auth.uid()) with check (client_profile_id = auth.uid());
create policy p_consent_referrer_read on consents for select using (referrer_id = auth.uid());

-- config, levels, partners, waves, audit, outbox: admin-only writes; reads scoped per surface
create policy p_config_admin on config_dials for all using (is_admin()) with check (is_admin());
```

**Time-of-day is never exposed to a referrer:** `scanned_at` is never selected by the coaching
plane — the Agent/Affiliate app reads only `scan_date_local` + derived adherence
([agent-affiliate-app §2](../product/agent-affiliate-app.md)). Enforce with a **coaching view**
that omits `scanned_at`, not raw table access.

---

## Open / next

- 🟡 Turn this draft into `packages/db` migrations + generated types (Phase 0).
- ⬜ Exact XP formula (base + Streak multiplier) — config-only, values pending COGS ([ADR-0013](../adr/0013-dynamic-config-grandfathering-and-manual-margin.md)).
- ⬜ Coaching **view** definition (adherence %, sachets remaining) that structurally excludes `scanned_at`.
- ⬜ Dunning window length / retry cadence — parked with the payment provider ([ADR-0005](../adr/0005-subscription-lifecycle-and-lapse.md)).
