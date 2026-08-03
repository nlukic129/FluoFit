# Agent & Affiliate Program

The referral layer of FluoFit. Owns the full behavior of the two commissioned referral
roles. Terms in [`/CONTEXT.md`](../../CONTEXT.md); economics + hard decisions in
[`docs/adr/`](../adr/). Parent index: [`PRODUCT §4`](../PRODUCT.md#4-affiliate--agent-referral-program-).

> Status legend: ✅ decided · 🟡 partially decided · ⬜ open
> **All numbers below are placeholders — every figure waits on COGS/pricing.** The
> structure is fixed; the numbers get filled in a later financial-modeling pass.

---

## Three referral roles ✅

| Role | Who | Commission | Channel | Consumption view |
|---|---|---|---|---|
| **Agent** | A Member who crossed the eligibility Level, applied, was approved | **Tiered** (rises with active referred Subscriptions) | scalable, self-serve | commission plane; coaching plane per consent |
| **Affiliate** | Hand-picked trainer/influencer, added manually | **Fixed negotiated %** | curated, invite-only | commission plane; coaching plane per consent ([ADR-0003](../adr/0003-affiliate-consent-boundary.md)) |
| **Partner** | A business (gym, shop, event) | none — funds Perks instead | loyalty | n/a |

Agent is the **mass channel** (turns the gamification funnel into acquisition);
Affiliate is the **curated channel** (a few high-value names on bespoke terms).
Partner is unrelated — see [PRODUCT §5](../PRODUCT.md#5-loyalty--partners-).

---

## 1. Agent — becoming one ✅

The pitch: any engaged Member can graduate into a paid referrer.

- **Eligibility gate = a fixed Level** (configurable, but **not moved on live candidates** — moving the bar mid-grind kills the motivation the whole XP system builds). Crossing it unlocks an **Apply** button.
- **Hard requirement: must be an active Member** (not Lapsed) — a seller has to use the product themselves. If an Agent later lapses their **own** Subscription, their Agent status **pauses** (see §5).
- **Intake = capped waves, not continuous approval.** FluoFit opens a wave ("30 spots"); eligible Members apply; **Admin curates who gets in** (brand-fit / engagement, not first-come); wave closes when full. This is the **supply valve** — controls *how many* agents exist without touching the eligibility Level.
  - **Not selected → nothing lost:** Level stays, Member stays eligible, sits on a **waitlist** for the next window. No "rejected" state — just "spots full".
  - Scarcity is deliberate — a capped wave is a marketing event ("limited spots, apply now"), not just an admin throttle.
- **Optional wave focus:** a wave can target a **delivery city** (from the shipping address FluoFit already holds for fulfillment — no new data collected, no third-party sharing). "I need 10 in Valjevo" → the opportunity shows only to eligible Members whose delivery goes to Valjevo. Caveat: delivery city ≠ where they sell/train; it's a good-enough proxy and Admin curates anyway.
- **On approval:** the Member logs into the agent portal with the **same email** and receives their `ref` code/link.

---

## 2. Agent — tiered commission 🟡

Commission rate **rises with the count of that Agent's active referred Subscriptions** (e.g. placeholder 5% / 10% / 15%). The **structure** of the ladder is deliberately **left open**:

- ⬜ **Marginal band vs whole-book — deferred, both on the table.**
  - **Marginal band:** active subs ranked; first *N* at low rate, next band higher, etc. Stable, but weaker "level-up" feel.
  - **Whole-book tier:** current active-sub count picks **one rate for the entire portfolio** — crossing the threshold lifts *all* clients at once. Stronger dopamine (mirrors Member Level mechanic); volatile at the boundary, tamed with a **monthly snapshot + hysteresis** so one lapse doesn't demote.
- **Demotion on lapse:** yes, an Agent can drop a tier if active subs fall — but smoothed (snapshot/hysteresis), never punitive for a single lost client. Keeps the "earn only while FluoFit earns" spine.
- Numbers, thresholds, and which of the two structures — all **wait on pricing**.
- **The rate table + thresholds are Admin-dynamic** ([ADR-0013](../adr/0013-dynamic-config-grandfathering-and-manual-margin.md)): a change goes **live for all Agents at the next monthly snapshot** (the tier already recomputes on active-sub count), so only already-`Accrued` earnings are frozen — not "grandfathered per Agent". No system margin-guardrail; checked in the calculator, not enforced.

---

## 3. Economics — structure fixed, numbers pending ✅ / ⬜

Extends [ADR-0004](../adr/0004-referral-economics.md). The old fixed ~20% budget (10% buyer + 10% trainer) no longer holds once commission tiers up to a higher rate.

**Invariant (decidable now, independent of any number):**
- **Buyer discount is fixed regardless of the Agent's tier** (a buyer is never penalized for having a high-earning agent; the discount is predictable).
- **Commission is the only lever that scales** with tier.
- Therefore the total **acquisition budget floats** — lowest tier is the cheapest, highest tier the most expensive — and the **worst-case (top) tier must still fit under margin** once COGS is known.

⬜ All %s (discount, each tier, where thresholds sit) wait on COGS → price → budget, in that order. **They are Admin-dynamic dials** ([ADR-0013](../adr/0013-dynamic-config-grandfathering-and-manual-margin.md)): a buyer-discount change binds **new buyers only** (existing locked, [ADR-0004](../adr/0004-referral-economics.md)); a tier-rate change is **live at the next snapshot**. Margin safety is human-managed via the calculator, not enforced.

---

## 4. Attribution & the buyer's discount ✅

Same mechanics as the existing referral flow ([ADR-0004](../adr/0004-referral-economics.md), [ARCHITECTURE §1](../ARCHITECTURE.md#1-authentication--identity-)):

- First-touch `ref` at signup **or web checkout**, locked for the life of that Subscription; retroactive linking only within the grace window (14 days / 2nd Box).
- **Commission binds on the sale event, which is scan-independent** ([ADR-0010](../adr/0010-app-optional-scheduled-subscription.md)): for a **paid direct subscriber** (app **or** app-less base) the sale is the **paid order**, so an Agent earns even on a referred Member who never installs the app; only a **gift/retail Standalone Box** uses the Activation scan as the sale event. The commission lifecycle (`Accrued → Cleared → Payable → Paid`) is unchanged — `Accrued` just keys off the paid order rather than a scan.
- **The buyer's discount is permanent and survives the Agent leaving** — identical to the Affiliate rule. If the Agent departs or is removed, FluoFit recaptures the commission slice; the buyer keeps their discount for the life of the account.

---

## 5. Offboarding & pause ✅

- **Agent leaves / is removed:** their `ref` code stops binding new Members; open commissions run out their lifecycle (`Cleared` → paid, then close); the dashboard goes **read-only** (they can still see historical earnings/stats).
- **Agent lapses their *own* Subscription → status paused:** the code freezes **and existing commissions from their clients stop accruing** while lapsed — they resume on reactivation. Consistent with "must be an active Member to be an Agent," and a built-in incentive not to cancel.
- **Buyers are never affected** by an Agent's offboarding beyond losing that agent as a contact — their discount and their own subscription continue untouched.

---

## 6. Fraud posture at mass scale 🟡

Opening the channel to the masses raises the self-dealing incentive that [ADR-0004](../adr/0004-referral-economics.md) deferred at invite-only scale. **v1 relies on structural/economic guards rather than detection:**

- **Level-cost of entry** — you must genuinely consume to level up (XP ≤ Sachets bought, [ADR-0006](../adr/0006-aggregate-supply-and-fraud-floor.md)), so every Agent account costs real spend; you can't cheaply mint agents. This is the strongest natural barrier.
- **Hard block** on literal self-referral (own `ref` on own account).
- **30-day hold + clawback** — a fake sale that refunds/cancels before clearing pays nothing.
- **Commission only while the referred Subscription is active** — a fake account that cancels stops paying.
- **First-payout gate (added for mass scale):** an Agent's commission on a referred Member only begins clearing once **that Member crosses a real-activity mark** (e.g. 2nd Box / past the refund window), not on first activation — so an account that never truly consumes never pays out.
- ⬜ **Soft-flag detection still deferred** (shared payment/address/device → `Held` → Admin review → suspension) — but now *consciously* deferred at mass scale, revisit-when-it-hurts.

---

## 7. Payout ✅ — see [ADR-0008](../adr/0008-agency-payout-intermediary.md)

- **A paušalna marketing agency is the payout rail.** FluoFit issues **one invoice-in** to the agency; the agency distributes cash to **both Agents and Affiliates**. This removes the old "each referrer must be a registered entity" gate — an individual Agent no longer has to register to be paid.
- **Commission lifecycle unchanged:** `Accrued` (on Box Activation) → `Cleared` (after 30-day hold) → `Payable` → `Paid`; refund/chargeback before clearing claws back.
- **Cadence:** monthly, with a minimum threshold (below it carries over to avoid transfer fees).
- ⬜ Cross-border tax/flow if FluoFit (Dubai) funds the agency (Serbia) — flagged, parked.

---

## 8. Affiliate — the curated channel ✅

- **Onboarding:** invite-only, Admin adds the person manually; **fixed negotiated commission %** (outside the Agent tier ladder and the Level gate) + a negotiated discount for their buyers.
- **Auth & attribution:** Email OTP, `shouldCreateUser: false`; `ref` binding as in [ARCHITECTURE §1](../ARCHITECTURE.md#1-authentication--identity-).
- **Coaching plane** (client consumption view) is available to **any referrer** — Agent or Affiliate — gated by the client's explicit opt-in; **consent, not role, is the gate** ([ADR-0003](../adr/0003-affiliate-consent-boundary.md)). Without consent the referrer sees only pseudonymous commission rows. Surface/render: [Agent/Affiliate web app](./agent-affiliate-app.md).
- Payout via the same agency rail (§7).

---

## 9. Later versions

- **Bonus / progress bar (v2):** repeating milestone spiff on **cumulative lifetime Box-activation volume** ("every X activations → Y bonus", placeholder 100 → 500€) — counts *order volume*, not new-customer count, so it rewards **retention** as much as acquisition. **On top of** commission → needs its **own budget line** (must not eat margin). Numbers wait on pricing.
- **Leaderboard / Agent of the Month/Year (v2+):** ranked by **period performance** (e.g. net-new activations that month) so it's a fresh race, not dominated by seniority. Prizes from a separate budget. Direction only.
