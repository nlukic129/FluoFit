# FluoFit Admin Console — build log & continuation guide

**Purpose:** a single place to reload context when you come back to the Admin Console.
It records **what is built**, the **decisions made while building it**, and **where to
continue**. It does *not* restate product rules (those live in [PRODUCT](./PRODUCT.md),
[admin-console spec](./product/admin-console.md), [ADRs](./adr/)) — it links to them.

> Owns: *the current state of the admin build + the build-time decisions.* Product rules,
> schema, and hard decisions live in their owning docs and are linked from here.
> One fact = one place.

Last updated: 2026-08-05. Backing migrations: `supabase/migrations/0001–0060`.

---

## 1. What the Admin Console is

The operator control plane for FluoFit — the only surface where staff provision product,
support members, run the referral program, pay the agency, and tune gamification/economics.

- **Stack:** Next.js 15 (App Router) + Tailwind v4 + shadcn-style components. This is the
  ADR-0014 "escape hatch" for dashboards, formalised in **[ADR-0015](./adr/0015-admin-nextjs-and-design-language.md)**.
  Lives in `apps/admin`. (Member + partner apps stay Expo.)
- **Design language:** light-mode, **English**, desktop-first, data-dense. Persisted at
  `apps/admin/design-system/` (from `/ui-ux-pro-max`: primary `#1E40AF`, accent `#D97706`,
  Fira Sans/Code).
- **Data access:** the browser holds the **anon** key only. Every admin capability is a
  **SECURITY DEFINER Postgres RPC gated by `is_admin()`** (`'admin' = any(profiles.roles)`),
  with **RLS on every table**. The UI never writes tables directly — it calls RPCs.
- **"Thick database":** all admin logic lives in `supabase/migrations` (RPCs), not in the
  Next.js layer. The UI is a thin caller. Migrations `0013+` are typically **applied directly
  to the live Docker Postgres** to preserve seed data; after any direct DDL run
  `notify pgrst, 'reload schema';` so PostgREST sees new functions.
- **How to run locally:** `pnpm db:start` (Supabase Docker), `pnpm --filter admin dev`
  (defaults to port 3001 in this workspace). Geoapify key lives in `apps/admin/.env.local`
  (`NEXT_PUBLIC_GEOAPIFY_API_KEY`, gitignored).

---

## 2. Cross-cutting rules & patterns (apply to every tab)

These are the invariants and conventions the whole console follows. When building a new
admin surface, honour all of them.

- **Audit log is an invariant.** Every mutating admin action records who/when/what/why via
  `fn_log_audit(...)`. Viewer = the **Audit Log** tab. → [admin-console §2](./product/admin-console.md).
- **Reason policy (2026-08-05):** the mandatory "reason (audited)" input belongs **only on
  sensitive actions** (money, member/account overrides, destructive, intake decisions). Routine
  setup CRUD (add/edit partner, perk, level; attach/unattach perk↔level) passes an **auto-filled
  reason** so the audit ledger is still written, without forcing the operator to type. See the
  agent-memory note `feedback-reason-only-on-sensitive-actions`.
- **Config is dynamic, versioned, grandfathered** ([ADR-0013](./adr/0013-dynamic-config-grandfathering-and-manual-margin.md)):
  economics/gamification dials are edited via `fn_apply_config(key, value, reason)` which versions
  the change. Grandfathering differs per dial (a level threshold never demotes a holder; a buyer
  discount binds new buyers only; tier rates go live at the next monthly snapshot).
- **Parked integrations behind ports** ([ADR-0014](./adr/0014-stack-monorepo-and-ports.md)):
  payment/fulfilment/payout/notify are adapter stubs. Admin actions that "refund", "resend login",
  "mark paid to agency", etc. call the **stub**, which simulates the real async state machine.
- **Fraud floor** (`XP/Streak ≤ 28 × activated Boxes`) is enforced by a **DB trigger**
  ([ADR-0006](./adr/0006-aggregate-supply-and-fraud-floor.md)); an admin XP correction that would
  break it is a **loud exception**, never a silent edit. This is separate from the Fraud *tab*
  (which reviews held commissions).
- **Currency = RSD.** `rsd()` formatter in `lib/overview.ts`. Pricing/COGS are config dials
  (box price 4000, COGS 1000 → unit margin 3000 / 75%), migration `0027`.
- **Don't hardcode; use the API** (founder rule). City names come from **Geoapify** raw English
  output (Beograd→Belgrade, Čačak→Cacak), never a hardcoded normalisation map.
- **Never show ADR references in the admin UI** (founder rule). ADR links are fine in code
  comments and docs, never in on-screen copy.
- **Shared UI:** `components/pager.tsx` (server-side pagination), `components/referrer-detail.tsx`
  (powers both agent & affiliate detail), `components/perk-modal.tsx` (partner-perk editor),
  `components/subscriber-map.tsx` + `address-autocomplete.tsx` + `city-autocomplete.tsx` +
  `lib/geoapify.ts` (Geoapify Leaflet map + Places autocomplete, graceful no-key fallback).

---

## 3. Tab-by-tab state

Every tab below is **built and type-checks (`tsc`) + renders (HTTP 200)**. Each was
individually redesigned via `/grill-me` before building. "Backing" = the migrations that
own its RPCs.

### Overview — analytics (growth/finance), read-only
Sidebar sub-tabs sharing a period+city filter provider: **Summary · Financial · Growth ·
Retention · Referrers · Geography · Operations**.
- Summary organised into bands (Right now / Needs attention / Selected period / Trends), Δ-vs-prev
  KPIs, a "Needs attention" panel (cohort links into the Members list).
- Financial: revenue/recurring/ARPU (period-respecting), margin, LTV, pending payout.
- Geography: **Geoapify** map of subscribers (pins colour-coded by status) + "by city" retention.
- Backing: `0024, 0025, 0026, 0028–0030, 0034, 0044` (aggregation + summary), `0050` (geo/map).
- Note: `fn_admin_overview` **ignores perk cost** — the spend-perk margin engine is deferred
  (see §5).

### Provisioning — lot-centric manufacturing & Box lifecycle
Routes: `/provisioning`, `/provisioning/boxes`, `/provisioning/box/[id]`, `/provisioning/print`.
- A **Batch = a manufacturing LOT** (`manufactured_on`, `expiry_date`, `cogs_per_unit`, recall
  fields, print tracking). Lot cards show a funnel (activated · unbound · void) + **EXPIRING**
  chips (unbound & lot expiry ≤ 90d). Canonical Box states are untouched.
- Actions: void unbound, recall lot (+ recall targets), record print; `fn_activate_box` blocks
  recalled/expired lots.
- Backing: `0032–0036`. → [admin-console §4](./product/admin-console.md).

### Members — support / operations console (customers only)
Routes: `/members`, `/members/[id]`. List excludes staff/partner roles; enriched (level,
last-active, lifetime spend) + search/status/**city** filters + pagination.
- Detail: KPIs, month scan calendar (with times), consumption/adherence, delivery, orders,
  shipments, unified **timeline** (incl. audit), internal **notes**, referrer link-out.
- Actions (all reason+audited, via a generic `ActionRunner` modal): unblock, set-sub-status
  (pause/resume/cancel), **refund order** (→ auto-clawback, see Fraud), set-attribution,
  manual box activation, add-note, XP/progress adjustment (loud-exception guard).
- Backing: `0021–0023, 0028, 0037–0042`. Coaching visibility: see the reversal in §4.

### Support — ticket inbox that routes to the member
Route: `/support`. Triage inbox (NOT a raw-UUID toolkit — the old override toolkit was removed;
those actions now live contextually on Members/Fraud/Box detail). Open/resolved/all + search,
auto age-triage (open >3d amber, >7d red), a ticket drawer with member mini-context, resolve/
reopen. Member→ticket deep-link `/support?focus=<id>`. v1 is one-way (no reply thread — waits on
NotifyPort). Backing: `0043, 0047`.

### Agents — roster + capped intake waves
Routes: `/agents`, `/agents/[id]`. Roster (ref code · tier · active subs · pending/paid earnings
· status) with audited actions (set tier, pause/resume, offboard) + detail (earnings-by-state,
referred members) + the intake pipeline (waves with soft-cap progress, enriched applicants,
approve/waitlist). **Tier is MANUAL for now** (`fn_admin_set_tier`); auto tier recompute + rates
wait on financial modelling. Intake: a city-focused wave is a **hard gate at the source**
(`fn_apply_to_wave` enforces `ship_city = city_focus`); waitlist is a per-city carry-over pool.
Backing: `0045, 0046, 0048`.

### Affiliates — curated referrers, two manual rate knobs
Routes: `/affiliates`, `/affiliates/[id]`. An affiliate is tuned on **commission %**
(`fixed_pct`, edits apply to future purchases) and **buyer discount %** (`buyer_discount_pct`,
edits apply to NEW subscribers only; existing keep their snapshot per ADR-0004). Roster + reason
modals (edit rates / pause-resume / offboard) + add-affiliate. Detail is the **shared**
`referrer-detail.tsx` (kind-aware: agent shows Tier, affiliate shows the two %s). Backing: `0049`.

### Payouts — agency-centric batches
Routes: `/payouts`, `/payouts/[id]`. Implements [ADR-0008](./adr/0008-agency-payout-intermediary.md):
FluoFit pays **one agency** a single amount; the agency distributes. A **payout batch**
(draft→paid/cancelled) snapshots all payable commissions of referrers above `payout.min_threshold`
(default 1000 RSD; below rolls over). Detail = per-referrer lines (the agency's distribution
instruction) + agent/affiliate split + CSV export + mark-paid (records agency invoice ref) /
cancel (releases commissions back). Backing: `0051, 0052`.

### Fraud — held-commission review queue
Route: `/fraud`. Reviews commissions **in the 30-day hold** with full context (referrer ↔ referred
member, sub age/status, order, days-left-in-hold). Boundary: Fraud owns accrued/cleared (hold);
Payouts owns payable→paid. One non-blocking heuristic hint: `rapid_churn` (referred sub lapsed
≤14d) as an amber flag + "Flagged" filter — **no auto-action** (human decides). Actions reuse
release/clawback (reason modals). **Refund → auto-clawback** (`0055`): refunding an order claws
back its non-paid commissions automatically (the sale reversed) — so the money-reversal case is
handled without the Fraud tab; Fraud is the manual safety-net for farming/disputes. Backing:
`0053–0055`.

### Perks — FluoFit perks (read-only) + partner perks (managed)
Routes: `/perks`, `/perks/[id]`. See the full perk-model story in §4. Two sections:
- **FluoFit perks** — **read-only** list (name/benefit/funding/level-reward status). FluoFit's own
  perks must be **built & integrated** into the fulfilment/pricing engine, so they are registered
  in a migration (`fn_register_fluofit_perk`), never added via the form.
- **Partners** — roster; each partner opens (`/perks/[id]`, "Manage perks") to add/edit/delete the
  perks it funds (a partner perk is Public or a Level reward). Backing: `0057–0060`.

### Gamification — live console + level rewards
Route: `/gamification`. Was a blind CRUD editor; now a console:
- **Insight** (`fn_admin_gamification_insight`): level distribution, near-level-up (cumulative_xp
  ≥ 80% of the level threshold), perk reach + estimated spend cost. Editable **`xp_per_scan`** dial.
- **Levels** CRUD (threshold_xp = cumulative XP to advance; current_level is a sticky state that
  only rises, so grandfathering is automatic — no demote preview).
- **Level rewards**: attach/unattach the pool of **non-public** perks (FluoFit + partner) to each
  level via `fn_admin_attach_perk_level`. This is the admin's only lever over a FluoFit perk.
- Backing: `0056` (+ perk model `0057–0060`).

### Settings — economics dials
Route: `/settings`. A minimal tab holding pricing/payout/referral config dials (box price, COGS,
currency, `payout.min_threshold`, buyer discount, agent eligibility level, tier rates), each edited
via `fn_apply_config` (versioned/grandfathered). **This is the seed of a future "Pricing &
Promotions" tab** (see §5). Split out of Gamification in `0056`.

### Audit Log
Route: `/audit`. Read-only viewer over the audit ledger (who/when/what/why). Backing: `0018`.

---

## 4. Key decisions made while building (the "why")

Decisions taken *during* the admin rebuild, beyond the pre-existing product ADRs.

1. **Admin moved off Expo to Next.js** — [ADR-0015](./adr/0015-admin-nextjs-and-design-language.md).
   Desktop-first data-dense dashboard needs a web-native stack; invokes ADR-0014's escape hatch.

2. **Maps/Places: Google → Geoapify.** Founder hit Google's billing/tax wall; Geoapify needs only
   an API key (no billing), ~3000 req/day free. Map = Leaflet + Geoapify tiles; autocomplete =
   Geoapify Geocoding Autocomplete REST (`countrycode:rs`). City names are **raw Geoapify English**
   (no hardcoded map). This is the real implementation of ADR-0016 (which named Google Places).

3. **Coaching boundary REVERSED** (`0041`, [ADR-0003](./adr/0003-affiliate-consent-boundary.md) revised).
   Coaching is **no longer consent-gated**. A referrer auto-sees the activity (incl. time-of-day) of
   any client **attributed** to them, but **never their identity** (pseudonymous `client_profile_id`
   only). `can_coach()` joins on **attributions**, not consents; the consents table is dormant. (A
   weak-anonymisation caveat is recorded in ADR-0003 for a future GDPR revisit.) The `fluofit-build`
   skill's invariant #3 was rewritten to match — **be aware the skill text and ADR now describe the
   reversed model.**

4. **Payouts = agency batches, not per-person** ([ADR-0008](./adr/0008-agency-payout-intermediary.md)).
   Replaced the old per-referrer "mark paid". The per-referrer breakdown is the agency's distribution
   instruction, not where FluoFit pays each person.

5. **Fraud = hold review; refund auto-claws-back.** The hold's real job is *not paying commission on
   sales that reverse or are farmed*. Money-reversal (refund/chargeback) is automatic; the Fraud tab is
   the rarely-needed manual net for farming/disputes.

6. **Perk model unified, then split create-vs-attach, then FluoFit made code-defined.** Three steps:
   - `0057/0058` **Unify**: a perk carries `partner_id` (null = FluoFit's own), `is_public`, `level_id`,
     `benefit`. Dropped `level_perks` + `partner_perks` and their mapping RPCs; killed the 3-dropdown
     "map perk → level" UX. CHECK: public ⇒ no level.
   - `0059` **Create vs attach**: perks are **created** where funded (Perks tab) and only **attached**
     to a level in Gamification. A non-public perk may sit unattached until placed.
   - `0060` **FluoFit perks are code-defined**: FluoFit's own perks must be **really integrated** (free
     shipping must make shipping free; "free box with the next order" must grant it), so they are **not**
     free-text admin rows. Added `perks.code` (internal engine key, **not shown in UI**) + CHECK
     `perk_code_iff_fluofit` (FluoFit perk ⇔ partner_id null AND code not null; partner perk ⇔ the
     inverse). New dev entrypoint `fn_register_fluofit_perk(code,name,benefit,funding,cost_hint)` called
     from a migration. `fn_upsert_perk`/`fn_delete_perk` now **reject** FluoFit perks — the admin form
     manages **partner** perks only (funding always `partner`). Admin's only FluoFit-perk lever = attach
     to a level. The actual perk **behaviour** (redemption/grants) is the deferred engine (§5).

7. **Reason input only on sensitive actions** (see §2 reason policy).

8. **Tier is manual for now.** Auto monthly tier recompute + tier-rate config are deferred to the
   financial-modelling pass (agent-memory `pending-financial-modeling-session`).

---

## 5. Deferred / not-yet-built (where to go next)

The console is **functionally complete** for v1 operations. The open threads, owned by
[OPEN-FLOWS](./OPEN-FLOWS.md), are:

- **Perk redemption / financial engine.** Perks are configured but **never granted** anywhere in v1,
  and spend-perk cost is **not** folded into the Financial margin (`fn_admin_overview` ignores it).
  A real engine would, on level-crossing, snapshot actual spend-perk cost → `member_reward_snapshots`
  → into margin, and grant partner perks to members. This is also what "wires" a FluoFit perk's real
  behaviour (§4.6). Tied to the level-crossing/reward engine.
- **Pricing & Promotions tab.** The minimal `/settings` is its seed. Needs: agent **tier table**
  ({commission %, buyer discount %, threshold}), FluoFit **time-bound promos** (period-scoped campaign
  discounts, independent of referral), and the **stacking rule** (likely take-the-best, non-stacking).
  Partly blocked on financial numbers.
- **City normalisation / region model — near-term priority.** City inputs are still **free-text** in
  some places (a `belgrade`≠`beograd` typo already broke an intake gate once). Geoapify autocomplete is
  wired into member address + wave city-focus, but the deeper question — *what a "city"/region is*
  (Places locality vs internal catchments like "Beograd metro") — is an undecided design pass.
- **Member-side perk redemption mechanism** — parked until the first real Partner shapes it (QR vs code).
- **Transactional notifications** (order/shipping confirmations) — Support is one-way until NotifyPort.
- **Live E2E click-testing.** Each tab is verified by `tsc` + HTTP-200 smoke + DB-level checks; SQL smoke
  scripts live in scratchpad (not committed). No automated E2E click-through suite yet.

---

## 6. How to continue

- **Product rules / behaviour** → [PRODUCT](./PRODUCT.md), [admin-console spec](./product/admin-console.md).
- **A hard decision's "why"** → [ADRs](./adr/) (index in [README](./README.md)).
- **Open gaps & their status** → [OPEN-FLOWS](./OPEN-FLOWS.md).
- **Build invariants (enforced automatically)** → load the `fluofit-build` skill before writing app code.
- **Phase tracker** → [ROADMAP](./ROADMAP.md). Next phase per ADR-0014 = the Member/partner Expo apps
  (habit-loop UI) + commercial core, on top of the migrations this console already established.
- **When adding an admin surface:** grill it (`/grill-me`) → agree the spec → write the RPC in a new
  migration (admin-gated, audited) → apply to live DB + reload schema → thin UI caller → `tsc` + smoke.
  Follow every rule in §2.
