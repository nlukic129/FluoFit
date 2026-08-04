---
name: fluofit-build
description: >-
  Enforce FluoFit's domain invariants whenever writing or reviewing app code — database
  schema/migrations, RLS policies, scan/XP/Streak/Level logic, refill & benefit-clock engines,
  the affiliate/agent commission lifecycle, offline sync, or the Admin Console. Load this
  BEFORE writing any schema, Edge Function, screen, or query for FluoFit. It points to the
  owning docs (CONTEXT.md, ADRs, ARCHITECTURE.md) — it never restates their detail.
---

# FluoFit build guardrails

You are writing code for **FluoFit** (single-serving supplement brand: app + subscription +
affiliate program + loyalty). The product model is fully specified in docs; this skill exists so
every session **enforces the invariants automatically** instead of re-deriving them. Read the
linked doc for detail — **one fact = one place**, never copy it here.

## The five invariants — never violate, enforce in the lowest layer possible

1. **Fraud floor — `XP / Streak ≤ 28 × activated Boxes` (aggregate, not per-Box).**
   Enforce in the **database** (CHECK/trigger), not just app code. An Admin XP correction that
   would break it is a *loud exception*, never a silent edit. → `CONTEXT.md` (XP, fraud floor),
   [ADR-0006](../../../docs/adr/0006-aggregate-supply-and-fraud-floor.md),
   [admin-console §6](../../../docs/product/admin-console.md).

2. **Server is canonical; the device holds only a raw scan queue + optimistic view.**
   XP/Streak/Level are **derived** from the scan-event ledger server-side. Offline: local queue
   with a **client-generated idempotency key**; XP computed from the **validated scan date, not
   the sync date**; server **clamps** timestamps (reject future, clamp backdating). Dedup per
   `(Member, date)`. → [ARCHITECTURE §2](../../../docs/ARCHITECTURE.md#2-offline-session--scanning-).

3. **Attribution — not consent — is the gate for coaching data, and it is anonymized.**
   *(Revised 2026-08-04 — reverses the old consent model.)* A referrer (Agent *or* Affiliate)
   sees the activity of any client **attributed to them, automatically** — which Sachets, **including
   time-of-day**, streak, adherence — but **NEVER the client's identity** (no name/email; only a
   pseudonymous `client_profile_id`). No opt-in, no per-member toggle. No cross-referrer leakage.
   Enforce in **RLS / `can_coach()` joined on `attributions`** and by keeping identity columns OUT
   of `v_coaching_consumption` — not in UI. The `consents` table is **dormant/deprecated**.
   → [ADR-0003](../../../docs/adr/0003-affiliate-consent-boundary.md) (revised),
   [agent-affiliate-app §2](../../../docs/product/agent-affiliate-app.md).

4. **Level never drops; config is grandfathered per-dial.** A threshold change never demotes an
   existing holder; spend-funded rewards snapshot-at-crossing; partner-funded run live; buyer
   discount binds new-buyers-only; tier rates go live at the next monthly snapshot. Config is
   **versioned**. FluoFit never cuts its **own** product price via Levels — the only price
   discount is the referral split. → [ADR-0013](../../../docs/adr/0013-dynamic-config-grandfathering-and-manual-margin.md),
   [ADR-0002](../../../docs/adr/0002-two-purse-gamification-funding.md),
   [ADR-0004](../../../docs/adr/0004-referral-economics.md).

5. **Parked integrations live behind ports.** Payment, fulfillment, payout, and transactional
   notifications are **adapter interfaces** (`packages/core`); v1 uses stubs that simulate the
   *real* async state machines (authorize→capture→refund, created→shipped→delivered, agency
   statement). Never call a third-party SDK directly from a screen or Edge Function — go through
   the port. → `docs/ARCHITECTURE.md` (ports/engines), project memory `dev-approach`.

## Also always true

- **Benefit clock:** Perks + referred discount live ≤ 60 days from the **last paid order**; only
  a **paid order** resets it — **scanning never does**. Day 60 with no order → *lapse*, never
  force-ship. → [ADR-0011](../../../docs/adr/0011-refill-mode-decoupled-and-benefit-clock.md).
- **Commission binds on the sale event** = the **paid order** for a direct subscriber (may never
  scan); the **Activation scan** only for a gift/retail Standalone Box. Lifecycle
  `Accrued → Cleared (30d hold) → Payable → Paid`; clawback before clearing. → [ADR-0010](../../../docs/adr/0010-app-optional-scheduled-subscription.md), [ADR-0008](../../../docs/adr/0008-agency-payout-intermediary.md).
- **Box lifecycle:** `Manufactured/Unbound → Activated` (or `Void`); opaque high-entropy tokens,
  **never sequential**; first scan of a Subscription Box transfers the **whole** Subscription
  (consolidation, no linking); a scanned Box is **locked**. → [ADR-0012](../../../docs/adr/0012-identity-checkout-and-box-ownership.md), [admin-console §4](../../../docs/product/admin-console.md).
- **Audit log is an invariant:** every mutating admin action records who/when/what/why (reason
  mandatory on sensitive ones). → [admin-console §2](../../../docs/product/admin-console.md).
- **RLS on every table from day 1.** `profiles.roles text[]` (array, not single role).
  → [ARCHITECTURE §1](../../../docs/ARCHITECTURE.md#1-authentication--identity-).
- **Streak day boundary = calendar day in the Member's account timezone** (not UTC, not device
  clock). One weekly grace; no freeze tokens except the "our-fault in-transit" freeze.
  → `CONTEXT.md` (Streak), [ADR-0011](../../../docs/adr/0011-refill-mode-decoupled-and-benefit-clock.md).

## Use the glossary exactly

Box, Sachet, Subscription, Box Activation, Refill, Member, Prospect, Lapsed Member, Standalone
Box, Streak, XP, Level, Perk, Agent, Affiliate, Partner, Batch, Admin Console. Respect every
`_Avoid_` in `CONTEXT.md` (e.g. not "package/kit", not "user/customer", not "tier/rank").

## When writing tests

The fraud floor and offline dedup are the highest-value tests — use `/tdd` for scan / XP /
refill / commission logic. Run `/security-review` before shipping anything touching RLS, auth,
affiliate consent, or payment.
