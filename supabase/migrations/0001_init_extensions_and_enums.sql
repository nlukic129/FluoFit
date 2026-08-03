-- 0001 — extensions, enum types, and shared trigger helpers.
-- FluoFit schema realises the design in docs/architecture/data-model.md.
-- gen_random_uuid() is core in Postgres 13+; no extension needed.

-- Enum types (created once, referenced by later migrations) --------------------
create type app_role         as enum ('member','agent','affiliate','admin');
create type box_status       as enum ('unbound','activated','void');       -- Manufactured/Unbound → Activated | Void
create type sub_status       as enum ('active','paused','lapsed','cancelled');
create type refill_mode      as enum ('smart','manual');
create type smart_substate   as enum ('pending','active');
create type charge_status    as enum ('pending','authorized','captured','failed','refunded');
create type shipment_status  as enum ('created','shipped','in_transit','delivered');
create type perk_funding     as enum ('partner','spend','zero');
create type referrer_type    as enum ('agent','affiliate');
create type referrer_status  as enum ('active','paused','offboarded');
create type commission_state as enum ('accrued','cleared','payable','paid','clawed_back');
create type port_name        as enum ('payment','fulfillment','payout','notify');

-- Shared: keep updated_at fresh --------------------------------------------------
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;
