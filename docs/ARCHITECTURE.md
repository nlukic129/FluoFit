# FluoFit — Architecture (technical "how")

The technical companion to [`PRODUCT.md`](./PRODUCT.md) (the "what") and
[`../CONTEXT.md`](../CONTEXT.md) (the language). Product/UX behavior lives in
PRODUCT; hard-to-reverse decisions live in [`adr/`](./adr/). This doc holds the
stack, data model, and system-level mechanics only.

> Product, regulatory, and business topics are deliberately **parked** — see the
> "Parked" section in [`PRODUCT.md`](./PRODUCT.md#parked-considered-deliberately-deferred).

---

## Stack

- **Mobile + app-less Member web:** **one** Expo Router app, three targets (iOS/Android/web) —
  `expo-notifications` (local, offline-capable), `expo-secure-store` (session tokens). The
  passwordless checkout + subscription-management web flows are the **web target of the same
  app**, not a separate codebase ([ADR-0014](./adr/0014-stack-monorepo-and-ports.md)).
- **Agent/Affiliate + Admin Console:** separate Expo-Router **web** apps in the monorepo (one UI
  stack for v1; Next.js is the documented escape hatch if data-dense dashboards outgrow RN Web).
- **Backend:** Supabase — Postgres, Auth (single project), Row-Level Security, Edge Functions
  (Deno), **pg_cron** (benefit clock / refill / commission clearing / dunning), Realtime, Storage.
- **Monorepo:** pnpm workspaces + Turborepo; invariants live in `packages/db` (DB constraints +
  RLS) and `packages/core` (domain + ports), never in a screen. Layout + rationale →
  [ADR-0014](./adr/0014-stack-monorepo-and-ports.md).

---

## Data model & RLS ✅ (design drafted)

The full Postgres schema + RLS policies live in their own doc:
**[`architecture/data-model.md`](./architecture/data-model.md)** — the scan ledger → derived
`member_progress`, the fraud-floor trigger, subscription/orders/shipments, referral +
commission + consent tables, versioned config, and the `outbox` adapter seam. `ARCHITECTURE.md`
is the index for that domain.

---

## System engines & ports ✅

Where the invariants execute (all server-side, in Edge Functions + `pg_cron`):

| Engine | Runs in | Enforces |
|---|---|---|
| **scan-sync** | Edge Function | idempotency dedup; XP from `scan_date_local`; timestamp clamp; recompute `member_progress` |
| **fraud floor** | DB trigger | earning scans ≤ 28 × activated Boxes ([ADR-0006](./adr/0006-aggregate-supply-and-fraud-floor.md)) |
| **refill-engine** | Edge Function + cron | Smart (signal ≤7 / "Order now", never calendar) vs Manual (28–60d, doorstep-aware) ([ADR-0011](./adr/0011-refill-mode-decoupled-and-benefit-clock.md)) |
| **benefit-clock** | cron | ≤60d from last **paid order**; lapse (never force-ship) |
| **commission-engine** | Edge Function + cron | `Accrued→Cleared(30d)→Payable→Paid`; clawback; first-payout gate |
| **config-apply** | Edge Function | per-dial grandfathering ([ADR-0013](./adr/0013-dynamic-config-grandfathering-and-manual-margin.md)) |

**Ports / adapters** ([ADR-0014](./adr/0014-stack-monorepo-and-ports.md)): parked/third-party
domains are TypeScript interfaces in `packages/core` — `PaymentPort`, `FulfillmentPort`,
`PayoutPort`, `NotifyPort`, and **`PlacesPort`** (Google Places address/city autocomplete at
checkout — [ADR-0016](./adr/0016-delivery-address-and-places.md); city drives admin filtering +
intake targeting). v1 ships **stubs that simulate the real async state machines** (via the `outbox`
table + an `adapter-webhook-sim` Edge Function), so benefit clock / refill / Streak-freeze
behave as in production. Unparking a domain is a **port swap**, not a rewrite.

---

## 1. Authentication & identity ✅

- **One Supabase Auth project**, single identity source. A profile row keys to `auth.users.id`.
- **`roles text[]`** (array, not a single `role`) from day 1 — cheap future-proofing so a
  trainer-who's-also-a-Member needs no schema migration later. **v1 practice: one role per
  account; cross-surface account linking is deferred.**
- **Actor types in scope:** Member, Agent, Affiliate, Admin. An **Agent is a Member** who was approved into the referral program — same account, `roles` gains the agent surface; no separate identity. A **Partner** is back in scope but as a **fully admin-managed record with no login surface** (v1) — not an auth actor. See [Admin Console](./product/admin-console.md).
- **Admin Console** ([spec](./product/admin-console.md)): single Admin profile in v1 (RBAC-ready); **every mutating admin action is audit-logged** (who/when/what/why). Also owns **Box provisioning** — batch-generated Box records move `Manufactured/Unbound → Activated`; codes are opaque high-entropy tokens.
- **Auth methods per surface:**
  | Actor | Method | Self-signup? |
  |---|---|---|
  | **Member** (web) | **Email + pay, passwordless** — the account is **auto-provisioned from the checkout email** (no upfront registration/password wall; password or magic-link set later, only to manage). The **canonical** app-less entry ([ADR-0010](./adr/0010-app-optional-scheduled-subscription.md), [ADR-0012](./adr/0012-identity-checkout-and-box-ownership.md)); a base Member never installs the app | **Yes** — the purchase creates the account |
  | **Member** (mobile) | Google + Apple (Apple required by App Store when Google is offered on iOS) — a **shortcut for app users**, not the only path; binds the same `auth.users.id` **when the email matches**. If the app login is a *different* email, the **first in-app scan transfers the whole Subscription onto it** (consolidation, not linking — [ADR-0012](./adr/0012-identity-checkout-and-box-ownership.md)), so there is **no split** | **Yes** — social login may create the account |
  | **Agent** (web portal) | logs in with their **existing Member** email once approved in an intake wave; gets `ref` code | **No** — approval-gated, not self-serve signup |
  | **Affiliate** (web) | Email OTP (6-digit code) | **No** — `shouldCreateUser: false`; OTP only reaches a pre-approved email. **Invite-only:** an Admin adds the trainer/influencer's email manually. Payout runs through the agency ([ADR-0008](./adr/0008-agency-payout-intermediary.md)), so no per-person entity gate. See [PRODUCT §4](./PRODUCT.md#4-affiliate--agent-referral-program-). |
  | **Admin** (web) | Email OTP | No — provisioned |
- **RLS keys off (role + relationship).** The privacy model ([ADR-0003](./adr/0003-affiliate-consent-boundary.md);
  a **referrer** — Agent or Affiliate — sees a client's coaching data only with that client's
  consent, and only their own clients; no cross-referrer leakage) is enforced here.
- **Signup ↔ referral binding:** a referrer shares a link `…/join?ref=CODE`; app (or **web
  checkout**) captures & persists `ref` **before** the OAuth round-trip / order; post-login
  onboarding shows the referrer + the (separate, non-pre-ticked) coaching-consent checkbox
  (ADR-0003); attribution binds first-touch, retroactive allowed only within the grace window
  (14d / 2nd Box). **Deferred deep linking (code survives install) = v2**; v1 fallback is
  manual code entry within the grace window.
- **Commission/ownership bind on the paid order, not the scan** ([ADR-0010](./adr/0010-app-optional-scheduled-subscription.md)):
  for a **paid direct subscriber (app or base)** the order is the "proof of a real sale", so
  ownership + affiliate commission bind at the **paid Box order** — the Box Activation scan is
  only an ecosystem-unlock and is **not required** for a base Member to be owned or to pay out
  their referrer. A **gift/retail Standalone Box** keeps the scan as its binding event
  ([ADR-0007](./adr/0007-standalone-gift-retail-box-activation.md)).
- **Subscription claim on first scan** ([ADR-0012](./adr/0012-identity-checkout-and-box-ownership.md)):
  at checkout the Subscription lives on the checkout email's account; the **first scan of one of
  its Boxes transfers the *whole* Subscription** (billing, refills, notifications, XP/Streak/Level,
  `ref`) onto the scanning account, permanently — a **transfer, not a link**, so a buyer who
  checks out as email A and scans in-app as email B **consolidates onto one account (no split)**.
  A scanned Box is **locked** (one-time activation); a **retail Box** has no Subscription to
  transfer, so its scanner gets a **Standalone Box** ([ADR-0007](./adr/0007-standalone-gift-retail-box-activation.md)).
  Trade-off: whoever first scans a delivered Box takes over its Subscription — guarded by the
  tamper-sealed QR + shipping address + support override, accepted for simplicity.

---

## 2. Offline session & scanning ✅

Powers the [Scan model](./PRODUCT.md#2-scan-model-) (product side). Must work in poor gym signal.

- Session tokens in **`expo-secure-store`**. **Cached session is authoritative offline** — if
  the access token is expired with no network, local actions (queued scans) still work; token
  refreshes on reconnect.
- **Unlimited offline scanning** — no "must connect every X days" requirement; everything syncs
  on eventual reconnect.
- **Local scan queue with a client-generated idempotency key** → deduped on sync (offline
  retries must not double-count XP/activations).
- **Streak/XP computed from the (validated) scan date, not the sync date** — scanning offline
  for weeks loses nothing on reconnect.
- **Anti-abuse:** server **validates/clamps** scan timestamps on sync (reject future;
  suspicious backdating clamped to receipt time). Damage is bounded anyway by the
  **aggregate supply invariant** (XP/streak ≤ total Sachets bought — 28 × Boxes owned;
  the fraud floor — [ADR-0006](./adr/0006-aggregate-supply-and-fraud-floor.md)).

### Source of truth & multi-device ✅

Offline-first, write-through: **always write locally first** (instant, works with no
signal); **when online, flush the local queue to the server at that moment.** But local and
server play different roles — they are not two competing copies:

- **Local = raw scan events (the queue) + an optimistic derived view.** The device shows
  "streak +1 / XP up" immediately for feedback, computed locally.
- **Server = the canonical XP / Streak / Level**, derived from the scan-event ledger. On
  each sync the device reconciles its optimistic view against the server's authoritative
  numbers. There is never a second *authoritative* copy of the totals on the device — only
  a raw queue and a display estimate — so the two can't disagree on "what Level am I".
- **New device / re-install:** log in → pull canonical state from the server. Nothing lives
  only on the old phone except an un-flushed queue.
- **Two devices at once:** harmless. Daily XP/Streak is derived per unique **(Member, date)**,
  not per row (only one scan/day earns anyway — [PRODUCT §2](./PRODUCT.md#2-scan-model-)), and
  the client idempotency key dedups on sync.
- **Un-flushed queue on a dead/wiped phone:** those un-synced scans are lost — an accepted
  rare loss. The fraud floor prevents "recovering" them without bought Sachets, and true
  cross-device offline-queue sync is disproportionate for v1. A **gentle "connect to save
  your progress" nudge** mitigates it (not a hard must-connect requirement).
- **Local footprint stays tiny:** keep only the *un-synced* queue + a small recent view;
  **prune each scan event from the local queue once the server acknowledges it** (the server
  is the durable copy). Full history is fetched from the server on demand (e.g. opening the
  calendar), never hoarded locally. A raw scan event is ~tens of bytes, so even years of
  daily scans can't bloat the device — the risk only appears if the *whole* derived history
  is cached locally, which this design avoids.

---

## Open technical questions

- ✅ Data model / schema — **drafted** in [`architecture/data-model.md`](./architecture/data-model.md)
  (Box, scan ledger, Subscription/orders, XP derivation, commission lifecycle, config, RLS).
  Remaining: turn the draft into `packages/db` migrations (Phase 0).
- ⬜ Cross-border payout/tax mechanics if FluoFit (Dubai) pays Affiliates (Serbia) — see
  [PRODUCT §4 — Affiliate](./PRODUCT.md).
