# FluoFit — Open flows & known gaps

A living registry of **flow-level holes** found by walking each flow end-to-end — things
that were never raised as a question but are needed for a complete platform. This is the
"we know it exists and it needs a conversation" list, so nothing falls through.

> Owns: *the fact that a gap exists* and its status. The **resolution** of any gap lives
> in its owning doc (PRODUCT / ARCHITECTURE / ADR) and is linked from here.

Status: ✅ resolved this pass · 🟡 partially resolved · ⬜ needs discussion · 🅿️ parked (deliberate)

## Resolved (this pass)

| Gap | Where it now lives |
|---|---|
| ✅ Entry state between "account" and "Member" (Prospect); Lapsed Member keeps history | [CONTEXT](../CONTEXT.md), [ADR-0005](./adr/0005-subscription-lifecycle-and-lapse.md) |
| ✅ What actually triggers a lapse (cancel / failed-charge + dunning), earning after lapse | [ADR-0005](./adr/0005-subscription-lifecycle-and-lapse.md), [PRODUCT §1](./PRODUCT.md#1-subscription--refill-) |
| ✅ Multiple active Boxes: aggregate supply pool, fraud floor, refill on remaining ≤ 7 | [ADR-0006](./adr/0006-aggregate-supply-and-fraud-floor.md) |
| ✅ Referral roles reworked: Agent (mass, tiered, Level-gated waves) + Affiliate (curated, fixed %); agency payout rail; single-level no-MLM | [PRODUCT §4](./PRODUCT.md#4-affiliate--agent-referral-program-), [program doc](./product/agent-affiliate-program.md), [ADR-0008](./adr/0008-agency-payout-intermediary.md), [ADR-0009](./adr/0009-single-level-referral-no-mlm.md) |
| ✅ Streak day-boundary (account timezone) + two-layer forgiveness + state notifications | [CONTEXT](../CONTEXT.md), [PRODUCT §3](./PRODUCT.md#3-gamification-) |
| ✅ Box Activation edge cases (manual fallback code, already-bound, lost parcel) | [PRODUCT §2](./PRODUCT.md#2-scan-model-) |
| ✅ Device change / multi-device (server canonical, local queue, per-(Member,date) dedup) | [ARCHITECTURE §2](./ARCHITECTURE.md#2-offline-session--scanning-) |
| 🟡 Fraud-response: v1 hard block; soft-flag/review deferred | [ADR-0004](./adr/0004-referral-economics.md) |
| 🟡 Gift/retail activation model (Standalone Box); channel itself post-v1 | [ADR-0007](./adr/0007-standalone-gift-retail-box-activation.md) |
| ✅ XP/Level retained on cancellation (win-back lever); erasure only via account deletion/dormancy | [ADR-0005](./adr/0005-subscription-lifecycle-and-lapse.md) |
| ✅ App-optional: base = Scheduled refill (no app); app-less web/email signup+checkout; commission binds on paid order not scan; scan-gap safety net | [ADR-0010](./adr/0010-app-optional-scheduled-subscription.md), [PRODUCT §1](./PRODUCT.md#app-optional--base-first-) |

## Needs discussion (raised, not yet resolved)

- ✅ **Contact-support surface** — resolved: a simple in-app "Contact support" creates a lightweight ticket → **Support queue in the Admin Console**, where a bounded, audited override toolkit resolves activation disputes, unbind/rebind, XP/streak corrections, held-commission release, and attribution fixes. See [Admin Console §6](./product/admin-console.md).
- ✅ **Admin control plane** — QR/Box provisioning, intake waves, payouts→agency, partner onboarding, gamification config, single audited Admin profile. See [Admin Console](./product/admin-console.md).
- 🅿️ **Partner verification + member-side redemption mechanism** — deferred until the first real Partner shapes it (QR vs code vs other); redemption is manual/concierge until then. [Admin Console §7](./product/admin-console.md).
- ⬜ **Transactional notifications** — order confirmation, shipping confirmation, tracking. `expo-notifications` is local/habit only; nothing tells a Member their Box shipped. How does a Member learn a refill is on the way (beyond the 3-day time-cap notice)?
- ✅ **Device change / multi-device** — resolved: server = canonical XP/Streak/Level; local = raw scan queue + optimistic view; new device pulls from server; two devices harmless (per-(Member,date) derivation + idempotency key); un-flushed queue on a dead phone is an accepted rare loss with a gentle connect-nudge. See [ARCHITECTURE §2](./ARCHITECTURE.md#2-offline-session--scanning-).
- 🟡 **Fraud-response action (not detection)** — **v1 resolved:** self-dealing guard = **hard block only** (can't enter your own `ref` code on your own account) — [ADR-0004](./adr/0004-referral-economics.md). **Deferred to when the program scales:** the soft-flag layer (shared payment/address/device → commission goes `Held` → Admin human review → repeat-pattern = Affiliate suspension; Member never punished, only the Affiliate). Design already sketched — just not built at v1 scale.
- 🟡 **Referrer visibility of clients + consent model** — **structurally resolved (Route A — Consent), and broadened:** the coaching plane (client consumption) is available to **any referrer** (Agent or Affiliate) whose client opted in — consent, not role, is the gate. **Binary:** no consent → pseudonymous commission rows (no identity); consent → full coaching set (identity + day-level consumption). Revoking gates *data* only, never *commission/attribution*. Render + surface: [Agent/Affiliate web app §2](./product/agent-affiliate-app.md); boundary: [ADR-0003](./adr/0003-affiliate-consent-boundary.md).
    - **Hard constraint:** consent is separate, non-pre-ticked, revocable; **never** bundled into privacy-policy acceptance (GDPR Art 7 → bundling invalidates it). The author explored an "automatic via privacy policy" route and dropped it as legally unsound.
    - ⬜ **Still open — legal confirmation:** a lawyer must confirm the consent mechanism and whether supplement-consumption counts as **health data** (special category). A drafted question exists (two data tiers: identity+status vs consumption). Route B ("coaching is intrinsic to a coached subscription", no toggle) remains a fallback if counsel prefers it.
- ✅ **Referrer offboarding** — resolved for both Agent & Affiliate: leaving → `ref` stops binding, open commissions run out their lifecycle, dashboard goes **read-only**; buyer keeps their discount permanently; an Agent who lapses their *own* Subscription has status + commissions **paused** until reactivation. See [program doc §5](./product/agent-affiliate-program.md).
- 🟡 **Agent tier structure** — marginal-band vs whole-book **deliberately deferred, both on the table**; decide alongside pricing. [program doc §2](./product/agent-affiliate-program.md).
- 🅿️ **Agent bonus / leaderboard** — v2 (milestone bonus on cumulative activation volume) and v2+ (period-ranked leaderboard); structure captured, numbers + build deferred. [program doc §9](./product/agent-affiliate-program.md).
- 🟡 **Soft-flag fraud detection** — still deferred, but now *consciously at mass scale*; v1 leans on Level-cost-of-entry + hard block + hold/clawback + first-payout activity gate. [program doc §6](./product/agent-affiliate-program.md).
- ⬜ **All referral numbers** (discount %, tier %s + thresholds, budget, bonus) — blocked on COGS → price; a dedicated financial-modeling pass fills the agreed structure later.
- ✅ **XP/Level on cancellation vs lapse** — resolved: cancellation never erases XP/Level (retained while the account exists — a win-back lever); erasure is tied only to account deletion (on request) or a defined dormancy period, both parked. Financial records kept separately per accounting law. See [ADR-0005](./adr/0005-subscription-lifecycle-and-lapse.md).
- 🟡 **Gifting / retail activation flow** — **model resolved:** scan = universal entry, branches by who scans; a gift/retail Box is a **Standalone Box** (Prospect earns but can't redeem until they subscribe; depletion prompts conversion) — [ADR-0007](./adr/0007-standalone-gift-retail-box-activation.md). **Still gated:** the channel isn't a v1 focus and the conversion step needs the parked payment work.
- ✅ **Prospect / logged-in-not-subscribed home screen** — resolved: one adaptive **conversion-first** screen reached only via captured `ref` / Standalone Box scan / abandoned checkout; hero-lever adapts to entry path (loss-aversion > acquisition), warm Prospects see a locked *subset* (live scanner + XP/Streak, teaser next-unlock, lock-overlaid Perks, two-step depletion escalation). Also sharpened the referred-discount rule (survives referrer leaving + involuntary lapse, forfeited on voluntary cancel) and added the **always-live scanner** as a universal home pattern. See [PRODUCT §1 Prospect home](./PRODUCT.md#prospect-home--conversion-first-entry-surface), [scanner §2](./PRODUCT.md#2-scan-model-), [ADR-0004](./adr/0004-referral-economics.md).
- ⬜ **Dunning window length + retry cadence** — depends on payment provider (parked), but the parameter is owned by [ADR-0005](./adr/0005-subscription-lifecycle-and-lapse.md).

## Parked (deliberate — see [PRODUCT "Parked"](./PRODUCT.md#parked-considered-deliberately-deferred))

Payment / off-session charging, fulfillment & inventory, refund/returns policy, account
deletion / data rights, cross-border affiliate payout/tax, supplement regulation & health
claims, legal entity/jurisdiction, GTM / first-member acquisition, member-to-member referral,
**fitness/health integrations (Apple/Google Health, Strava, Fitpass — earn rewards for training,
not only for sachets; next-phase; must keep raw XP pure — separate track, see [PRODUCT "Parked"](./PRODUCT.md#parked-considered-deliberately-deferred))**.
Several "needs discussion" items above can only be *fully* closed once the relevant parked
topic is unparked (e.g. transactional notifications need fulfillment; the Prospect entry flow
needs payment) — they are listed as open because their **non-parked structural parts** can be
decided now.
