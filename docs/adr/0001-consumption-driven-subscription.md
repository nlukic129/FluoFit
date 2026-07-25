# Consumption-driven subscription, billed per Box at shipment

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
