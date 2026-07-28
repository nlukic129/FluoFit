# Refill mode is independent of the app; smart falls back safely, and silence lapses benefits instead of force-shipping

> **Amends [ADR-0010](./0010-app-optional-scheduled-subscription.md)** (decouples the two
> refill modes it deliberately coupled), **[ADR-0001](./0001-consumption-driven-subscription.md)**
> (changes what the 60-day time cap *does*), and **[ADR-0005](./0005-subscription-lifecycle-and-lapse.md)**
> (adds a third lapse trigger). Builds on [ADR-0007](./0007-standalone-gift-retail-box-activation.md)
> (retail on-ramp) and [ADR-0004](./0004-referral-economics.md) (discount on lapse).

## Context

[ADR-0010](./0010-app-optional-scheduled-subscription.md) made the app optional by giving
the Subscription two refill modes, but it **coupled** them to the ecosystem layer (base =
Scheduled + app off; app = Consumption-driven + app on) and deferred "independent switches"
as a later refinement. A product-discovery pass on the subscription surfaced five things that
force the decoupling now, and demand a bulletproof answer for the messy states:

1. **The cadence should be chosen at checkout**, on the web *and* in the app — not a fixed
   4-week default.
2. **Some app users scan for XP but want a predictable calendar**, not consumption timing —
   exactly the case ADR-0010 deferred.
3. **"Chose smart but doesn't scan" had no clean answer.** A refill mode that waits for a
   scan signal that never arrives has no defined next-ship trigger — the Member could run dry.
4. **Benefits must not outlive real purchases.** Nothing stopped a Member from nursing one
   Box forever while keeping the referred discount and Perks alive — a gaming hole.
5. **Real-time carrier tracking is now available** (delivery events + transit status), so
   "N days" can be honest (measured doorstep-to-doorstep) and nudges can fire on real events.

## Decision

**A refill mode is a property of the Subscription, independent of the ecosystem layer.** It is
chosen at checkout and switchable at any time. The old coupling is dropped.

### 1. Two modes, decoupled from the app

- **Smart refill** (= **Consumption-driven refill**) — ships on the first of: remaining
  supply ≤ 7 / "running low" button / the safety path in §3. **Requires scanning** (the
  consumption signal), so it only runs with the ecosystem **on**.
- **Manual refill** (= **Scheduled refill**) — ships on a **user-chosen cadence of 28–60
  days** (was a fixed 4-week default). Runs with the ecosystem **on or off** — an app user
  who scans for XP may still keep a calendar cadence. **28 = the daily-consumer floor**
  (28 Sachets), **60 = the lightest honest consumer and the absolute cap** ([ADR-0001](./0001-consumption-driven-subscription.md)).

Valid combinations (Smart+ecosystem-off is impossible — no scan, no signal):

| | Ecosystem ON (scans, XP) | Ecosystem OFF |
|---|---|---|
| **Smart** | app Member (default) | — impossible — |
| **Manual (28–60)** | app Member on a calendar (**newly allowed**) | base / web Member |

### 2. Smart has two substates — and Smart **never** ships on a blind calendar

Smart auto-ships **only** on a real consumption signal (remaining ≤ 7, from scans) or a manual
**"Order now"** — **never** on a timer or calendar.

- **Smart-pending** — chose Smart, has **not scanned yet**, so there is no consumption signal.
  We do **not** auto-ship: the checkout Box covers them, and we nudge them to scan (to turn
  Smart on), always offering **"Order now"** and **"Switch to Manual"**. The Benefit clock (§5)
  is running.
- **Smart-active** — scanning; consumption drives the refill.

> **Rejected alternative:** a "safe 4-week fallback ship" for pending (or a "28-day floor" for
> any silent Smart Member) — it is exactly the blind-calendar shipping a Smart Member opted out
> of, and it would let a non-scanner accumulate charges they did not ask for. A non-scanner who
> wants guaranteed *scheduled* supply switches to **Manual**; that is Manual's whole purpose.

### 3. Tracking-based scheduling (uses the carrier API)

- **N days = the gap between deliveries** (doorstep-to-doorstep), not ship-to-ship. The system
  **computes the ship moment backward** from the target delivery date using the carrier rule:
  **ordered before 13:00 → arrives next day; after 13:00 → the day after; no weekend
  deliveries** (a target that lands on Sat/Sun moves to Monday). This closes the lead-time hole
  (a flat "ship on day N" would arrive ~5 days late and leave the Member dry).
- The **first Box ships immediately from the checkout order**, regardless of mode — the mode
  only governs Box #2 onward.
- **Order tracking is surfaced in-app** so the Member sees where the Box is.

### 4. Silence lapses benefits — it does **not** force-ship

A Smart Subscription that goes silent — **never scanned** (perpetually pending) **or scanned
then stopped** (e.g. travel) — is **not** shipped a Box it did not ask for (a Smart Member
explicitly opted out of calendar shipping; we do not impose it):

- **Escalating, moderate warnings** (in-app + push + email) at roughly **day 30 / 45 / 55 /
  59**, each offering **"Order now"**, **"Switch to Manual"** (the lifeline for someone who
  wants supply without scanning), and **"I've stopped"**. Governed by [PRODUCT §6](../PRODUCT.md#6-reminders--v1-heuristic-defined)
  (quiet hours, back-off).
- **Ignoring keeps the warnings coming** on schedule.
- **An explicit "I've stopped" stops the nagging.** The Member may add an **optional reason**
  (captured as churn feedback); choosing "I've stopped" **suppresses all remaining scheduled
  warnings** — we do not nag someone who told us they stopped. Suppression is triggered by the
  "I've stopped" choice itself, not by submitting a reason.
- **Exactly one message still fires: the day-60 closure notice** — "your Perks and discount are
  paused until your next subscription." Benefits still run out their paid 60 days; the lapse is
  **not** pulled early.
- Supply is therefore **always one tap away**; we never force it.

### 5. The Benefit clock (anti-gaming invariant)

**Perks + the referred discount live for at most 60 days from the last paid order. Only a
paid order resets that clock — scanning never does. One Box = at most 60 days of live
benefits, with no exception** (a genuinely light consumer who scans slowly is included: one
Box still buys only 60 days of benefits).

- At **day 60 with no paid order → benefits lapse**: the Member becomes a **Lapsed Member**
  ([ADR-0005](./0005-subscription-lifecycle-and-lapse.md)) — Perk redemption + referred
  discount off, **XP/Level frozen + retained**, Streak breaks naturally.
- **Revival requires a paid order** — re-scanning the old Box never revives benefits (this is
  what stops one Box from lasting forever).
- **The referred discount is retained** on revival: inactivity is not a *deliberate* end, so
  it falls on the "keep the discount" side of the [ADR-0004](./0004-referral-economics.md)
  cut, like an involuntary lapse. Only an explicit **Cancel** forfeits it.
- This is a **third lapse trigger** beyond ADR-0005's two (voluntary cancellation; failed
  charge). It also **changes what ADR-0001's 60-day time cap does**: for a silent Smart
  Subscription the cap now **lapses benefits** rather than force-shipping; a Manual
  Subscription simply ships on its own ≤60-day calendar, so the old "force-ship at the cap"
  is retired for the calendar path too.

### 6. Streak "our-fault" freeze (narrow exception)

When **aggregate supply = 0 AND a shipment is in transit** (we have both facts: consumption
from scans, delivery status from the carrier), the **Streak is frozen for that window** — the
Member cannot scan because *we* have not delivered product, so it is not their fault. It
resumes on the first scan after delivery. This is a deliberate, narrow exception to the
"no freeze tokens, the Streak is sensitive" rule ([PRODUCT §3](../PRODUCT.md#streak-mechanics-)):
it is not a banked token, it is "we cannot penalise a gap we caused."

### 7. Retail on-ramp — offer routed by behaviour

A retail buyer who scans a Box becomes a **warm Prospect** holding a **Standalone Box**
([ADR-0007](./0007-standalone-gift-retail-box-activation.md), unchanged: earns XP/Streak,
Perks locked until they subscribe). The subscription offer is **not** pushed at the first
scan (over-pressure risks uninstall, and there is nothing to game — Perks are locked and
XP ≤ Sachets bought). Instead:

- **Proven daily streak (~3–4 days) → proactive Smart offer**, framed on their live progress.
- **Every other pattern** (scanned once then stopped; irregular — two days on, stop, every
  third day) **→ Manual offer at ~day 25** (estimated depletion of a 28-Box; with no reliable
  scan signal the calendar is the only honest trigger), and the offer **also surfaces the
  Perks they have already earned** ("subscribe → get refills every 28–60 days *and* unlock
  your Level-X Perks").
- **Smart always remains a manual choice** anyone can pick — we simply do not *push* it
  without a proven daily habit.

## Consequences

- **No new lifecycle actor.** Smart-pending / Smart-active / silence-lapse are all properties
  of one Subscription and the existing Prospect/Member/Lapsed states — nothing new to model.
- **The supply guarantee is now two flavours**, stated honestly: **Manual = push guarantee**
  (we ship on your calendar); **Smart = "one tap away"** (we ship on your signal or request,
  and lapse benefits — never force product — if you go fully silent).
- **Benefits are self-limiting**, so spend-funded Perks stay financed by real consumption and
  no one coasts on a single Box.
- **Web checkout must expose the mode + cadence choice and bind the Subscription on login**
  (already the canonical entry per ADR-0010).
- **The carrier tracking integration is now load-bearing** for scheduling accuracy and for the
  Streak freeze — it moves from "nice to have" to a dependency (still behind the parked
  fulfilment/provider work, but the rules here are decidable now).
