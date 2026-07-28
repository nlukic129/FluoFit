# Passwordless email-first checkout; the Subscription is the orderer's, a Box's ecosystem-ownership is the first scanner's; no account-linking

> Builds on [ADR-0010](./0010-app-optional-scheduled-subscription.md) (commission/ownership
> bind on the paid order) and [ADR-0007](./0007-standalone-gift-retail-box-activation.md)
> (Standalone Box). Sharpens [ARCHITECTURE §1](../ARCHITECTURE.md#1-authentication--identity-)
> ("cross-surface account linking is deferred").

## Context

Two identity questions surfaced while hardening the Subscription:

1. **Should web checkout require registration?** A Subscription needs an account to attach to
   (billing, management, order-bound commission — [ADR-0010](./0010-app-optional-scheduled-subscription.md)),
   but forcing "create an account + password" *before* paying is a known conversion killer.
2. **What if the buyer and the scanner are different accounts?** A single person can check out
   on the web with typed **email A** and later open the app and sign in with **Apple/Google**
   (a *different* email B) — or someone buys a Box as a **gift** and another person scans it.
   Who owns the Box, the XP, the Subscription, the billing, the notifications?

## Decision

### 1. Passwordless, email-first checkout

Web checkout is **email + pay**; the account is **auto-provisioned (passwordless) from that
email** — no upfront registration, no password wall. A password / magic-link is set **later**,
only when the Member wants to manage the Subscription. An **already-existing email does not
block the sale** — the order attaches to the existing account (a magic-link lets them log in
to see it). The account is a **by-product of the purchase, not a gate before it**.

### 2. The Subscription belongs to the orderer — permanently

The **Subscription** (billing, refills, notifications, `ref` attribution) is permanently the
**orderer's** account. It never transfers. This is the commercial-binding half of "Box
Activation" already bound to the paid order by [ADR-0010](./0010-app-optional-scheduled-subscription.md).

### 3. A Box's ecosystem-ownership belongs to the first scanner — permanently

A physical **Box** starts owned by its orderer, but its **ecosystem value (XP / Streak / Level)
binds to the first account that scans it** — the one-time activation from [PRODUCT §2](../PRODUCT.md#2-scan-model-).
Once scanned it is **final**: a later scan by another account hits the existing "already bound
to another account → contact support" path, never a re-transfer.

- Orderer scans their own Box (the normal case) → commercial and ecosystem ownership sit on the
  **same** account. Everything works.
- A **different** person scans it (a gift) → for them the Box is exactly a **Standalone Box**
  ([ADR-0007](./0007-standalone-gift-retail-box-activation.md)): they earn XP/Streak, but Perk
  redemption stays locked until they hold their own Subscription. The orderer's Subscription is
  untouched — **nothing was "stolen".**

### 4. No account-linking — a self-split is an accepted consequence

The commercial owner (orderer) and the ecosystem owner (first scanner) **can be different
accounts, and we do not merge them** (v1; consistent with [ARCHITECTURE §1](../ARCHITECTURE.md#1-authentication--identity-)'s
deferred cross-surface linking). The concrete consequence for the **same person using two
emails** (checks out as A, scans in-app as B):

- Subscription + "active" status on **A**; XP / Level on **B**.
- **Perk redemption requires an active Subscription on the same account as the Level**, so that
  self-split person **cannot redeem Perks** until they consolidate onto one account.

This is **accepted deliberately** for simplicity. Guidance is **one person = one account/email**
(the app can nudge signing in with the checkout email). The split is rare — the Box QR is under
a tamper seal and ships to the buyer, so the scanner is almost always the subscriber — and
recoverable by hand via the **Admin Console** override toolkit (unbind/rebind, attribution fix).

## Consequences

- **Web checkout is guest-style** — lowest friction; the account materialises from the purchase.
- **The gift case needs no new machinery** — it *is* the Standalone Box ([ADR-0007](./0007-standalone-gift-retail-box-activation.md)).
- **Rejected alternative: account-linking / auto-merge at scan** (e.g. a magic-link "is this
  your other account?" unify). It removes the self-split but adds real complexity; recorded as a
  deliberate **no** so it is not later built as a "bug fix". Revisitable if the self-split proves
  common in practice.
- Full robustness of billing-mandate movement and cross-account edge cases leans on the
  **parked** payment/fulfilment work; the **rules** here are decidable now.
