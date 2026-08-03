-- 0007 — gamification & the versioned config engine (ADR-0013). Level never drops; a Level
-- with holders is never deleted. Spend-funded rewards are SNAPSHOTTED at crossing
-- (grandfathered); partner-funded read live. FluoFit never cuts its own price via Levels.

create table levels (                                       -- Admin-editable; never delete a held Level
  id           uuid primary key default gen_random_uuid(),
  ordinal      int    not null unique,
  threshold_xp bigint not null check (threshold_xp >= 0),   -- checkpoint to the NEXT Level
  name         text   not null,
  icon         text
);

create table perks (
  id        uuid primary key default gen_random_uuid(),
  name      text not null,
  funding   perk_funding not null,
  cost_hint numeric(10,2)                                   -- for the offline margin calculator
);

create table level_perks (
  level_id uuid not null references levels(id),
  perk_id  uuid not null references perks(id),
  primary key (level_id, perk_id)
);

create table partners (                                     -- fully admin-managed, no login (v1)
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  kind       text,                                          -- gym / shop / event
  contact    text,
  active     boolean not null default true,
  valid_until date,
  created_at timestamptz not null default now()
);

create table partner_perks (
  partner_id    uuid not null references partners(id),
  perk_id       uuid not null references perks(id),
  level_id      uuid not null references levels(id),
  discount_tier text,
  primary key (partner_id, perk_id, level_id)
);

-- Grandfathering: spend-funded/zero rewards are pinned per Member at the moment they cross.
create table member_reward_snapshots (
  profile_id     uuid not null references profiles(id),
  perk_id        uuid not null references perks(id),
  level_id       uuid not null references levels(id),
  snapshotted_at timestamptz not null default now(),
  primary key (profile_id, perk_id)
);

-- Every tunable dial + an append-only history for per-dial grandfathering.
create table config_dials (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles(id)
);

create table config_versions (
  id             uuid primary key default gen_random_uuid(),
  key            text not null,
  value          jsonb not null,
  effective_from timestamptz not null default now(),
  changed_by     uuid references profiles(id),
  reason         text
);

create index idx_config_versions_key on config_versions(key, effective_from desc);
