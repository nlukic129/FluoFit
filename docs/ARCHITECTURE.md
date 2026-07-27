# FluoFit — Architecture (technical "how")

The technical companion to [`PRODUCT.md`](./PRODUCT.md) (the "what") and
[`../CONTEXT.md`](../CONTEXT.md) (the language). Product/UX behavior lives in
PRODUCT; hard-to-reverse decisions live in [`adr/`](./adr/). This doc holds the
stack, data model, and system-level mechanics only.

> Product, regulatory, and business topics are deliberately **parked** — see the
> "Parked" section in [`PRODUCT.md`](./PRODUCT.md#parked-considered-deliberately-deferred).

---

## Stack

- **Mobile:** Expo (React Native) — `expo-notifications` (local, offline-capable),
  `expo-secure-store` (session tokens).
- **Backend:** Supabase — Postgres, Auth (single project), Row-Level Security.

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
  | **Member** (web) | **Email** + **web signup/checkout** — the **canonical** app-less entry ([ADR-0010](./adr/0010-app-optional-scheduled-subscription.md)); a base Member never installs the app | **Yes** — web checkout creates the account |
  | **Member** (mobile) | Google + Apple (Apple required by App Store when Google is offered on iOS) — a **shortcut for app users**, not the only path; binds the same `auth.users.id` | **Yes** — social login may create the account |
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

- ⬜ Data model / schema (tables for Box, Sachet-scan events, Subscription, XP ledger,
  Affiliate commission lifecycle) — not yet designed.
- ⬜ Cross-border payout/tax mechanics if FluoFit (Dubai) pays Affiliates (Serbia) — see
  [PRODUCT §4 — Affiliate](./PRODUCT.md).
