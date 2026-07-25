# Subscription lifecycle: account states, what triggers a lapse, and earning after lapse

## Context

The model described the steady-state loop (activate → scan → refill) but never defined how a person enters it, nor what actually ends a Subscription. Two holes:

1. Signup creates an **account**, not a Subscription — so a logged-in, not-yet-subscribed person had no name and no defined screen. And a former Member whose Subscription ended is not the same as a cold newcomer: their history must survive.
2. "Lapsed" was used (it freezes Level, per [ADR-0002](./0002-two-purse-gamification-funding.md)) but nothing said what *causes* it. The 60-day time cap was mistakenly read as an "expiry" — it is not; per [ADR-0001](./0001-consumption-driven-subscription.md) it is a *refill trigger* (it ships a Box), not an end of Subscription.

## Decision

**Account states** (see [CONTEXT.md](../../CONTEXT.md) for the terms):

- **Prospect** — account, no active Subscription, *never* a Member. No history. Holds the affiliate `ref` code; sees the start-Subscription entry flow. Becomes a **Member** on first successful Box order.
- **Member** — account + active Subscription.
- **Paused** — a Member who voluntarily holds billing + shipments, intending to return. The Subscription stays **alive but dormant**; un-pausing resumes the **same** Subscription. Level/XP retained + frozen; Perk redemption + partner/sponsor codes off; **Streak breaks** (single-layer weekly grace, no freeze tokens). **Referred discount is retained** — pause is *not* deliberately ending the Subscription, so it sits on the "keep the discount" side of the [ADR-0004](./0004-referral-economics.md) cut (unlike cancellation). Behaviour spec: [PRODUCT §1 pause](../PRODUCT.md#subscription-pause-).
- **Lapsed Member** — a former Member whose Subscription is no longer active. **All history is retained**; Level/XP frozen (not reset); Perk redemption paused.

**A Member becomes Lapsed via exactly two paths:**

1. **Voluntary cancellation** — the Member turns the Subscription off.
2. **Failed refill charge, unrecovered.** A charge occurs at *every* refill (billed per Box at shipment), whichever trigger fired — 21 scans, "running low", or the 60-day cap — **not** only at the cap. A single failed charge does **not** lapse the account: it enters a **past-due (dunning)** sub-state with retries over a short window; only if unrecovered does it become Lapsed. The exact window length is a parameter tied to the (parked) payment provider.

**Earning after lapse — rule (A):** if a Lapsed/cancelled person still physically holds a Box with un-drunk Sachets they already paid for, they **keep earning XP/Streak** by scanning those remaining Sachets; only **Perk redemption** is paused. Earning follows *paid product*; redemption follows *active Subscription*. This preserves the "XP ≤ Sachets bought" invariant (nothing unpaid is earned) and gives a natural reactivation hook ("6 Sachets left — don't break your streak").

## Consequences

- The app must render a distinct home for each of Prospect (cold), Member, and Lapsed Member (warm "welcome back, Level N frozen").
- History (XP ledger, scan calendar, Level, affiliate attribution, commission records) is retained across lapse — for reactivation continuity, affiliate/financial reconciliation, and analytics.
- **Cancellation never erases XP/Level.** Voluntary cancellation only makes someone a Lapsed Member; their progress stays untouched **as long as the account exists** — this is a deliberate **win-back lever** (a returning user with an existing Level/streak is far easier to reactivate than one told to start over). There is no timer that "melts" progress while the account lives.
- **Erasure is tied only to the account's fate, not the Subscription's:** progress is removed only when the Member (a) explicitly deletes the account (right to erasure) or (b) hits a defined **dormancy** period (account untouched for X years → dormant → deletion with notice). Both are part of the **parked** account-deletion / data-rights work — the *rule* is recorded here, not implemented.
- **Financial/affiliate records** (paid commissions, invoices) are kept separately and longer as an accounting obligation, independent of a Member's XP.
- Billing must distinguish *voluntary* churn from a *recoverable* billing failure — different reactivation UX, and different **referred-discount / attribution** treatment: an involuntary lapse *resumes the same Subscription* (discount + `ref` attribution intact on reactivation), whereas a voluntary cancellation *forfeits* the referred discount — a later resubscribe is a new Subscription at full price unless a `ref` is re-entered. Owner of this rule: [ADR-0004](./0004-referral-economics.md).
- ⬜ Open: dunning window length + retry cadence (depends on payment provider — parked).
