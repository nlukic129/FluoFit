# Consumption-driven subscription, billed per Box at shipment

> **Amended (2026-07) by [ADR-0010](./0010-app-optional-scheduled-subscription.md):** the
> "no calendar billing" rule below is the default, but **not universal**. An app-averse
> Member may run a **Scheduled refill** (fixed, adjustable cadence — default 4 weeks) — a
> narrow, deliberate exception, because the calendar's original failure mode (irregular
> consumers stockpiling) does not apply to the predictable daily base consumer. The
> consumption-driven model below is unchanged for app users.
>
> **Further amended (2026-07) by [ADR-0011](./0011-refill-mode-decoupled-and-benefit-clock.md):**
> the modes are now decoupled from the app (Manual 28–60 cadence chosen at checkout, usable
> even by scanners); and the **60-day time cap no longer force-ships a silent Smart Member** —
> at 60 days with no paid order their **benefits lapse** (Benefit clock) instead. Manual ships
> on its own ≤60-day calendar, so force-ship at a cap is retired.

## Context

Most supplement subscriptions bill and ship on a fixed calendar date (e.g. the 1st of each month), which causes customers to stockpile unused product and eventually churn. FluoFit's core differentiator is that a refill ships only when the Member is actually running low.

## Decision

Billing is **per Box at time of shipment**, not on a calendar. A Refill ships on the **first** of:
1. **21 Sachet scans** (≈7 Sachets left — buffer sized for ≤5-day shipping lead time). This is the single-Box shorthand; the general rule is **remaining supply ≤ 7 across all Boxes owned** — see [ADR-0006](./0006-aggregate-supply-and-fraud-floor.md),
2. the **"running low" button**, or
3. a **time cap**: 2 months from Box Activation (for scanners) or 2 months from previous delivery (for non-scanners). Time-cap auto-shipments are preceded by a 3-day advance notice with a skip/pause option.

Underlying principle — two layers:
- **Subscription guarantees supply** regardless of scanning.
- **Scanning unlocks the ecosystem** (XP, streaks, partner perks, precise refill timing).

## Consequences

- **Monthly revenue is variable** (accepted deliberately) — it tracks real consumption rather than a predictable calendar.
- Slow consumers are billed less often. This is correct ("pay for what you consume"), not a leak: to delay billing a Member must also leave their own supply empty.
- Non-scanners still receive product on the time cap but earn no XP and get no partner perks — the strongest incentive to activate every Box.
- Requires payment + fulfillment to be triggered by domain events (scan / button / time), not a cron on a billing date.
