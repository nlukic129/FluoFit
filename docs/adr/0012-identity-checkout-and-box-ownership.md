# Passwordless email-first checkout; the first scan claims the whole Subscription onto the scanner; a scanned Box is locked; no account-linking

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
   (a *different* email B). If ownership were split (Subscription on A, XP on B), that person
   could never redeem a Perk (redemption needs an active Subscription on the same account as
   the Level). We want one account per person **without** building an account-linking flow.

## Decision

### 1. Passwordless, email-first checkout

Web checkout is **email + pay**; the account is **auto-provisioned (passwordless) from that
email** — no upfront registration, no password wall. A password / magic-link is set **later**,
only when the Member wants to manage the Subscription. An **already-existing email does not
block the sale**. The account is a **by-product of the purchase, not a gate before it**.

### 2. The first scan claims the whole Subscription onto the scanner

At checkout the Subscription lives on the checkout email's account. **The first scan of one of
its Boxes transfers the *entire* Subscription — billing, refills, notifications, XP/Streak/Level,
`ref` attribution — onto the scanning account, permanently.** It is a **transfer/consolidation,
not a link**: everything ends up on **one** account, so there is **no split** and Perks work.

- **Buyer scans their own Box in-app** (the normal case, incl. web-email-A → app-login-B): the
  whole Subscription consolidates onto the account they actually use. The self-split is
  **solved by construction**.
- **Buyer never scans** (base / web-only): the Subscription simply stays on the checkout
  account, managed via magic-link / web. Nothing to transfer.

### 3. A scanned Box is locked; a retail Box has nothing to transfer

- **One-time activation:** once a Box is scanned it can **never** be scanned again (existing
  anti-duplication, [PRODUCT §2](../PRODUCT.md#2-scan-model-)). A second scanner hits the
  "already bound → contact support" path.
- **Retail / Standalone Box** (no Subscription behind it — bought off a shelf): there is no
  Subscription to transfer, so the scanner becomes a **Standalone Box holder**
  ([ADR-0007](./0007-standalone-gift-retail-box-activation.md)) — earns XP/Streak, Perks locked
  until they start their own Subscription. Only a **Subscription Box** carries a Subscription to
  claim.

### 4. No account-linking

We never keep two accounts and merge them — we **transfer** everything to the scanner's account
(consistent with [ARCHITECTURE §1](../ARCHITECTURE.md#1-authentication--identity-)'s deferred
cross-surface linking). This is what makes the model simple and split-free.

## Consequences

- **The self-split (same person, two emails) is eliminated** — the app scan pulls the whole
  Subscription onto the app account.
- **Whoever physically holds a Box and scans it first takes over its Subscription.** This is the
  deliberate trade-off (the "you can call it stealing" case the author accepted). The guard is
  **physical**: the unique QR is under a **tamper seal** revealed only on opening, and Boxes
  ship to the subscriber's address — so scanning needs physical possession of a delivered Box.
  Disputes are resolved by the **Admin Console** override toolkit (unbind/rebind, attribution
  fix). Accepted for v1 simplicity.
- **Gifting a Subscription Box = handing over the Subscription** (the recipient's scan claims
  it). A plain **retail** gift is the Standalone Box path instead, which transfers nothing.
- **Billing-mandate movement on transfer** leans on the **parked** payment provider (same person
  → the card follows; a different-person claim would prompt the new owner to set up payment for
  future refills). The **rule** is decidable now; the mechanics wait on payment/fulfilment.
- **Rejected alternative:** keeping two accounts with an optional magic-link "link my accounts"
  step. It removes the split too but adds real complexity; full transfer is simpler and is the
  chosen path. Recorded so linking isn't reintroduced as a "fix".
