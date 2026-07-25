# A gift/retail Box activates the ecosystem without a Subscription (standalone Box)

## Context

The QR is channel-agnostic ([PRODUCT §2](../PRODUCT.md#2-scan-model-)) — revealed only on
opening, so a Box can reach someone who is **not** a Member (gifted, or bought at retail).
The flow for "a non-subscriber scans a Box" was never drawn, and one thing was genuinely
open: does activating a gift/retail Box **require** starting a Subscription (option A), or
can it be activated **standalone** (option B)?

## Decision

**The scan is the universal entry, branching by who scans:**

1. **No account / logged out** → scan routes to signup → they become a **Prospect**.
2. **Prospect (no Subscription)** → scan offers "activate this Box".
3. **Member** → normal Box Activation.

**Option B — standalone Box (chosen).** A gift/retail Box is a **Standalone Box**: activated
**without** a Subscription. The activator (a Prospect) **earns XP/Streak** on it — the fraud
floor holds because the 28 Sachets were bought by *someone* (gifter/retailer), so `XP ≤
Sachets bought` is intact — but **cannot redeem Perks** (redemption needs an active
Subscription, [ADR-0002](./0002-two-purse-gamification-funding.md)). This is exactly the
**earn-not-redeem** split already defined for a Lapsed Member ([ADR-0005](./0005-subscription-lifecycle-and-lapse.md)
rule A). On depletion, the Prospect is prompted to start a Subscription → becomes a **Member**,
carrying their earned XP/Level forward.

Rejected **option A** (must subscribe to activate): gating a gift behind a paywall adds
friction at the worst moment; "try, then subscribe" converts better. B does **not** break the
"Member = active Subscription" invariant, because the standalone activator is a **Prospect**,
not a Member.

## Consequences

- The **gift/retail channel itself is not a v1 focus** (subscription-via-trainer is). This ADR
  fixes the *model* now so the QR/activation design needs no redesign when the channel launches.
- The conversion step ("start a Subscription") depends on **payment**, which is parked — so the
  channel can't fully ship until payment is unparked.
- A **Prospect can now hold consumption history** (from a Standalone Box). The clean line
  between Prospect and Lapsed Member is therefore *"has this person ever held an active
  Subscription?"* — Prospect never has; Lapsed Member has and it ended. (CONTEXT updated.)
