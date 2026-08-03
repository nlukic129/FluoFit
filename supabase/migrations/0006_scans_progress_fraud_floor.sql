-- 0006 — the scan ledger (append-only source of truth) → derived member_progress, and
-- the FRAUD FLOOR enforced in the database (invariant #1). The device holds only a raw
-- queue + optimistic view; XP/Streak/Level are derived server-side (ARCHITECTURE §2).

create table sachet_scans (
  id                     uuid primary key default gen_random_uuid(),
  profile_id             uuid not null references profiles(id),
  box_id                 uuid references boxes(id),        -- best-effort source Box
  scan_date_local        date not null,                    -- day in the account timezone, NOT UTC
  scanned_at             timestamptz not null,             -- client wall-clock, clamped on sync
  client_idempotency_key text not null,                    -- offline dedup key
  earned                 boolean not null default false,   -- the single earning scan for that day
  received_at            timestamptz not null default now(),
  unique (profile_id, client_idempotency_key)              -- dedup identical offline retries
);

-- At most ONE earning scan per (Member, day); unlimited non-earning scans allowed.
create unique index uq_one_earning_per_day
  on sachet_scans(profile_id, scan_date_local) where earned;

create index idx_scans_profile_date on sachet_scans(profile_id, scan_date_local);

-- Derived, server-canonical progress. Recomputed from the ledger by the scan-sync engine.
create table member_progress (
  profile_id          uuid primary key references profiles(id),
  earning_scans_total bigint not null default 0,           -- = Sachets consumed
  cumulative_xp       bigint not null default 0,           -- checkpoint XP backing (CONTEXT: XP)
  current_level       int    not null default 1,
  current_streak      int    not null default 0,
  longest_streak      int    not null default 0,
  last_earning_date   date,
  updated_at          timestamptz not null default now()
);

create trigger trg_member_progress_updated_at before update on member_progress
  for each row execute function set_updated_at();

-- FRAUD FLOOR (ADR-0006): earning scans ≤ 28 × activated Boxes (aggregate, not per-Box).
-- "XP ≤ Sachets bought" is the customer-facing shorthand; the enforced physical form is
-- earning-scans ≤ supply. No path — including an Admin correction — may break this silently.
create or replace function assert_fraud_floor() returns trigger
language plpgsql as $$
declare
  supply       int;
  earned_count int;
begin
  if NEW.earned then
    select 28 * count(*) into supply
      from boxes
      where activated_by = NEW.profile_id and status = 'activated';

    select count(*) into earned_count
      from sachet_scans
      where profile_id = NEW.profile_id and earned;

    if earned_count >= supply then
      raise exception
        'fraud_floor: earning scans (%) would exceed 28 × activated Boxes (%) for profile %',
        earned_count + 1, supply, NEW.profile_id
        using errcode = 'check_violation';
    end if;
  end if;
  return NEW;
end $$;

create trigger trg_fraud_floor before insert on sachet_scans
  for each row execute function assert_fraud_floor();
