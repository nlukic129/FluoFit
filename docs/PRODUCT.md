# FluoFit — Product Definition

Living product doc. Terminology lives in [`/CONTEXT.md`](../CONTEXT.md); hard-to-reverse decisions live in [`docs/adr/`](./adr/). This doc breaks down each feature.

> Status legend: ✅ decided · 🟡 partially decided · ⬜ open

---

## 0. Vision

One daily sachet with everything a recreational athlete needs, mixed with water. Around it: an app (streaks, reminders, community), a consumption-driven subscription, an affiliate program for trainers, and a partner loyalty program. **North star:** a community that co-creates future products — the app and levels are the vehicle for that, the product is the hero.

---

## 1. Subscription & Refill ✅

See [ADR-0001](./adr/0001-consumption-driven-subscription.md).

- Billed **per Box at shipment**, not on a calendar. Variable revenue accepted.
- **Refill trigger** = first of:
  - remaining supply ≤ 7 across all Boxes owned (single-Box shorthand: 21 Sachet scans; aggregate model in [ADR-0006](./adr/0006-aggregate-supply-and-fraud-floor.md)),
  - "running low" button,
  - time cap: 2 months from Box Activation (scanner) / from previous delivery (non-scanner).
- Time-cap auto-shipments get a **3-day advance notice + skip/pause**.
- **Two layers:** Subscription guarantees supply; scanning unlocks the ecosystem.

### App-optional — base first ✅ — see [ADR-0010](./adr/0010-app-optional-scheduled-subscription.md), refined by [ADR-0011](./adr/0011-refill-mode-decoupled-and-benefit-clock.md)

Some customers love the app; others are intrinsically motivated and don't want one. **The
base is primary: a plain, reliable Subscription that works fully without the app — the app is
an *additive layer*, never a gate for supply.** One product, one Subscription; the app only
turns on the ecosystem (scanning, XP, Perks, precise refill) for those who want it.

- **Two refill modes, chosen at checkout (web or app), independent of the app** ([ADR-0011](./adr/0011-refill-mode-decoupled-and-benefit-clock.md); terms in [CONTEXT.md](../CONTEXT.md)):
  - **Manual refill** (= Scheduled) — a **user-chosen cadence of 28–60 days** (28 = daily-
    consumer floor; 60 = lightest honest consumer / absolute cap). No scan needed, so it runs
    **with the app on or off**. A narrow, deliberate exception to [ADR-0001](./adr/0001-consumption-driven-subscription.md).
  - **Smart refill** (= Consumption-driven) — remaining ≤ 7 / "running low" / "Order now".
    **Requires scanning**, so app-only. **Auto-ships only on a real consumption signal (≤ 7) or
    manual "Order now" — never on a calendar.** Two substates: **Smart-pending** (chosen, not
    yet scanned — no signal, so **no auto-ship**; nudged to scan) → **Smart-active**.
- **Modes are decoupled** ([ADR-0011](./adr/0011-refill-mode-decoupled-and-benefit-clock.md) amends ADR-0010's v1 coupling): an app Member who scans
  for XP may still keep a Manual calendar. Only Smart+no-app is impossible (no signal). A
  Member can **switch** either way; switching **freezes + retains** XP/Level (nothing reset).
- **Delivery-aware scheduling:** "N days" = the **doorstep-to-doorstep** gap; the system ships
  early enough — carrier cutoff (before 13:00 → next day, after → +2; **no weekend
  deliveries**) — that the Box lands on the target day. **First Box ships immediately from the
  order**; the mode governs Box #2 onward. **Order tracking is shown in-app.**
- **Silence never force-ships.** A Smart Subscription that goes silent (never scanned, or
  stopped) gets **escalating moderate warnings** (~day 30/45/55/59, in-app + push + email),
  each offering **"Order now"** and **"Switch to Manual"** — supply stays **one tap away**, we
  never push a Box the Member did not ask for.
- **Benefit clock (anti-gaming):** **Perks + referred discount live ≤ 60 days from the last
  paid order; only a paid order resets it — scanning never does.** One Box = at most 60 days
  of live benefits. At day 60 with no order → **benefits lapse** (Lapsed Member: benefits off,
  XP/Level frozen + retained, Streak breaks); a **paid order revives** them (referred discount
  retained). This is a **third lapse trigger** and changes what ADR-0001's 60-day cap does
  (lapse, not force-ship). See **Lifecycle & lapse** below and [ADR-0005](./adr/0005-subscription-lifecycle-and-lapse.md).
- **App-less front door:** an **email account + web signup/checkout** is the canonical entry;
  social login (Google/Apple) is a shortcut for app users ([ARCHITECTURE §1](./ARCHITECTURE.md#1-authentication--identity-)).
- **App-less controls:** skip / delay / change cadence / pause via the **logged-in web account**
  or an **email/SMS magic-link web page** (no install, no login needed); the same 3-day advance
  notice precedes each auto-shipment.
- **Base Members earn no XP** (they don't scan) — the fraud floor is trivially satisfied.

### Lifecycle & lapse ✅ — see [ADR-0005](./adr/0005-subscription-lifecycle-and-lapse.md)

- **States:** **Prospect** (account, never subscribed) → **Member** (active Subscription) → **Lapsed Member** (was a Member, no active Subscription; history retained, Level frozen, Perks paused). Terms in [CONTEXT.md](../CONTEXT.md).
- **Lapse triggers (three):** voluntary cancellation; a **failed refill charge** not recovered during a **past-due (dunning)** window; or **Benefit-clock inactivity** — a Smart Subscription with **no paid order for 60 days** ([ADR-0011](./adr/0011-refill-mode-decoupled-and-benefit-clock.md)). A charge happens at *every* refill; one failed charge ≠ instant lapse. The referred discount is **retained** on the involuntary two (failed charge, inactivity) and forfeited only on explicit cancellation ([ADR-0004](./adr/0004-referral-economics.md)).
- **Earning after lapse:** a Lapsed Member still keeps **earning XP/Streak** on already-paid Sachets they physically hold; only **Perk redemption** is paused. (Earning follows paid product; redemption follows active Subscription.)
- ⬜ Dunning window length + retry cadence (tied to the parked payment provider).

### Subscription pause ✅

A **universal Member right** (not a Level Perk): voluntarily hold billing **and** shipments for a while, intending to return. Distinct from **cancellation** (which *ends* the Subscription) and from a **failed-charge lapse** (involuntary).

- **The Subscription stays alive but dormant** — un-pausing resumes the **same** Subscription, not a new one.
- **While paused:** Level/XP **retained + frozen** (as with a Lapsed Member); **Perk redemption + partner/sponsor codes are off**; the **Streak breaks** (the model is single-layer weekly grace with no freeze tokens — any real gap breaks it — see [§3](#streak-mechanics-)).
- **Referred discount is RETAINED.** Because pause is *not deliberately ending* the Subscription, it falls on the "keep the discount" side of the [ADR-0004](./adr/0004-referral-economics.md) cut (*"did the Member deliberately end it?"*) — same as an involuntary lapse, unlike a cancellation. Attribution + discount resume intact. (Otherwise pause would just be cancellation with extra steps.)
- **Streak on paused-but-still-holding-Sachets:** the Streak purely follows daily scanning + the weekly grace; a pause means you stop scanning, so it breaks naturally. No special force-break rule is needed. (This narrows [ADR-0005](./adr/0005-subscription-lifecycle-and-lapse.md) rule (A): *XP* earning on already-paid leftover Sachets still holds, but the *Streak* will lapse across a real pause.)

### Prospect home ✅ — conversion-first entry surface

What a logged-in **Prospect** sees before their first Subscription. A Prospect is reached via a captured affiliate `ref`, a Standalone Box scan, an abandoned checkout, or a **cold app/web registration** — "browsing" happens pre-registration (App Store listing, landing page), so the moment an account exists the person is a Prospect. The screen is **conversion-first**, not the full Member home (no Perk-redemption / Partner / loyalty layer).

- **One adaptive screen, not two.** A single Prospect home whose **hero-lever adapts to the entry path**, while the CTA (**"Start Subscription"**) and a shared "what you unlock" ecosystem teaser stay constant:

  | Entry path | Hero lever (loss-aversion > acquisition) |
  |---|---|
  | **Standalone Box** (warm) | Progress + depletion: "your N-day Streak & XP are live — your Box is running low, subscribe to keep the run" |
  | **Affiliate `ref`** (cold) | Referrer's discount + social proof: "[referrer] unlocked X% off — active as long as you don't cancel" (continuity, **not** "first order only" — [ADR-0004](./adr/0004-referral-economics.md)) |
  | **Abandoned checkout** (cold) | Friction removal: "pick up where you left off" → resume checkout |
  | **Cold app/web registrant** (cold) | Generic acquisition: "start with your first Box — here's what you unlock" → **Start Subscription** (no `ref`/Box-specific lever) |

- **Warm Prospect (Standalone Box holder)** additionally sees a *subset* of the Member experience via the [always-live scanner](#2-scan-model-):
  - **Live** (it genuinely accrues): scanner strip, Streak flame, XP counter.
  - **Next-unlock teaser only** (not the whole ladder): "40 XP to Level 2 — subscribe to claim its Perks."
  - **Perk cards visible but lock-overlaid** ("Subscribe to redeem") — sees the value, can't take it.
  - **Two-step depletion escalation** ([ADR-0007](./adr/0007-standalone-gift-retail-box-activation.md)): full Box → ambient banner; ≤ 7 Sachets → prominent on-open card.
- **Subscription offer is routed by behaviour, not pushed at the first scan** ([ADR-0011](./adr/0011-refill-mode-decoupled-and-benefit-clock.md)) — over-pressure risks uninstall, and there is nothing to game (Perks locked; XP ≤ Sachets bought):
  - **Proven daily streak (~3–4 days) → proactive Smart offer**, framed on their live progress ("your 4-day run is live — subscribe with Smart refill, never run out, claim your Perks").
  - **Every other pattern** (scanned once then stopped; irregular) **→ Manual offer at ~day 25** (estimated depletion; with no reliable scan signal the calendar is the only honest trigger), and the offer **also surfaces the Perks already earned** ("subscribe → refills every 28–60 days *and* unlock your Level-X Perks").
  - **Smart stays a manual choice** anyone can pick — it is simply not *pushed* without a proven daily habit.
- **No hard countdown timers / aggressive urgency** — depletion is natural urgency enough; over-pressure risks uninstall.
- **Numbers are slots, not values:** discount % waits on COGS → pricing; the layout reserves the slot.
- ⬜ Exact copy/visual treatment is a build-time detail (prototype territory), not decided here.

---

## 2. Scan model ✅

Two QR types drive the whole system:

| Event | QR | Uniqueness | Drives |
|---|---|---|---|
| **Box Activation** | on the Box | unique | ownership, fraud floor, refill clock, affiliate commission (a real sale), ecosystem unlock |
| **Sachet scan** | on the Sachet | shared (non-unique) | streak, XP, reminders — capped by Boxes owned |

> **"Box Activation" is two jobs, not one** ([ADR-0010](./adr/0010-app-optional-scheduled-subscription.md)):
> **commercial binding** (ownership + fraud floor + affiliate commission = "proof of a real
> sale") and **ecosystem unlock** (XP/Streak/Perks/precise refill). They coincide in one scan
> only for an app user. For a **paid direct subscriber (app or base)** the paid **order** is
> the proof, so ownership + commission bind at the **order** (`ref` captured at checkout) and
> the scan retains only the **ecosystem-unlock** job — not required for ownership/commission.
> A **gift/retail Standalone Box** has no paid order by its holder, so there the **scan stays
> the binding + proof event** ([ADR-0007](./adr/0007-standalone-gift-retail-box-activation.md), unchanged).

- Scanning a Sachet is honor-system; the **fraud floor** is that XP/streak can never exceed Sachets actually bought — computed **aggregate** across all Boxes (28 × Boxes owned), not per Box ([ADR-0006](./adr/0006-aggregate-supply-and-fraud-floor.md)).
- Only **one** Sachet scan per day earns XP/streak; extra scans are allowed but earn nothing.
- Must work **offline** (poor gym signal): queue scans locally, sync on reconnect.
- **Anti-theft (physical):** the Box's unique QR is hidden under a tamper seal — revealed only when the Box is torn open, defeating in-store/in-transit photographing.
- **Anti-duplication (software):** one-time activation — once a Box QR is bound to an account it can never bind to another. The account it binds to is the **first scanner**, who becomes the Box's **permanent ecosystem-owner** (XP/Streak/Level). The **Subscription stays with the orderer** regardless ([ADR-0012](./adr/0012-identity-checkout-and-box-ownership.md)); if the scanner isn't that subscriber (a gift) the Box is a **Standalone Box** for them ([ADR-0007](./adr/0007-standalone-gift-retail-box-activation.md)). **Accounts are not linked** — a same-person, two-email split (checkout email vs app social-login) is possible and accepted; guidance is one account per person.
- **Channel-agnostic:** because the QR is revealed only on opening, it need not be pre-bound to a Member — the same mechanism works for subscription now and future retail/gifting without redesign. A gift/retail Box activated by a non-subscriber is a **Standalone Box** (earn-not-redeem until they subscribe) — see [ADR-0007](./adr/0007-standalone-gift-retail-box-activation.md). **The gift/retail channel is not a v1 focus**; the model is fixed now so the QR design needs no later redesign.

### Scan surface — always-live scanner ✅

The daily scan is the core habit loop, so it must be **zero-friction**: open the app and scan, no "Scan" button to tap first.

- **Universal home pattern:** a **live camera strip pinned to the top of the home** for *anyone who can earn* — Member, Lapsed Member (while they hold Sachets), and the **warm Prospect** (Standalone Box holder). Same daily gesture for every state.
- **One scanner, auto-routed by QR type:** the strip decodes both QR types and routes itself — a **Sachet** QR → daily engagement scan; a **Box** QR → Activation. The user never picks a mode.
- **Cold Prospect (no Box):** the same strip reads as an **activation invite** ("scan your Box"), not an empty viewfinder — scanning a gift/retail Box QR here is exactly how a cold Prospect becomes a warm Standalone holder ([ADR-0007](./adr/0007-standalone-gift-retail-box-activation.md)).
- **Lifecycle:** camera is live **only while the home is focused and the app foregrounded** — leaving the tab releases it (battery + "always-watching" perception).
- **Permission fallback:** if camera permission is denied, the strip degrades to an "allow camera / scan" affordance — never a dead black square.
- **After the daily earning scan:** the strip shows a "✓ scanned today" state; further scans are still allowed but earn nothing (per the one-scan-per-day rule above).

### Activation edge cases ✅

- **Damaged / unreadable QR → manual fallback.** Under the same tamper seal, print a **human-readable code** (≈12 chars) alongside the QR. If the camera can't read it, the Member types the code → identical one-time activation and bind. Cheap; resolves most failures without support.
- **QR already bound to another account → message + path to support, no accusation.** Don't silently reject: "This Box is already activated on another account. If you think this is a mistake, contact support" + button. The attempt is **logged** as a fraud signal, but arbitration is **human** (support), never an automatic accusation — same principle as affiliate disputes ([§4](#4-affiliate--agent-referral-program-)).
- **Box never arrived.** Billing is per shipment, so a lost parcel means the Member was charged but has nothing to activate. Resolution is a **fulfillment/support case** (re-ship or refund — fulfillment is parked). The refill **clock starts at Activation, not shipment**, so an unactivated lost Box does not advance anything — which is correct.
- All three lean on a **"contact support" surface that does not yet exist** — tracked as a cross-cutting gap in [OPEN-FLOWS.md](./OPEN-FLOWS.md).

---

## 3. Gamification 🟡

Concepts (see CONTEXT.md): **Streak**, **XP**, **Level**, **Perk**. Funding rule in [ADR-0002](./adr/0002-two-purse-gamification-funding.md): every Perk is partner-funded or spend-funded; redemption requires an active Subscription; Level persists but freezes on lapse.

### Streak mechanics ✅

- **Day boundary:** a "day" is a calendar day in the Member's **account timezone** — not UTC (would break evening scanners in GMT+n), not the live device clock (would let "set the clock back" extend a day). Timezone is **fixed on the account** (set at onboarding, changeable in settings); it does not auto-follow travel. The fraud floor ([ADR-0006](./adr/0006-aggregate-supply-and-fraud-floor.md)) bounds the rest, so the boundary needn't be cryptographically hard — just fair to honest users and closed to the trivial clock trick.
- **Forgiveness — one layer only:** an **automatic weekly grace (everyone, no token):** one missed day per **rolling 7-day window** *holds* the Streak — the miss neither advances nor breaks it; it resumes on the next scan. A missed day earns **no XP** (nothing was scanned); grace only holds the counter/multiplier, so the "XP ≤ Sachets bought" invariant is untouched. **No freeze tokens exist** — beyond the one weekly miss the Streak breaks. Deliberately sensitive: a real gap (e.g. a paused Subscription) breaks it, and nothing can bank protection. (This is why a Subscription pause breaks the Streak — see [§1 pause](#1-subscription--refill-).)
  - **One narrow exception — "our-fault" freeze** ([ADR-0011](./adr/0011-refill-mode-decoupled-and-benefit-clock.md)): if the Member has **zero supply while a Box is in transit** (we know both — consumption from scans, delivery status from the carrier), the Streak is **frozen** for that window and resumes on the first scan after delivery. Not a banked token — we cannot penalise a gap *we* caused by not delivering product to scan.
- **The Member must always know their state** (ties into [§6 Reminders](#6-reminders--v1-heuristic-defined) governance):
  - **Grace used:** when a miss is absorbed, tell them — "you missed yesterday, but your N-day Streak is safe (weekly skip used)" — surfaced on next app open / next scan, respecting the one-habit-reminder-per-day and quiet-hours rules.
  - **Streak broken:** when forgiveness is exhausted and the Streak actually breaks, a **motivational re-engagement** message to start again from zero — not a silent reset.

### Level unlocks — PROPOSAL MENU (v1 wants all three purses; specific level names & assignments TBD)

**🟢 Zero cost to FluoFit (status & community):**
- Badges, titles, app theme, animated streak flame
- Beta access to new FluoFit products before public launch
- Private community space for higher Levels; founder AMAs

**Universal — NOT Level-gated (available to every Member, listed here so they aren't mistaken for Perks):**
- **Vote in product development** (next flavor / what gets made) — all votes equal, Level never weights them ([§7](#7-community--co-creation-)).
- **Pause Subscription** — a billing right, not a Perk (see [§1](#1-subscription--refill-)).

> **Removed from the model:** *leaderboards* (dropped entirely) and *streak freeze tokens* (no longer exist — the Streak is single-layer weekly-grace only, per [§3 forgiveness](#streak-mechanics-) / [CONTEXT](../CONTEXT.md)).

**🔵 Partner-funded (Level selects depth, Partner pays):**
- Tiered discounts at partner shops (higher Level = deeper tier)
- Early access to partner drops / sales
- Exclusive member-price bundles
- Entry / discount to events, races, gym day-passes

**🟠 Spend-funded (bounded FluoFit COGS, self-financing via lifetime spend):**
- Premium flavors unlocked by Level
- "Better Box" at high tier (stronger formula / extra Sachet / better packaging)
- Free-shipping tier
- Milestone reward Box (e.g. a free Box at Level X)
- Limited-edition seasonal flavors for top tier
- Merch at milestones (shaker, welcome kit)

**🔴 Avoid / hard-cap (violates ADR-0002):**
- % off your own Subscription per Level (erodes core revenue with engagement)
- Anything cumulative / compounding

### Open
- ⬜ Number of Levels, their names, XP thresholds, and which unlock maps to which Level.
- ⬜ Exact XP formula (per-scan base + streak multiplier).

---

## 4. Affiliate & Agent referral program ✅ (numbers pending pricing)

Full behavior lives in **[`product/agent-affiliate-program.md`](./product/agent-affiliate-program.md)**. This section is the index.

Two commissioned referral roles (a third, **Partner**, funds Perks instead — [§5](#5-loyalty--partners-)):

- **Agent** — the **mass, self-serve** channel: any Member who crosses a **fixed eligibility Level**, applies in a **capped intake wave** (Admin-curated, optionally city-targeted from the delivery address), and is approved. Earns a **tiered recurring commission** that rises with active referred Subscriptions.
- **Affiliate** — the **curated** channel: a hand-picked trainer/influencer added manually on a **fixed negotiated %**, outside the tier ladder and Level gate.
- **Referrer views** (both roles): the **commission plane** (own earnings) is always visible; a client's **coaching plane** (consumption) is visible only with that client's **consent** — consent, not role, is the gate ([ADR-0003](./adr/0003-affiliate-consent-boundary.md)). The referrer-facing surface is the [Agent/Affiliate web app](./product/agent-affiliate-app.md).

Cross-cutting invariants (detail + rationale in the program doc and ADRs):

- **Commission trigger** = the **sale event**; **recurring** while the referred Subscription is active (earn only when FluoFit earns). For a **paid direct subscriber** the sale is the **paid order** (they may never scan); for a **gift/retail Standalone Box** it is the Box Activation scan ([ADR-0010](./adr/0010-app-optional-scheduled-subscription.md) splits the two — the old "= Box Activation" was the app-scanner shorthand).
- **Economics** ([ADR-0004](./adr/0004-referral-economics.md)): buyer discount **fixed** regardless of tier; commission is the only scaling lever, so the acquisition budget **floats** and the top tier must fit under margin. **Buyer's discount is permanent and survives the referrer leaving.** All %s wait on COGS → price.
- **Single-level only, no MLM** ([ADR-0009](./adr/0009-single-level-referral-no-mlm.md)): a referrer earns only on Members they personally brought — never an override on other agents beneath them.
- **Payout via a paušalna marketing agency** ([ADR-0008](./adr/0008-agency-payout-intermediary.md)): one invoice-in to the agency, which pays both Agents and Affiliates — so an individual Agent needn't register. Lifecycle `Accrued → Cleared` (30-day hold + clawback) `→ Payable → Paid`, monthly with a min threshold.
- **Attribution:** first-touch `ref`, locked for the Subscription's life; retroactive only within the grace window (14d / 2nd Box). See [ARCHITECTURE §1](./ARCHITECTURE.md#1-authentication--identity-).
- **Fraud posture (mass scale):** structural/economic guards (Level-cost of entry, hard self-referral block, hold+clawback, first-payout activity gate); soft-flag detection consciously deferred.
- **Later:** milestone **bonus** progress bar (v2) and **Agent leaderboard** (v2+) — see program doc §9.

---

## 5. Loyalty & Partners 🟡 (mechanism is a proposal — real integration is per-partner)

Membership gating is settled (active Subscription = Perks live; Level selects the discount tier — see §3 / ADR-0002). What's left is how a **Partner** verifies a Member at redemption. **This depends heavily on how each Partner wants to cooperate**, so the app should support a *spectrum* rather than one fixed flow.

### Verification — PROPOSAL (partner-dependent)
- **Physical shop / gym:** a **rotating, time-limited member QR/code** in the app (≈30s, like 2FA). Partner scans it via a lightweight partner-facing web page → returns only "valid member, Level X, tier Y" (no personal data). Rotation defeats screenshot-sharing.
- **Online partner (webshop):** a **single-use discount code** per Member per redemption, tied to their account/Level. Used once → dead.
- **Low-tech partner:** simple member-lookup (enter a member number → yes/no + tier).
- **Partner never sees:** name, contact, history — only "valid + tier". Same privacy principle as the Affiliate boundary.

### Open
- ⬜ Which partner type(s) in v1 (likely local gyms/shops first).
- ⬜ Partner onboarding & agreement (who funds the discount, tier mapping, contract).
- ⬜ Exact discount-tier ↔ Level mapping.

---

## 6. Reminders 🟡 (v1 heuristic defined)

Biggest risk is over-notifying → uninstall, so **governance is the spine**, not the algorithm.

### Types (each independently toggleable)
1. **Daily nudge** (predictive) — at the learned time
2. **Missed day** (reactive) — if no scan by an evening cutoff
3. **Streak at risk** — late in the day if a Streak is active and unscanned
4. **Logistics** — running low / Box expiring in 3 days (transactional, from Subscription)
5. **Re-engagement** — after X days absent; gentle, decaying frequency
6. **Smart-silence warnings** (Smart Members only) — a Smart Subscription that goes silent
   (never scanned, or stopped) gets **escalating moderate warnings at ~day 30 / 45 / 55 / 59**,
   each offering **"Order now"**, **"Switch to Manual"**, and **"I've stopped"**. Ignoring keeps
   them coming; choosing **"I've stopped"** (with an optional reason for churn feedback)
   **suppresses the remaining warnings** — only the **day-60 closure notice** still fires
   ("Perks and discount paused until your next subscription"). At **day 60 with no paid order
   the benefits lapse** (Benefit clock — [ADR-0011](./adr/0011-refill-mode-decoupled-and-benefit-clock.md)); we **never force-ship**. Manual
   Members never get these — the calendar removes the risk. Infrequent; not part of the daily
   habit-reminder collapse.

### Governance (the key)
- **One smart habit reminder per day** — types 1–3 collapse into a single notification, never three.
- **Quiet hours.**
- **Auto back-off** — ignore 3 in a row → frequency self-reduces.
- Easy per-type toggle; respects OS permission.

### Pattern learning (heuristic, v1 — no onboarding question)
- Learn purely from scan timestamps; **never ask the user when they drink** (observed behavior beats stated).
- Model is **per-day-of-week** (7 buckets) — Saturday ≠ Tuesday.
- **Cold start / sparse buckets:** predicted time = shrinkage **blend** of the weekday-specific time and the global average, weighted by sample count. Few Saturdays → leans on the global average; more Saturdays → shifts to Saturday-specific. **Zero history → no predictive nudge, only the reactive "missed day"** until data accrues.
- **Confidence gate:** fire the predictive nudge only when the pattern is tight enough; scattered times fall back to the gentle reactive reminder.
- **Reminders fire locally** so they work offline (mechanism → [ARCHITECTURE](./ARCHITECTURE.md#stack)).
- **Privacy:** time-of-day is internal only (ADR-0003) — powers the Member's own reminders, never shared with an Affiliate.

---

## 7. Community / co-creation 🟡 (PROPOSAL — kept as direction, not a hard v1 commitment)

The north star: a community that co-creates future products. Deliver the co-creation *feeling* without building a social network.

- **Structured mechanisms in-app** (not a feed): idea/flavor board (submit + upvote), product votes (FluoFit posts a choice → members vote), beta cohorts (higher Levels test new products + give structured feedback), and **loop-closing** ("made because you voted" + notify voters — the emotional payoff that turns a customer into a co-owner).
- **Free-form chat lives off-app** (Discord/Telegram, linked from the app). No in-app feed in v1 → minimal moderation.
- **Governance: advisory**, not binding — the community signals, FluoFit decides (supply chain / cost may not allow honoring a raw vote). Framed as "your vote strongly shaped this," not an obligation.
- **All votes equal** — Level does not weight votes.

---

## 8. Admin Console ✅ (parked-domain modules deferred)

FluoFit's internal control plane. Full behavior lives in **[`product/admin-console.md`](./product/admin-console.md)**; this is the index.

- **Scope (v1):** operates only what's live — Agent/Affiliate ops, payouts, fraud review, **QR/Box provisioning**, gamification config, member support, and **Partner onboarding**. Parked domains (payment, fulfilment, notifications, data-rights) stay out until unparked.
- **One Admin profile** in v1 (founder-controlled), RBAC-ready for later. **Audit log is an invariant** — every mutating action records who/when/what/why (reason mandatory on sensitive ones), because human dispute-arbitration must be accountable.
- **QR generator / Box provisioning:** batch-generate opaque Box codes → **Manufactured/Unbound → Activated** lifecycle; named Batches; QR + human-readable fallback per label; void + status tracking; export-to-print. Sachet QR is a single non-unique code, managed separately.
- **Intake waves:** create (soft cap + optional city-focus) → curate on Level/city/tenure/engagement → approve → close. Cap is a soft guideline; non-selected auto-waitlist.
- **Payout:** generate the monthly per-recipient statement → the agency ([ADR-0008](./adr/0008-agency-payout-intermediary.md)); the **agency holds bank/tax details**, FluoFit's statement is identity + amount; commissions become `Paid` only **on agency confirmation**.
- **Support surface + override toolkit:** simple in-app contact → Console queue; bounded, audited overrides (manual activation, unbind/rebind, XP/streak correction, release held commission, fix attribution). **XP correction cannot silently break the fraud floor.**
- **Partner onboarding:** fully admin-managed records; **no partner platform**; verification/redemption mechanism decided with the first Partner.
- **Gamification config:** runtime dials (waves, Perk↔Level, partner perks) vs sensitive ones (Level/XP thresholds, eligibility Level) guarded so a change **never demotes** existing holders. XP formula is config-only (no live UI) in v1.

---

# App / System (technical)

> The technical layer (stack, auth, RLS, offline sync, data model) now lives in
> **[`ARCHITECTURE.md`](./ARCHITECTURE.md)** — this doc stays product/UX only.
> Product, regulatory, and business topics are **parked** (below).

---

# Parked (considered, deliberately deferred)

Not dropped silently — recorded so the reasoning isn't re-litigated on return.

- **Member-to-member referral ("give a friend a sachet / invite")** — out of scope for now. If revisited: reward the **conversion** (friend signs up + activates first Box), not the act (unverifiable); tie via the referrer's member code (Sachet QR is non-unique, untraceable); and **keep XP pure** — reward with a separate acquisition-budgeted currency (free Box / credit), never raw XP, or it breaks the "XP ≤ Sachets bought" invariant that makes spend-funded Perks self-financing.
- **Fitness / health integrations (Apple Health, Google Health/Fit, Strava, Fitpass, …)** — **next-phase, after the core product is rounded out** (deliberate sequencing: finish the product, then integrations). Idea: let Members earn engagement rewards for *training activity*, not only for drinking sachets — a second, broader habit signal that widens the funnel and deepens daily app value.
  - ⚠️ **Design tension to resolve before building:** rewarding external activity with **raw XP breaks the fraud-floor invariant** ("XP ≤ Sachets bought" — [ADR-0006](./adr/0006-aggregate-supply-and-fraud-floor.md)) that keeps spend-funded Perks self-financing. Same rule as member-to-member above: external signals must feed a **separate track/currency** (e.g. a parallel "activity" reward, streak-assist, or partner-funded perk), **never** the consumption-backed XP that gates spend-funded Perks. How the two tracks relate is the real question, not the OAuth plumbing.
  - Per-provider scope, data-privacy (health data → consent, à la [ADR-0003](./adr/0003-affiliate-consent-boundary.md)), and which integrations first are all for the next discovery pass.
- **Product / regulatory / business layer** — parked at the user's request to focus on app + system. Includes: supplement regulation & health claims, legal entity / jurisdiction (Dubai vs Serbia), payment provider + off-session charging, fulfillment & inventory, GTM / first-member acquisition, refund/returns policy, account deletion / data rights, cross-border affiliate payout/tax. *(Subscription **pause** is now defined — see [§1](#subscription-pause-); the billing plumbing behind it still waits on the parked payment provider.)*
