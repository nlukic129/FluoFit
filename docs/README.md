# FluoFit — Documentation index

The map of where everything lives. The **rules** that govern this structure are in
[`../CLAUDE.md`](../CLAUDE.md) (auto-loaded by Claude Code every session); this file is
the human-facing mirror.

> **One fact = one place.** Everywhere else links to it, never copies it.

## The docs

| File | Owns | Answers |
|---|---|---|
| [`../CONTEXT.md`](../CONTEXT.md) | **Language / glossary** | What do we *call* things? (Box, Sachet, Member, XP…) |
| [`PRODUCT.md`](./PRODUCT.md) | **Product & features (the idea)** | What are we building, and how should it behave? |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | **Technology (the how)** | Stack, auth, RLS, offline sync, data model. |
| [`adr/`](./adr/) | **Decisions (the why)** | Why did we choose X — one hard-to-reverse decision per file. |
| [`prototypes/`](./prototypes/) | **Throwaway UI** | Quick experiments, not production code. |
| [`../CLAUDE.md`](../CLAUDE.md) | **How we work** | Conventions, invariants, and this documentation map. |
| [`SKILLS-GUIDE.md`](./SKILLS-GUIDE.md) | **How to use skills** | Which Claude Code skill to use when, by phase. |
| [`OPEN-FLOWS.md`](./OPEN-FLOWS.md) | **Known flow gaps** | Which flows have holes, and their status (resolved / open / parked). |

## Decision records (ADRs)

- [ADR-0001](./adr/0001-consumption-driven-subscription.md) — Consumption-driven subscription, billed per Box at shipment
- [ADR-0002](./adr/0002-two-purse-gamification-funding.md) — Every gamification Perk maps to one of two funding purses
- [ADR-0003](./adr/0003-affiliate-consent-boundary.md) — Affiliates see client consumption only via separate, explicit opt-in
- [ADR-0004](./adr/0004-referral-economics.md) — Referral economics: split acquisition budget, user discount outlives the trainer
- [ADR-0005](./adr/0005-subscription-lifecycle-and-lapse.md) — Subscription lifecycle: account states, lapse triggers, earning after lapse
- [ADR-0006](./adr/0006-aggregate-supply-and-fraud-floor.md) — Supply, fraud floor, and refill trigger computed on an aggregate pool, not per Box
- [ADR-0007](./adr/0007-standalone-gift-retail-box-activation.md) — A gift/retail Box activates the ecosystem without a Subscription (standalone Box)
- [ADR-0008](./adr/0008-agency-payout-intermediary.md) — A marketing agency is the payout rail for all referrers (supersedes the per-person entity gate)
- [ADR-0009](./adr/0009-single-level-referral-no-mlm.md) — Referral is strictly single-level — no MLM / network override
- [ADR-0010](./adr/0010-app-optional-scheduled-subscription.md) — App is optional: base Scheduled Subscription works with no app; app-less web/email entry; commission binds on the paid order

## Adding to the docs

Route new information by *kind*, not by "whatever file is open":

- New/renamed term → **CONTEXT.md**
- Feature behavior / product idea → **PRODUCT.md**
- Stack / schema / technical mechanism → **ARCHITECTURE.md**
- A decision expensive to reverse → **new `adr/NNNN-*.md`** (then link it from PRODUCT)
- UI experiment → **prototypes/**
