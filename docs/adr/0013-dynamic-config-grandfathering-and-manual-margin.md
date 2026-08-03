# Gamification & referral config is Admin-dynamic; grandfathering differs by dial; margin safety is human-managed

> Amends [ADR-0002](./0002-two-purse-gamification-funding.md) (spend-funded self-financing is
> no longer guaranteed "by construction" — it becomes human-managed). Builds on
> [ADR-0004](./0004-referral-economics.md) (buyer discount locked for the Subscription's life),
> [ADR-0006](./0006-aggregate-supply-and-fraud-floor.md) (the fraud floor stays the one
> hard-enforced invariant), and the tier mechanics in the
> [program doc](../product/agent-affiliate-program.md). Config surface:
> [admin-console §8](../product/admin-console.md#8-gamification--referral-config-).

## Context

Two families of numbers were left "set once, tune later": the **leveling structure** (which
Levels exist, the XP threshold for each, the reward at each) and the **referral numbers**
(buyer discount %, Agent commission tier rates + thresholds) — the latter explicitly **blocked
on COGS → pricing**. The founder wants **all of them Admin-configurable at runtime**, precisely
so they can be tuned *while* pricing/COGS are still being modeled, without a code change. The XP
*thresholds* and *formula* had been marked "sensitive / no live UI" for fear of breaking
production.

Making them dynamic collides with invariants written when they were static:

- **"Level never drops" / "don't move the goalposts on the already-qualified"** ([ADR-0002](./0002-two-purse-gamification-funding.md), [ADR-0005](./0005-subscription-lifecycle-and-lapse.md)).
- **Buyer discount locked for the life of the Subscription** ([ADR-0004](./0004-referral-economics.md)).
- **Spend-funded Perks are self-financing** — a high Level implies enough spend to cover the
  Perk's COGS ([ADR-0002](./0002-two-purse-gamification-funding.md)) — a claim that silently
  assumes the threshold was set high enough relative to the reward.

Two questions had to be answered for every dial: **(1)** when it changes, what happens to people
already committed under the old value? **(2)** does the system stop the Admin from saving a
money-losing configuration?

## Decision

**Everything below is an Admin-configurable dial.** How a change propagates depends on the
**nature of the dial**, not one blanket rule — the guiding cut is *forward-only,
grandfathered-backward*, refined per dial:

| Dial | On change |
|---|---|
| **Which Levels exist** | add freely; **a Level with holders is never deleted** (only cosmetics — name, icon — editable). Deleting would either strand holders on a phantom Level or demote them; both disallowed. |
| **XP threshold to the next Level** (checkpoint) | applies only to Members **still climbing** toward it; **never demotes** anyone already past it. |
| **Spend-funded / zero-cost reward** (premium flavor, free Box, badge, beta) | **grandfathered** — snapshotted onto the Member at the moment they cross the Level; a later change reaches only **future** crossers. FluoFit controls these, so it can honor the frozen promise. |
| **Partner-funded reward** (% at a partner, event, drop) | **live / current for all holders** — a partner is a third party that can leave, so it *cannot* be pinned; a holder gets whatever partner deals exist for their tier now (empty slot if none). |
| **Buyer discount %** | locked at acquisition ([ADR-0004](./0004-referral-economics.md)); a change applies to **new buyers only**. |
| **Agent tier rate + thresholds** | **live for all at the next monthly snapshot** — the tier is already a recomputed quantity (snapshot + hysteresis on active-sub count), so a new table is just another input to that recompute; only already-`Accrued` earnings are frozen. |
| **Affiliate fixed %** | per-person, changed only through that Affiliate's own negotiated terms — not a global dial. |

### Checkpoint XP

XP counts **toward the next Level** (per-segment progress, "N to go"), **not** a single
ever-growing displayed lifetime total. Changing a threshold changes the denominator of the
segment a Member is currently climbing (e.g. 20/100 → 20/200) but never their position. The
cumulative scan count still exists under the hood and still backs the fraud floor (`lifetime XP
≤ Sachets bought` — [ADR-0006](./0006-aggregate-supply-and-fraud-floor.md)); because thresholds
never mint XP, the fraud floor is untouched by any threshold change.

### No enforced margin guardrail — human-managed instead

The Console **does not** stop the Admin from saving a money-losing ladder (e.g. a cheap
threshold on an expensive spend-funded reward). Self-financing stops being guaranteed *by
construction* and becomes **founder discipline + an offline calculator** (a sibling of the
existing `business-model-calculator.html`) that projects margin-per-Member vs reward COGS
before a change is made. Rejected the alternative — a Console that cross-checks
`threshold ≥ reward-COGS / margin-per-Sachet` and blocks violations — as more machinery than a
single-founder v1 needs; the same posture as "disputes are arbitrated by a human, not an
algorithm" throughout the model.

The **one** invariant that stays **hard-enforced** is the fraud floor (`XP ≤ Sachets bought`),
including the [admin-console §6](../product/admin-console.md#6-support-surface--override-toolkit-)
rule that an XP correction can never silently break it. **Honesty is enforced by the system;
margin/pricing tuning is owned by the human.**

### XP formula stays config-only

The XP **formula** (base per scan + Streak multiplier) remains config-only with **no live admin
UI** (unchanged). The per-Level **thresholds** already give full control over climb difficulty;
the formula is the more dangerous, redundant second knob.

## Consequences

- **[ADR-0002](./0002-two-purse-gamification-funding.md) is amended:** spend-funded
  self-financing is no longer "by construction" — it holds only if the Admin sets thresholds
  correctly, aided by the calculator.
- **A per-Member snapshot of earned spend-funded rewards is now required** (bounded
  versioning) — the only real "pin per person" in the model, alongside the buyer's locked
  discount. Everything else is a sticky derived fact (Level position) or read live (thresholds,
  partner perks, tier rate).
- **The numbers themselves are still pending COGS → pricing.** This ADR fixes the *mechanism*
  (dynamic, per-dial grandfathering, no guardrail), not the values; the financial-modeling pass
  fills them.
- **A decision-support calculator becomes a real (if throwaway) tool** to build alongside the
  config surface.
- **Still deferred:** the marginal-band vs whole-book tier structure
  ([program §2](../product/agent-affiliate-program.md)) — it determines the *concrete shape* of
  the tier config screen, decided with pricing.
