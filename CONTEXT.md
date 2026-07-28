# FluoFit

FluoFit is a single-serving supplement brand: one daily sachet (creatine, B12, magnesium, vitamin C, etc.) that a recreational athlete mixes with water. Around the product sits an ecosystem — a mobile app (streaks, reminders, community), a consumption-driven subscription, an affiliate program for trainers, and a partner loyalty program.

## Language

**Box**:
The physical carton shipped to a Member. Contains 28 Sachets (≈4 weeks). Carries one unique QR code used to activate it against a Member's account. Has a lifecycle **before** ownership: a generated code is a **Manufactured/Unbound** Box (printed, bound to no one) until first-scan makes it **Activated** (bound to an account — see Box Activation). Provisioned in named **Batches** via the Admin Console.
_Avoid_: Package, carton, kit

**Batch**:
A named set of Box codes generated together in the Admin Console (e.g. "Batch #12 — March, 500 units"), for print runs and status tracking. Each code is an opaque, high-entropy token (never sequential).
_Avoid_: Run, print job, lot

**Sachet**:
A single-serving pouch inside a Box, mixed with water and drunk. Carries a QR code that is **not** unique (shared across all Sachets). Scanning a Sachet is an engagement act, not a commercial one.
_Avoid_: Packet, sachet-pack, serving

**Subscription**:
A Member's standing agreement to receive Boxes. Billed **per Box at time of shipment**, not on a calendar. A refill ships when the Member is running low. The Subscription **guarantees supply regardless of scanning** — it is the layer that promises product. Scanning is a separate layer that unlocks the ecosystem.
_Avoid_: Plan, membership (membership = the loyalty status, not the subscription)

**Box Activation**:
The act of scanning a Box's unique QR code against a Member's account. Starts the Box's consumption clock and unlocks the ecosystem (XP, streaks, partner perks, consumption-based refill timing) for that Box. Without activation the Member still receives product on a time-based refill, but earns no XP and gets no perks. The account bound is the **first scanner** — the Box's **permanent ecosystem-owner** (XP/Streak/Level); the **Subscription that ordered it stays with the orderer** regardless, and accounts are **not linked** ([ADR-0012](./docs/adr/0012-identity-checkout-and-box-ownership.md)).
_Avoid_: Registration, claiming

**Refill**:
A shipment of the next Box. In **Smart** (Consumption-driven) mode it triggers on the first of: remaining supply ≤ 7 (single-Box shorthand: 21 Sachet scans), the "running low" button, or a manual "Order now". In **Manual** (Scheduled) mode it ships on the Member's chosen **28–60-day cadence**. The old 60-day **time cap** no longer force-ships a silent Smart Member — at 60 days with no paid order their **benefits lapse** instead (see **Benefit clock**, [ADR-0011](./docs/adr/0011-refill-mode-decoupled-and-benefit-clock.md)); Manual auto-shipments still carry a 3-day advance notice with skip/pause. Scheduling is **doorstep-to-doorstep** — the system ships early enough (carrier cutoff + weekends) that the Box lands on the target day.
_Avoid_: Reorder, restock

**Consumption-driven refill** (customer-facing label: **"Smart refill"**):
A **refill mode** that fires a Refill on the first of remaining supply ≤ 7 / "running low" button / manual "Order now" ([ADR-0006](./docs/adr/0006-aggregate-supply-and-fraud-floor.md), [ADR-0011](./docs/adr/0011-refill-mode-decoupled-and-benefit-clock.md)). **Requires scanning** to produce the consumption signal, so it only runs with the ecosystem on. **Auto-ships only on a real consumption signal (≤ 7) or manual "Order now" — never on a calendar/timer.** Two substates: **Smart-pending** (mode chosen but not yet scanned — no signal, so **no auto-ship**; the checkout Box covers them and they are nudged to scan) and **Smart-active** (scanning; consumption drives timing). If it goes **silent** (never scanned, or stopped) it is **not** force-shipped — only nudged — and benefits lapse at 60 days (see **Benefit clock**). Contrast **Scheduled refill**.
_Avoid_: auto refill (ambiguous). "Smart refill" is the customer-facing name; the canonical term is Consumption-driven refill.

**Scheduled refill** (customer-facing label: **"Manual refill"**):
A **refill mode** that ships on a **user-chosen cadence of 28–60 days** (28 = daily-consumer floor of 28 Sachets; 60 = lightest honest consumer and the absolute cap), set at checkout and adjustable ([ADR-0011](./docs/adr/0011-refill-mode-decoupled-and-benefit-clock.md)). Needs no scan signal, so it runs with the ecosystem **on or off** — a base/web Member **or** an app Member who scans for XP but wants a calendar ([ADR-0011] decoupled it from the old "app off only" pairing that [ADR-0010](./docs/adr/0010-app-optional-scheduled-subscription.md) set). A narrow, deliberate exception to the "no calendar billing" rule of [ADR-0001](./docs/adr/0001-consumption-driven-subscription.md). Managed app-less via the logged-in web account or an email/SMS magic-link web page. A **refill mode is a property of the Subscription, not a new kind of Member**. Contrast **Consumption-driven refill**.
_Avoid_: Basic plan, calendar subscription (it is one Subscription, not a separate SKU)

**Benefit clock**:
The rule that **Perks and the referred discount live for at most 60 days from the last paid order** — and **only a paid order resets it; scanning never does** ([ADR-0011](./docs/adr/0011-refill-mode-decoupled-and-benefit-clock.md)). So one Box buys at most 60 days of live benefits and no Member coasts on a single Box (the anti-gaming invariant). At 60 days with no order the Member becomes a **Lapsed Member** (benefits off, XP/Level frozen + retained, Streak breaks); a later **paid order revives** benefits, and the **referred discount is retained** because inactivity is not a deliberate end ([ADR-0004](./docs/adr/0004-referral-economics.md)). Distinct from the **Streak** clock (daily) and the **Refill** trigger (supply / calendar).
_Avoid_: grace period, benefit window, trial period

**Member**:
A person with a FluoFit account and an active Subscription. Membership status gates loyalty perks.
_Avoid_: User, customer, client, subscriber (pick "Member")

**Prospect**:
A person with a FluoFit account and no active Subscription who has **never held one** (never a subscribing Member). **May** hold a captured affiliate `ref` code; sees the **Prospect home** — a conversion-first entry surface, **not the full Member home** (no Perk-redemption / Partner / loyalty layer). Usually cold (no history), but **may have activated a Standalone Box** (gift/retail) — in which case the Prospect home reveals a *subset* of the Member experience (scan + XP/Streak counter), while Perk redemption stays locked until they subscribe. Reached via a captured `ref`, a Standalone Box scan, an abandoned checkout, **or a cold app/web registration** (someone who registers and lands on the buy-CTA before purchasing). "Browsing" happens **pre-registration** (App Store listing, landing page); the moment an account exists the person is a Prospect — *cold* if they carry no `ref` or Box. Becomes a **Member** on their first Subscription. The line vs a **Lapsed Member** is *"ever held an active Subscription?"* — a Prospect never has.
_Avoid_: Lead, guest, trial user

**Standalone Box**:
A gift or retail Box activated **without** a Subscription ([ADR-0007](./docs/adr/0007-standalone-gift-retail-box-activation.md)). Its holder (a **Prospect**) earns XP/Streak on it — the fraud floor holds because the Sachets were bought by someone — but cannot redeem **Perks** until they start a Subscription. Depletion prompts conversion to **Member**.
_Avoid_: Trial box, free box, sample

**Lapsed Member**:
A former Member whose Subscription is no longer active. **All history is retained** (XP, Level, Streak, consumption calendar, affiliate attribution); Level/XP are frozen (not reset) and Perk redemption is paused until the Subscription is reactivated. Distinct from a **Prospect** (a Prospect has no history). A Member becomes Lapsed via voluntary cancellation, or via a refill charge that fails and is not recovered during the dunning window. **Referred-discount treatment differs by cause:** an *involuntary* lapse resumes the same Subscription (discount + `ref` attribution intact on reactivation); a *voluntary* cancellation forfeits the referred discount — a later resubscribe is a new Subscription at full price unless a `ref` is re-entered ([ADR-0004](./docs/adr/0004-referral-economics.md)).
_Avoid_: Churned, expired, inactive, ex-member

**Streak**:
Consecutive **days** (calendar days in the Member's **account timezone** — not UTC, not the live device clock) on which a Member scans a Sachet. Drives habit and applies a small XP multiplier. Forgiven by a **single automatic weekly grace** — one missed day per rolling 7-day window *holds* the Streak; beyond that it breaks. **No freeze tokens** — the Streak is deliberately sensitive, and nothing (not Level, not activity) can bank protection against a longer gap. **One narrow exception:** if the Member has **zero supply while a Box is in transit**, the Streak is **frozen** for that window — the gap is FluoFit's fault, not theirs ([ADR-0011](./docs/adr/0011-refill-mode-decoupled-and-benefit-clock.md)). Carries no direct monetary value.
_Avoid_: Chain, run

**XP**:
Cumulative points earned per daily Sachet scan (times the Streak multiplier). Never decreases. Because a Member can only scan Sachets they have bought, XP is a proxy for lifetime consumption and therefore lifetime spend.
_Avoid_: Points, score

**Level**:
A milestone tier reached on cumulative XP. Never drops. Gates which Perks a Member can access. Frozen (not reset) while a Subscription is lapsed.
_Avoid_: Tier, rank (use "Level")

**Perk**:
A benefit unlocked by Level. Every Perk is funded from one of two purses: **partner-funded** (a Partner absorbs the cost as customer acquisition) or **spend-funded** (FluoFit absorbs a bounded COGS, covered by the spend the Level represents). Redeeming any Perk requires an active Subscription.
_Avoid_: Reward, benefit, bonus

**Agent**:
A Member who has crossed an eligibility Level, applied, and been approved to bring new Members to FluoFit for a **tiered recurring commission** (rate rises with the count of active referred Subscriptions). The **scalable, self-serve** referral channel — any qualifying Member can become one. Always sees the **commission plane** (own earnings); sees a referred client's **coaching plane** (consumption) only if that client opted in ([ADR-0003](./docs/adr/0003-affiliate-consent-boundary.md)). Distinct from an Affiliate (curated, fixed rate) and a Partner (no commission).
_Avoid_: Reseller, ambassador; do not call an Agent an "Affiliate" (different contract)

**Affiliate**:
A **hand-picked** referrer (trainer, influencer) added manually by FluoFit on a **negotiated fixed commission %** — outside the Agent tier ladder and the Level-eligibility gate. Curated channel. Like an Agent, sees the **commission plane** always and a client's **coaching plane** only with that client's consent ([ADR-0003](./docs/adr/0003-affiliate-consent-boundary.md)). Distinct from an Agent (tiered, self-serve) and a Partner.
_Avoid_: Referrer, reseller (pick "Affiliate" for the curated fixed-% case, "Agent" for the tiered self-serve case)

**Partner**:
A business (gym, gear shop, event) that funds Perks — offering FluoFit Members discounts as its own customer-acquisition spend. Does not earn commission. Distinct from an Affiliate. In v1 a Partner is a **fully admin-managed record** with no partner-facing platform.
_Avoid_: Sponsor, vendor

**Admin Console**:
FluoFit's internal web control plane (the surface the **Admin** operates) — QR/Box provisioning, intake waves, payouts, support + overrides, Partner onboarding, and gamification config. Distinct from **Admin** (the actor/role). Full spec: [`docs/product/admin-console.md`](./docs/product/admin-console.md).
_Avoid_: Dashboard (that's the Agent/Affiliate surface), back-office, CMS

## Flagged ambiguities

- **"Membership" vs "Subscription"**: Subscription = the commercial recurring-shipment agreement. Membership = the loyalty standing that unlocks partner perks. A lapsed Subscription pauses Membership perks. Keep them distinct.
- **Agent vs Affiliate vs Partner** (all "people who help FluoFit grow" — do not conflate): **Agent** = a Member who leveled up into the *mass, self-serve, tiered-commission* referral channel. **Affiliate** = a *hand-picked, fixed-%* referrer (trainer/influencer) on negotiated terms. **Partner** = a *business that funds Perks* and earns *no* commission. Agent & Affiliate earn commission; Partner does not. Full model: [`docs/product/agent-affiliate-program.md`](./docs/product/agent-affiliate-program.md).

## Open questions

- (resolved Q1–Q2) Billing = per Box at shipment; Refill trigger defined above; two-layer principle (Subscription guarantees supply, scanning unlocks ecosystem).
- Gamification economy: what do streak / XP / levels actually unlock, and how do they map to money? (Q3)
