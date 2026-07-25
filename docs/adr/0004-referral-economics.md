# Referral economics: split acquisition budget, user discount outlives the trainer

> Numbers below are **placeholders** ("~20% split as 10/10") — illustrative, subject to change once pricing/COGS are set.
>
> **Partially superseded (2026-07):** the fixed ~20% split and the "registered-entity"
> payout gate were written for the invite-only trainer model. With the **Agent** channel
> (tiered commission, mass self-serve), the budget now **floats** (buyer discount fixed,
> commission scales) and payout runs through a marketing agency ([ADR-0008](./0008-agency-payout-intermediary.md)),
> not per-person invoicing. Referral is single-level ([ADR-0009](./0009-single-level-referral-no-mlm.md)).
> Full current model: [program doc](../product/agent-affiliate-program.md). The principles
> below (permanent buyer discount, commission gated on active subscription, no compounding
> with Levels, self-dealing hard-block) **still hold**.

## Context

Affiliates (trainers) drive acquisition. We want a self-funding referral model that motivates both the trainer and the buyer, without eroding core revenue in the engagement-scaling way [ADR-0002](./0002-two-purse-gamification-funding.md) forbids.

## Decision

A fixed **acquisition budget (~20% of price)** is pre-built into pricing and split when a Member is acquired via a trainer:
- **~10% discount to the Member** (the buyer),
- **~10% commission to the Affiliate** (the trainer).

Rules:
- **Member's discount survives the *referrer* leaving, but not the Member's own *voluntary cancellation*.** Two independent axes — the discount holds unless the Member themselves deliberately ends the Subscription:
  - *Referrer departs:* if the Affiliate/Agent is no longer active, their commission stops (FluoFit recaptures it), but the Member **keeps** their discount. Margin on a referred Member: ~80% while the referrer is active → ~90% after they leave — never 100%. Accepted deliberately as the acquisition lever.
  - *Member's subscription continuity:* the discount is tied to the **continuous life of the Subscription**, not the life of the account. It **survives an involuntary lapse** — a failed charge → dunning → reactivation *resumes the same Subscription* with discount + attribution intact — but is **forfeited on voluntary cancellation**: a later resubscribe is a **new** Subscription at **full price**, unless the Member enters a (possibly different) `ref` code, which re-attributes to whoever owns that code. The cut is *"did the Member deliberately end it?"* — **not** *"is the Subscription currently active?"*.
- **Trainer's commission is gated by two conditions:** the Member's Subscription is active **AND** the trainer is still an active Affiliate. (Recurring per [ADR-0001]/§4.)
- **Fixed, flat, non-scaling, non-stacking** — this is the only discount on FluoFit's own product price (Levels never cut product price, per ADR-0002), so it cannot compound with Level perks.
- **Self-dealing guard required:** a trainer must not be able to refer themselves or an alt-account to harvest both the discount and the commission.
  - **v1 scope — hard block only:** the system rejects a Member entering their *own* `ref` code on their own account (literal self-referral never happens). This is the whole guard for v1.
  - **Deferred (not built in v1):** the *soft-flag* layer — detecting a trainer's separate alt-account via shared payment method / address / device, holding that commission (`Held`), Admin review, and repeat-pattern suspension. Recorded in [OPEN-FLOWS.md](../OPEN-FLOWS.md) for when the program scales. Reason: shared card/address is common among legitimate people (spouse trains spouse), so auto-punishing needs human review that isn't worth building at v1 scale.
- ⬜ **Commission base (list price vs amount actually collected)** — to define when numbers finalize.

## Consequences

- Referred Members are permanently lower-margin (~10% off for life) — a conscious trade for acquisition and for the incentive it creates to enter a trainer code (which also improves attribution).
- Pricing must bake in the full ~20% so the program is self-funding, not paid from a margin that isn't there.
