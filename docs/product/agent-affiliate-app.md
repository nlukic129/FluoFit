# Agent & Affiliate Web App

The referrer-facing surface — one role-adaptive web app for both **Agents** and
**Affiliates**. The program's rules/economics live in
[`agent-affiliate-program.md`](./agent-affiliate-program.md); this doc is the **UX surface**
that renders them. Terms in [`/CONTEXT.md`](../../CONTEXT.md); consent boundary in
[ADR-0003](../adr/0003-affiliate-consent-boundary.md).

> Status legend: ✅ decided · 🟡 partially decided · ⬜ open · 🅿️ parked

---

## 1. One role-adaptive app ✅

A single web app, same login, render adapts by `roles`:

- **Agent:** shows a **tier progress** bar (rate rises with active referred subs).
- **Affiliate:** shows their **fixed negotiated %** (no tier ladder).
- **Coaching tab:** appears for any referrer who has **consented clients** (see §2).

Two separate apps would duplicate ~90% (earnings, referral link, payout status, client
list) for no benefit.

---

## 2. What the referrer sees — the privacy model ✅

Extends [ADR-0003](../adr/0003-affiliate-consent-boundary.md). A referred Member is an
identified person; the referrer is a third party. So identity/consumption is **consent-gated**,
while the referrer's own money is always visible in aggregate.

**Binary, by the client's consent:**

| State | What the referrer sees |
|---|---|
| **No consent** (default) | **Pseudonymous** commission rows only — join date, status (active/lapsed), boxes activated, earnings. **No name, no consumption.** |
| **Consent given** | The **full coaching plane** — name, active/lapsed status, **day-level consumption** calendar, adherence %, streak, sachets remaining. **Never time-of-day.** |

- **Applies to any referrer** — Agent or Affiliate alike. Consent, not role, is the gate.
  (This broadens ADR-0003, which originally framed coaching as a trainer feature.)
- **One consent** shown at signup when a referral code is present: *"Let [Referrer Name] see
  your progress and support you."* Separate, non-pre-ticked, **never** bundled into the
  privacy policy (bundling invalidates it — GDPR Art 7). Revocable anytime; withdrawal must be
  as easy as giving.
- **Consent never touches commission or attribution** — a client can go dark and the referrer
  keeps earning.
- **The nudge use-case:** consent lets the referrer see *who* lapsed / is running low, so they
  can personally re-engage them (via their own channels — WhatsApp, in person). Non-consented
  lapsed members are still re-engaged by FluoFit's own [re-engagement reminders](./../PRODUCT.md#6-reminders--v1-heuristic-defined).
- **Self-balancing:** people a referrer actually knows (friends/gym clients) tend to consent;
  cold strangers don't — and those are people the referrer wouldn't personally nudge anyway.
- ⬜ **Legal basis pending** — a lawyer must confirm the consent mechanism and whether
  supplement-consumption counts as health data (special category). The design commits to
  consent-gating regardless of the answer.

---

## 3. Commission dashboard (home) ✅

- **Header:** current **tier** (Agent) / **fixed %** (Affiliate) + count of active referred subs.
- **Tier progress bar** (Agent only): active subs, distance to the next rate. *Exact display
  depends on the deferred marginal-vs-whole-book tier model.*
- **Earnings:** this month + lifetime, broken by state — `Accrued / Cleared / Payable / Paid`.
- **Referral rows:** pseudonymous by default; name shown for consented clients; **lapsed rows
  flagged** for nudging.
- **Next payout:** date + amount (above the minimum threshold).
- **Referral link + QR** — prominent; it's the core action.

---

## 4. Referral sharing tools ✅

- A shareable **link** (`…/join?ref=CODE`), a downloadable/shareable **QR image**, and a
  **copy-link** action.
- 🅿️ Pre-made marketing assets (banners, captions) — v2.

---

## 5. Coaching plane render ✅

For any referrer with consented clients (§2):

- **Client list** (consented clients only) → tap → **detail:** day-level consumption calendar,
  adherence %, streak, sachets remaining. Never time-of-day ([ADR-0003](../adr/0003-affiliate-consent-boundary.md)).
- **Consent revoked → the client drops out of the coaching view** but remains in the
  commission counts; commission and attribution are untouched.

---

## 6. Notifications (v1) ✅

Email + in-portal, for three key events only, under the same anti-over-notification discipline
as the member app:

- a **new conversion** (someone activated their first Box via your code),
- a **tier change** (Agent moved up/down),
- a **payout confirmed** (the agency has sent it).

🅿️ An in-app "send nudge" button and richer alerts — v2.

---

## 7. First login & onboarding ✅

- Magic-link / **Email OTP**, as with the other web actors ([ARCHITECTURE §1](../ARCHITECTURE.md#1-authentication--identity-)).
- The referrer **accepts the program terms** and sets a minimal profile.
- **No bank/tax details collected in the portal** — payout is handled by the agency
  out-of-band ([ADR-0008](../adr/0008-agency-payout-intermediary.md), payout Option 2). The
  portal shows earnings and payout **status** only; the agency onboards the referrer's payout
  details separately.
- For an **Affiliate**, the Admin has already set the negotiated %; they simply log in.

---

## Open / deferred

- ⬜ Legal basis for the consent model (§2) — pending lawyer confirmation.
- 🅿️ Marketing assets, in-app "send nudge", richer notifications — v2.
- 🟡 Tier progress display — depends on the deferred marginal-vs-whole-book decision.
- ⬜ Payout UX clarity — in Option 2 the portal is silent on the payout mechanism; if it
  drives support tickets ("how do I get paid?"), revisit a light agency hand-off.
