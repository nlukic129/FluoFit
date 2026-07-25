# Supply, XP fraud floor, and refill trigger are computed on an aggregate pool, not per Box

## Context

A Member can hold more than one active Box at once: refill ships when supply runs low, but the previous Box may still have Sachets in it. This breaks two things that were written per-Box:

- The **fraud floor** ([ADR-0002](./0002-two-purse-gamification-funding.md)): "XP/Streak ≤ Sachets bought — 28 per Box." With two Boxes home, is the ceiling per-Box or the sum?
- The **refill trigger** ([ADR-0001](./0001-consumption-driven-subscription.md)): "21 Sachet scans (≈7 left)." Whose Box's counter — and does a refill arriving then re-trigger another refill?

The Sachet QR is non-unique, so the app *cannot* even tell which physical Box a scan came from.

## Decision

Everything consumption-related is computed on a single **aggregate pool**, not per Box:

- **Fraud floor is aggregate:** `lifetime XP ≤ total Sachets ever bought` (28 × Boxes owned). One invariant, no need to attribute a scan to a physical Box (which is impossible anyway).
- **Refill trigger is remaining-supply-based:** fires when `remaining supply ≤ 7`, where `remaining = total Sachets bought − total Sachets scanned`. This *is* the "21 scans / ≈7 left" rule for a single Box, but stays correct for many: while a Member holds 35 Sachets across two Boxes they are not "running low", the clock is idle, and no refill chains off another refill.

The "running low" button and the 60-day time cap are unchanged.

## Consequences

- "21 Sachet scans" in ADR-0001 is the single-Box shorthand for the general **"remaining supply ≤ 7"** rule.
- No refill-chaining: a refill can't fire while the Member still has a full Box at home.
- A Member who throws away a Box still can't inflate XP — the pool only credits Sachets *bought*, and XP is floored by that sum regardless of what's physically drunk.
- Requires the schema to track two running totals per Member (Sachets bought, Sachets scanned), not per-Box counters, for the refill/fraud logic. (Per-Box rows still exist for Activation/ownership.)
