# Every gamification Perk maps to one of two funding purses

> **Amended (2026-07) by [ADR-0013](./0013-dynamic-config-grandfathering-and-manual-margin.md):**
> spend-funded self-financing below is written as guaranteed *by construction* (a high Level
> implies enough spend to cover the Perk). Once Level XP thresholds and rewards became
> **Admin-dynamic**, that guarantee holds *only if the Admin sets thresholds correctly* — it is
> now protected by **founder discipline + an offline calculator**, not by the system. The raw
> fraud floor (`XP ≤ Sachets bought`) stays hard-enforced; the two-purse rule below is unchanged.

## Context

Streaks, XP, and Levels touch real money (partner discounts, premium flavors, upgraded Boxes). Naively tying discounts to Level creates a liability that grows with *engagement* rather than *revenue* — the more active a Member, the more FluoFit loses.

## Decision

Every Perk must be funded from exactly one of two purses:

1. **Partner-funded** — a Partner absorbs the cost (it is their customer-acquisition spend to reach FluoFit's engaged athletes). Costs FluoFit nothing; Level only selects which discount tier the Member is eligible for.
2. **Spend-funded** — FluoFit absorbs a **bounded** COGS (premium flavors, upgraded Box). Safe because XP is floored by Boxes purchased: a high Level can only be reached by a Member who has already spent enough to cover the Perk out of their own margin. *(This "safe" now depends on the Admin setting the threshold high enough relative to the reward — see the amendment note + [ADR-0013](./0013-dynamic-config-grandfathering-and-manual-margin.md).)*

Supporting rules:
- **XP is bounded by consumption**, which is bounded by Boxes bought — the invariant that makes spend-funded Perks self-financing.
- **Level and XP persist; redemption requires an active Subscription.** A lapse pauses Perks and freezes (does not reset) Level.

## Consequences

- **Engagement/Level never cuts the price of FluoFit's own product.** A discount that scales with engagement is an unbounded, engagement-correlated liability and is disallowed. Levels reward with status, community, partner-funded discounts (on the *Partner's* product), and bounded *goods* (premium flavors, better Box, milestone free Box) — never a price cut on the Subscription.
- **Acquisition discounts are a separate, permitted category** (see [ADR-0004](./0004-referral-economics.md)): a fixed, flat, pre-budgeted referral discount is allowed because it is a customer-acquisition cost tied to a one-time event, not an engagement reward, and it does not scale. Because Levels never cut product price, the referral discount is the *only* discount on FluoFit's product price — so it has nothing to stack with (non-stacking by construction).
- Partner-funded Perks depend on signed Partners existing (see loyalty program), so those tiers stay dark until Partners are onboarded.
