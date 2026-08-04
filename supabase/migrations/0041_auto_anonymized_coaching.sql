-- 0041 — REVERSES the consent-gated coaching boundary (ADR-0003, invariant #3). New model:
-- a referrer AUTOMATICALLY sees the activity of anyone they referred — including time-of-day —
-- but NEVER their identity (name/email). Coaching is now gated by ATTRIBUTION, not consent.
-- Identity stays hidden because the view exposes only the pseudonymous client_profile_id.
-- The consents table is left dormant (no longer a gate); admin consent RPCs are dropped.

-- Gate: can coach anyone whose subscription is attributed to me (no consent lookup).
create or replace function can_coach(client uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from attributions a
      join subscriptions s on s.id = a.subscription_id
     where s.owner_profile_id = client and a.referrer_id = auth.uid()
  )
$$;

-- Coaching view now INCLUDES scanned_at (time-of-day). Still no identity — only the pseudonymous
-- client_profile_id. (New column appended at the end so CREATE OR REPLACE VIEW is valid.)
create or replace view v_coaching_consumption as
  select s.profile_id as client_profile_id, s.scan_date_local, s.earned, s.scanned_at
    from sachet_scans s
   where can_coach(s.profile_id);

-- Consent is no longer a concept in the admin support console.
drop function if exists fn_admin_member_consent(uuid);
drop function if exists fn_admin_revoke_consent(uuid, text);

comment on table consents is 'DEPRECATED 2026-08-04 (ADR-0003 revised): coaching is now auto-shared by attribution, anonymized, incl. time-of-day. Table kept dormant; no longer a gate.';
