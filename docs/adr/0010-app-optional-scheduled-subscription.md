# The app is optional: a base Scheduled Subscription works with no app; the app is an additive layer

## Context

Talking to prospective customers surfaced two distinct personas: some are delighted by
the app (streaks, community, gamification); others are intrinsically motivated ("I
understand supplementation, I don't need an app to motivate me") and actively don't want
one. The [two-layer principle](./0001-consumption-driven-subscription.md) already says the
Subscription guarantees supply *regardless of scanning* — so the product was always meant
to be usable without the app. But three mechanisms quietly assumed the app anyway, breaking
the model for exactly the disciplined, app-averse customer who is otherwise the **best**
cohort (daily consumer, low churn, predictable revenue):

1. **Refill has no signal without scanning.** A 28-Sachet Box empties in ~4 weeks of daily
   use, but the non-scanner time cap is **2 months** ([ADR-0001](./0001-consumption-driven-subscription.md)),
   and the "running low" button lives in the app. A daily non-scanner runs out for ~a month.
2. **Signup/auth is mobile-app-first.** Member auth is Google/Apple social login on mobile
   ([ARCHITECTURE §1](../ARCHITECTURE.md#1-authentication--identity-)) — you literally
   cannot become a Member without installing the app.
3. **Commission/ownership bind on a scan.** Box Activation (the unique-QR scan) triggers
   affiliate commission and ownership binding — which an app-less subscriber never performs,
   so the Agent who referred them would never earn.

## Decision

**The base is primary: a plain, reliable Subscription that works fully without the app. The
app is an *additive layer*, never a gate for supply.** One product, one Subscription — the
app only turns on the ecosystem (scanning, XP, Perks, precise refill) for those who want it.

Concretely:

- **Two refill modes on the one Subscription** (terms in [CONTEXT.md](../../CONTEXT.md)):
  - **Scheduled refill** (base, no app) — a **fixed, adjustable cadence** (default **4
    weeks** — matches 28 Sachets of daily use), because with no scan signal the calendar is
    the only honest trigger. This is a **narrow, deliberate exception** to
    [ADR-0001](./0001-consumption-driven-subscription.md)'s "no calendar billing": ADR-0001
    rejected the calendar because *irregular* consumers stockpile, but the base daily
    consumer is the most predictable and does not stockpile, so the reason for the ban does
    not apply here.
  - **Consumption-driven refill** (app) — the existing model (remaining ≤ 7 / "running low"
    / time cap; [ADR-0006](./0006-aggregate-supply-and-fraud-floor.md)), unchanged.
- **App-less front door.** An **email-based account + web signup & checkout** is the
  **canonical** entry; social login (Google/Apple) becomes a **shortcut for app users**, not
  the only path. Same Supabase Auth project / same `auth.users.id`; an app user later binds
  the same account. *(Payment provider is parked — this fixes only the structural rule "a
  web/email path to a Subscription must exist," independent of provider.)*
- **App-less controls & notices.** A base Member manages the Subscription (skip / delay /
  change cadence / pause) via **email/SMS + a magic-link web page** (no install); every
  auto-shipment keeps the **3-day advance notice** with skip/pause from ADR-0001.
- **Commercial binding moves off the scan for direct subscribers.** "Box Activation" was
  overloaded — it did two jobs at once: **commercial binding** (ownership + fraud floor +
  affiliate commission = "proof of a real sale") and **ecosystem unlock** (XP/Streak/Perks/
  precise refill). For a **paid direct subscriber (app or base)** the paid **order** is the
  proof, so ownership + commission bind at the **paid Box order** (`ref` captured at web
  checkout); the scan, if any, retains only the **ecosystem-unlock** job and is not required
  for ownership or commission. A **gift/retail Standalone Box** has no paid order by its
  holder, so there the **scan stays the binding + proof event** ([ADR-0007](./0007-standalone-gift-retail-box-activation.md), unchanged).
- **Modes are coupled in v1.** Base = Scheduled refill + ecosystem off; app = Consumption-
  driven refill + ecosystem on. Independent switches (e.g. "scan for XP but keep a calendar
  cadence") are a possible later refinement, not v1. A Member can **switch** either way on
  the same account: base→app starts scanning and earning from that moment; app→base freezes
  and retains XP/Level (nothing is reset), Subscription stays active.
- **Scan-gap safety net (consumption-driven Members only).** If **30 days pass with no
  refill triggered and no scans**, an **email + push** fires ("you haven't scanned — either
  you're running low, so order, or just scan to keep refill accurate"). Rationale: a normal
  daily consumer hits the 21-scan refill trigger within ~3 weeks; passing 30 days with no
  trigger means either genuine very-low consumption (<21/month) or — the real risk — a
  consumer who kept drinking but **stopped scanning**, whom consumption-driven refill would
  otherwise let silently run out. A base (Scheduled) Member never gets this — the calendar
  removes the scan-gap risk by construction. Governed by [PRODUCT §6](../PRODUCT.md#6-reminders--v1-heuristic-defined)
  (quiet hours, anti-spam), but as a distinct, infrequent logistics nudge, not part of the
  daily habit reminder.

## Consequences

- **Web checkout is a day-1 build**, not "mobile first, web later" — a real re-ordering of
  build priority, accepted so the base persona is served from the start.
- The **best cohort (disciplined daily consumer) is now correctly served** instead of
  silently under-supplied; the app stops being a gate and becomes what the north star always
  said it was — a vehicle, for those who want it.
- **No new lifecycle state.** A base user is still a **Member** (account + active
  Subscription); the mode is a property of the Subscription, not a new actor. Prospect /
  Member / Lapsed / Paused are untouched.
- **Base Members earn no XP** (they don't scan) — the fraud floor is trivially satisfied
  (0 XP ≤ any supply). Partner Perks / coaching visibility stay app-only, which is fine.
- **Affiliate economics keep working for app-averse buyers**: commission binds on the paid
  order and recurs while the Subscription is active ("earn only when FluoFit earns"); the
  first-payout activity gate ([program §6](../product/agent-affiliate-program.md)) becomes
  the **second paid order** for a base buyer — a stronger proof than a scan.
- The **full app-less conversion path (gift/retail → Subscription) still waits on payment**
  (parked); the structural rules here are decidable now.
