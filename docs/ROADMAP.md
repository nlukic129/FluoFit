# FluoFit — Build roadmap (living progress tracker)

The **living** view of build progress. The *decision* about phase order + rationale is frozen in
[ADR-0014 §4](./adr/0014-stack-monorepo-and-ports.md#4-build-sequencing-dependency-honest-tracer-bullet);
this doc **tracks status against it, app-first**, and is updated as we build. Each item links to
its owning doc — **one fact = one place**, never copied here.

> Status: ✅ done · 🟡 in progress / partial · ⬜ not started · 🅿️ parked (deliberate)
>
> **Every phase is a runnable, demoable vertical slice** — split into **App (what you see)** and
> **Backend (what powers it)**, so progress is always visible in the product, not just the schema.
> Phase 0 is the one exception: pure foundation, no UI by design (it is the layer every app reads).
> Order stays dependency-honest — the riskiest slice (offline scan + fraud floor) is pulled to Phase 2.

---

## Admin Console — completion track (active priority) 🟡

A dedicated track to finish the **whole Admin Console** ([admin-console.md](./product/admin-console.md)).
Stack + design language: **Next.js + Tailwind + shadcn-style, light-mode, English, desktop-first**
([ADR-0015](./adr/0015-admin-nextjs-and-design-language.md); design system persisted at
`apps/admin/design-system/`). Supersedes the admin items previously scattered across Phases 1/4/5.

- ✅ **M0 — Foundation:** Next.js (App Router) + Tailwind v4 + shadcn-style primitives + light design tokens (`ui-ux-pro-max`) + Fira Sans/Code; sidebar shell + Email-OTP auth guard; all module routes stubbed. Verified `next build` + `tsc`.
- ✅ **M1 — Provisioning + Overview:** live KPI counts; Batches + Boxes tables (status filter), Generate dialog, audited Void dialog, CSV export — wired to `fn_provision_batch`/`fn_void_box`. Verified `next build` + `tsc`.
- ✅ **M2 — Members + Support & Overrides:** member search + 360 (`fn_admin_search_members`/`fn_admin_member_360`); XP/Streak correction with loud-exception guard; ticket queue + resolve; override toolkit (`fn_admin_manual_activate`, `fn_admin_unbind_rebind`, `fn_admin_fix_attribution`, `fn_admin_release_commission`/`fn_admin_clawback_commission`). Backend smoke-tested (9 scenarios); UI `next build`+`tsc` green.
- ✅ **M3 — Gamification config:** Levels CRUD (`fn_upsert_level`/`fn_delete_level` — refuses held) + **never-demote** hardening in `fn_recompute_progress`; config dials (eligibility, tier rates, buyer discount) over `fn_apply_config`; Perk↔Level RPCs (`fn_upsert_perk`/`fn_map_perk_level`/`fn_unmap`) ready + tested (mapping UI a thin follow-up). Backend smoke-tested (6 scenarios); UI `next build`+`tsc` green — grandfathering per [ADR-0013](./adr/0013-dynamic-config-grandfathering-and-manual-margin.md).
- ✅ **M4 — Agents/Intake + Affiliates:** wave lifecycle (`fn_open_wave`/`fn_close_wave`), applicant curation view + approve→grant Agent+ref / waitlist (`fn_decide_application`), `fn_block_member`; Affiliate add-by-email/offboard (`fn_add_affiliate`/`fn_offboard_referrer`) + `fn_admin_list_referrers`. Backend smoke-tested (9 scenarios); UI `next build`+`tsc` green.
- ✅ **M5 — Payouts + Fraud:** payout statement per recipient (`fn_generate_payout_statement`) + mark-paid on agency confirmation (`fn_mark_referrer_paid`); fraud review list (`fn_admin_list_commissions`) with release/clawback (`fn_admin_release_commission`/`fn_admin_clawback_commission`). Backend smoke-tested (5 scenarios); UI `next build`+`tsc` green.
- ⬜ **M6 — Partners + Audit Log + final UX pass:** partner CRUD + perk/tier map; audit viewer; `ui-ux-pro-max` checklist (contrast, focus, empty/loading/error, keyboard).

Every mutating RPC = `SECURITY DEFINER` + `is_admin()` + `fn_log_audit` (reason on sensitive). Each RPC Postgres-tested; each UI delivered typecheck/`next build`-green.

---

## Phase 0 — Foundation ✅

*No UI by design — this is the shared layer every app reads.*

- ✅ Monorepo scaffold (pnpm + Turborepo; `apps/*` + `packages/*`) — [ADR-0014 §2](./adr/0014-stack-monorepo-and-ports.md)
- ✅ Schema, all tables — [`architecture/data-model.md`](./architecture/data-model.md), `supabase/migrations/0001–0009`
- ✅ RLS on **every** table + consent helpers (`is_admin`, `can_coach`) — `0011`, [ADR-0003](./adr/0003-affiliate-consent-boundary.md)
- ✅ **Fraud-floor trigger** in the DB (earning scans ≤ 28 × Boxes) — `0006`, [ADR-0006](./adr/0006-aggregate-supply-and-fraud-floor.md)
- ✅ Config engine `fn_apply_config` (version + live dial + audit) — `0010`, [ADR-0013](./adr/0013-dynamic-config-grandfathering-and-manual-margin.md)
- ✅ Consent-gated `v_coaching_consumption` view (omits `scanned_at`) — `0010`
- ✅ Audit log + `fn_log_audit` — `0009`/`0010`, [admin-console §2](./product/admin-console.md)
- ✅ Adapter **ports + stub adapters + outbox** (payment/fulfillment/payout/notify) — `packages/core`, [ADR-0014 §3](./adr/0014-stack-monorepo-and-ports.md)
- ✅ Shared domain types + invariant unit tests — `packages/core`
- ✅ `fluofit-build` skill (stage gate) — `.claude/skills/fluofit-build/`
- ✅ Verified: 11/11 migrations apply on Postgres 15; smoke test green; `pnpm -r typecheck` + 5/5 unit tests

---

## Phase 1 — App shells + commercial core ✅

> **Ships:** a person can register passwordless, pick a plan (Smart/Manual + cadence), and an
> Admin can generate + print Box codes; the first Box "ships" (stubbed). The app is now real.

**App (what you see)**
- ✅ Scaffold apps — `apps/member` + `apps/admin` + `apps/partners` shell (Expo SDK 57, Expo Router, monorepo `.npmrc` + `metro.config.js`) — [ADR-0014 §2](./adr/0014-stack-monorepo-and-ports.md)
- ✅ `packages/ui` — shared design system (theme + primitives); all three apps consume it, per-app copies removed
- ✅ **Member:** passwordless checkout flow — email → **mode + cadence picker** (Smart / Manual 28–60) → confirm — via `/api/checkout` server route → `fn_create_subscription`/`fn_place_order`/stub `PaymentPort`/`fn_mark_order_paid` — [ADR-0012](./adr/0012-identity-checkout-and-box-ownership.md), [ADR-0011](./adr/0011-refill-mode-decoupled-and-benefit-clock.md)
- ✅ **Member:** Box activation screen (`fn_activate_box` — transfer / Standalone / already-bound handling) — [ADR-0012](./adr/0012-identity-checkout-and-box-ownership.md), [ADR-0007](./adr/0007-standalone-gift-retail-box-activation.md)
- ✅ **Member:** account / manage-subscription screen (Email-OTP login + subscription view; lifecycle controls in Phase 3)
- ✅ **Admin:** Email-OTP login + Box-provisioning screens — batch list, generate (`fn_provision_batch`), void (`fn_void_box`), CSV export — [admin-console §3–4](./product/admin-console.md)
- ✅ Verified: `pnpm -r typecheck` green across member + admin + all packages (runtime run is on-device — see README quickstart)

**Backend (what powers it)** — commercial-core RPCs done + smoke-tested (7 scenarios), `0012`
- ✅ Boot local Supabase (`pnpm db:start`) + real generated `packages/db` types (`pnpm db:types`)
- ✅ Passwordless auth wiring — Email-OTP login for member/admin/partners; checkout auto-provisions the account (ADR-0012) — [ARCHITECTURE §1](./ARCHITECTURE.md#1-authentication--identity-)
- ✅ Subscription create + orders (`fn_create_subscription`, `fn_place_order`, `fn_mark_order_paid`); the app calls stub `PaymentPort` between place & paid, `FulfillmentPort` for shipment — `0012`
- ✅ **Activation** + whole-Subscription transfer on first scan (scanned Box locked); retail Box → **Standalone** branch (`fn_activate_box`) — [ADR-0012](./adr/0012-identity-checkout-and-box-ownership.md), [ADR-0007](./adr/0007-standalone-gift-retail-box-activation.md)
- ✅ Box provisioning + void RPCs (`fn_provision_batch`, `fn_void_box`, admin-gated + audited) — [admin-console §4](./product/admin-console.md)

---

## Phase 2 — Habit loop (highest technical risk) 🟡

> **Ships:** open the app, scan a Sachet, watch the Streak + XP rise — and it works offline.
> **Backend engine done + smoke-tested (`0013`); scanner UI + client offline queue next.**

**App (what you see)**
- ⬜ **Member:** home with the **always-live scanner strip** (auto-routes Sachet vs Box QR) — [PRODUCT §2 scanner](./PRODUCT.md#scan-surface--always-live-scanner-)
- ⬜ Streak flame + XP counter + Level progress ("N to go") + "✓ scanned today" state
- ⬜ **Prospect home** variants (warm Standalone / cold `ref` / abandoned checkout / cold registrant) — [PRODUCT §1 Prospect home](./PRODUCT.md#prospect-home--conversion-first-entry-surface)
- ⬜ Camera-permission fallback affordance (never a dead viewfinder)

**Backend (what powers it)** — engine done + smoke-tested (5 scenarios), `0013`
- ✅ Scan-sync engine `fn_sync_scans` (idempotency dedup, future-timestamp clamp, per-(Member,date), account-tz day boundary) — [ARCHITECTURE §2](./ARCHITECTURE.md#2-offline-session--scanning-)
- ✅ XP / Streak / Level derivation `fn_recompute_progress` (checkpoint XP, weekly grace) — [PRODUCT §3](./PRODUCT.md#3-gamification-) · 🟡 our-fault in-transit freeze deferred (needs Phase 3 shipment status)
- 🟡 Offline queue + optimistic view + reconcile — server side done; the on-device queue is ⬜ (client work)
- ✅ Fraud floor end-to-end (enforced in `fn_sync_scans` under the `0006` trigger; verified) · ⬜ Admin correction as a **loud exception** — [admin-console §6](./product/admin-console.md)

---

## Phase 3 — Lifecycle ⬜

> **Ships:** refills fire at the right time, the benefit clock nudges, and every subscription
> control (pause / switch / skip / order now) works.

**App (what you see)**
- ⬜ **Member:** subscription settings — switch mode, change cadence, pause, "Order now", "running low"
- ⬜ Benefit-clock + smart-silence nudge UI (day 30/45/55/59 warnings; "I've stopped") — [ADR-0011 §4](./adr/0011-refill-mode-decoupled-and-benefit-clock.md)
- ⬜ Order-tracking screen; reminders settings (per-type toggles, quiet hours) — [PRODUCT §6](./PRODUCT.md#6-reminders--v1-heuristic-defined)

**Backend (what powers it)**
- ⬜ Refill engine: Smart (≤7 / "Order now", never calendar) + Manual (28–60, doorstep-aware) via `pg_cron` — [ADR-0011](./adr/0011-refill-mode-decoupled-and-benefit-clock.md)
- ⬜ Benefit clock (day-60 lapse, never force-ship); lapse (3 triggers) + pause + revival — [ADR-0005](./adr/0005-subscription-lifecycle-and-lapse.md)
- ⬜ Local reminders (per-day-of-week heuristic, one-per-day collapse, back-off)
- ⬜ Transactional notifications (order/ship/tracking) via `NotifyPort`

---

## Phase 4 — Growth (referral) ⬜

> **Ships:** a Member applies and becomes an Agent, shares a link, and sees commissions;
> an Admin runs an intake wave; a consenting client shows up in the coaching plane.

**App (what you see)**
- ⬜ **`apps/partners`** — role-adaptive Agent/Affiliate app: dashboard, referral link + QR, earnings by state, coaching plane — [agent-affiliate-app](./product/agent-affiliate-app.md)
- ⬜ **Member:** "Apply to become an Agent" flow + separate, non-pre-ticked **consent** UI — [ADR-0003](./adr/0003-affiliate-consent-boundary.md)
- ⬜ **Admin:** intake-wave screens (open / curate / approve / close), manual Affiliate add — [admin-console §5](./product/admin-console.md)

**Backend (what powers it)**
- ⬜ Agent eligibility + capped waves; Affiliate onboarding (fixed %) — [program §1, §8](./product/agent-affiliate-program.md)
- ⬜ Attribution (first-touch `ref`, grace 14d / 2nd Box) — [ARCHITECTURE §1](./ARCHITECTURE.md#1-authentication--identity-)
- ⬜ Commission engine (`Accrued→Cleared→Payable→Paid`, clawback, first-payout gate) — [program §6–7](./product/agent-affiliate-program.md), [ADR-0008](./adr/0008-agency-payout-intermediary.md)
- ⬜ Consent gating end-to-end (coaching plane via `v_coaching_consumption`)

---

## Phase 5 — Loyalty + Admin completion ⬜

> **Ships:** Perks unlock by Level; an Admin tunes the dials, onboards a Partner, and resolves
> a support ticket with the audited override toolkit.

**App (what you see)**
- ⬜ **Member:** Perks screens (locked/unlocked by Level) + redemption; in-app "Contact support"
- ⬜ **Admin:** gamification config (dials over `fn_apply_config`), partner onboarding, support queue + override toolkit — [admin-console §6–8](./product/admin-console.md)

**Backend (what powers it)**
- ⬜ Perks + Partners funding (partner-funded live / spend-funded snapshot-at-crossing) — [ADR-0002](./adr/0002-two-purse-gamification-funding.md), [ADR-0013](./adr/0013-dynamic-config-grandfathering-and-manual-margin.md)
- ⬜ Payout statement → agency via `PayoutPort` — [ADR-0008](./adr/0008-agency-payout-intermediary.md)
- ⬜ Override toolkit (audited, reason-mandatory) — [admin-console §6](./product/admin-console.md)

---

## Cross-cutting / parked

- 🅿️ Real payment / fulfillment / payout / notification integrations — swapped in behind the ports when each domain unparks ([ADR-0014 §3](./adr/0014-stack-monorepo-and-ports.md), [PRODUCT "Parked"](./PRODUCT.md#parked-considered-deliberately-deferred)).
- 🅿️ All referral/gamification **numbers** (discount %, tier rates + thresholds, Level thresholds) — pending COGS → pricing; the config *mechanism* is built, the *values* wait ([ADR-0013](./adr/0013-dynamic-config-grandfathering-and-manual-margin.md)).
