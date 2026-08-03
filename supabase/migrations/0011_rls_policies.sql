-- 0011 — Row-Level Security. Enabled on EVERY table (invariant). The server (service_role)
-- bypasses RLS for engine writes; these policies govern what a logged-in user may read/write
-- directly. Consent-gated coaching data is read only through v_coaching_consumption (0010).

alter table profiles                enable row level security;
alter table subscriptions           enable row level security;
alter table batches                 enable row level security;
alter table boxes                   enable row level security;
alter table orders                  enable row level security;
alter table shipments               enable row level security;
alter table sachet_scans            enable row level security;
alter table member_progress         enable row level security;
alter table levels                  enable row level security;
alter table perks                   enable row level security;
alter table level_perks             enable row level security;
alter table partners                enable row level security;
alter table partner_perks           enable row level security;
alter table member_reward_snapshots enable row level security;
alter table config_dials            enable row level security;
alter table config_versions         enable row level security;
alter table referrers               enable row level security;
alter table attributions            enable row level security;
alter table commissions             enable row level security;
alter table consents                enable row level security;
alter table intake_waves            enable row level security;
alter table applications            enable row level security;
alter table support_tickets         enable row level security;
alter table audit_log               enable row level security;
alter table outbox                  enable row level security;

-- Identity ----------------------------------------------------------------------
create policy p_profiles_read on profiles for select to authenticated
  using (id = auth.uid() or is_admin());
create policy p_profiles_update_self on profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Subscription & fulfilment (owner reads; server writes) ------------------------
create policy p_subs_read on subscriptions for select to authenticated
  using (owner_profile_id = auth.uid() or is_admin());
create policy p_orders_read on orders for select to authenticated
  using (is_admin() or exists (
    select 1 from subscriptions s where s.id = orders.subscription_id and s.owner_profile_id = auth.uid()));
create policy p_shipments_read on shipments for select to authenticated
  using (is_admin() or exists (
    select 1 from orders o join subscriptions s on s.id = o.subscription_id
     where o.id = shipments.order_id and s.owner_profile_id = auth.uid()));

-- Boxes / batches — admin-only direct access (activation runs server-side) -------
create policy p_batches_admin on batches for select to authenticated using (is_admin());
create policy p_boxes_admin   on boxes   for select to authenticated
  using (is_admin() or activated_by = auth.uid());

-- Scans: owner reads own; owner inserts own. Coaching consumption goes via the view.
create policy p_scans_read on sachet_scans for select to authenticated
  using (profile_id = auth.uid() or is_admin());
create policy p_scans_insert on sachet_scans for insert to authenticated
  with check (profile_id = auth.uid());

-- Progress: owner + admin + a consented referrer (no time-of-day here).
create policy p_progress_read on member_progress for select to authenticated
  using (profile_id = auth.uid() or is_admin() or can_coach(profile_id));

-- Gamification catalog — readable by all authenticated; writes are admin/server only.
create policy p_levels_read       on levels       for select to authenticated using (true);
create policy p_perks_read        on perks        for select to authenticated using (true);
create policy p_level_perks_read  on level_perks  for select to authenticated using (true);
create policy p_partners_read     on partners     for select to authenticated using (active or is_admin());
create policy p_partner_perks_read on partner_perks for select to authenticated using (true);
create policy p_reward_snap_read  on member_reward_snapshots for select to authenticated
  using (profile_id = auth.uid() or is_admin());

-- Config: dials readable by all authenticated; version history admin-only. Writes go
-- through fn_apply_config (security definer) — no direct write policy exists, so direct
-- INSERT/UPDATE by a user is denied.
create policy p_config_dials_read on config_dials    for select to authenticated using (true);
create policy p_config_ver_read   on config_versions for select to authenticated using (is_admin());

-- Referral -----------------------------------------------------------------------
create policy p_referrers_read on referrers for select to authenticated
  using (profile_id = auth.uid() or is_admin());
create policy p_attributions_read on attributions for select to authenticated
  using (is_admin() or referrer_id = auth.uid() or exists (
    select 1 from subscriptions s where s.id = attributions.subscription_id and s.owner_profile_id = auth.uid()));
create policy p_commissions_read on commissions for select to authenticated
  using (referrer_id = auth.uid() or is_admin());

-- Consent: the client fully manages their own; a referrer may read consents naming them.
create policy p_consent_client_all on consents for all to authenticated
  using (client_profile_id = auth.uid()) with check (client_profile_id = auth.uid());
create policy p_consent_referrer_read on consents for select to authenticated
  using (referrer_id = auth.uid());

-- Ops ----------------------------------------------------------------------------
create policy p_waves_read on intake_waves for select to authenticated using (true);
create policy p_apps_read on applications for select to authenticated
  using (profile_id = auth.uid() or is_admin());
create policy p_apps_insert on applications for insert to authenticated
  with check (profile_id = auth.uid());
create policy p_tickets_read on support_tickets for select to authenticated
  using (profile_id = auth.uid() or is_admin());
create policy p_tickets_insert on support_tickets for insert to authenticated
  with check (profile_id = auth.uid());
create policy p_audit_read on audit_log for select to authenticated using (is_admin());
create policy p_outbox_admin on outbox for select to authenticated using (is_admin());

-- Coaching view is owner-privileged (bypasses RLS) but self-filters via can_coach; expose it.
grant select on v_coaching_consumption to authenticated;
