# Stack, monorepo shape, and the ports/adapters boundary for parked integrations

> Realises the technology already named in [ARCHITECTURE.md](../ARCHITECTURE.md) (Expo +
> Supabase) into a concrete build shape. Depends on the *simulated-integrations* development
> approach (v1 = functional prototype, all third-party services stubbed behind adapters) and on
> the invariants in [ADR-0003](./0003-affiliate-consent-boundary.md) (RLS consent boundary),
> [ADR-0006](./0006-aggregate-supply-and-fraud-floor.md) (fraud floor), and
> [ADR-0013](./0013-dynamic-config-grandfathering-and-manual-margin.md) (dynamic config).

## Context

The product is fully specified across 13 ADRs, `CONTEXT.md`, `PRODUCT.md`, and `ARCHITECTURE.md`.
`ARCHITECTURE.md` names the stack (Expo mobile, Supabase backend) but leaves three build-shaping
questions open before code can start:

1. **How many client surfaces, and on what web stack?** The model implies four: the Member
   mobile app, an **app-less Member web** (passwordless checkout + subscription management —
   [ADR-0010](./0010-app-optional-scheduled-subscription.md), [ADR-0012](./0012-identity-checkout-and-box-ownership.md)),
   the **Agent/Affiliate web app** ([agent-affiliate-app](../product/agent-affiliate-app.md)),
   and the **Admin Console** ([admin-console](../product/admin-console.md)).
2. **Where do the invariants physically live** so all four surfaces enforce them without
   duplication?
3. **How do the deliberately parked domains** (payment, fulfillment, payout, transactional
   notifications) not block a functional v1 — given the founder's decision that v1 is a working
   prototype with every third-party integration simulated?

These are hard to reverse (they set the repo layout, the deploy targets, and the seams that
parked work slots into later), so they belong in an ADR rather than inline notes.

## Decision

### 1. Stack, per surface

- **Member (mobile + app-less web): one Expo Router app, three targets (iOS/Android/web).**
  The passwordless checkout and "manage subscription" web flows share the *same* domain logic as
  the mobile app, so they are the **web target of the same app**, not a separate codebase. The
  public marketing/landing site is out of scope (GTM is parked).
- **Agent/Affiliate and Admin Console: separate Expo-Router **web** apps** in the monorepo. One
  UI stack for the whole v1 keeps a single skill set and maximises sharing of `packages/core`
  and the generated DB types. They are kept as **distinct apps** (not folded into Member) so the
  seam to migrate them to Next.js later — *if* data-dense dashboards outgrow React Native Web —
  is already in place, with **no backend change** required.
- **Backend: Supabase** — one project: Postgres + Auth + RLS + Edge Functions (Deno) +
  **pg_cron** + Realtime + Storage. Confirmed from [ARCHITECTURE §1–2](../ARCHITECTURE.md).
- **Monorepo: pnpm workspaces + Turborepo.**

Rejected — **Next.js for the three web surfaces** now: it is the better long-term fit for
SSR/SEO checkout funnels and heavy admin tables, but it introduces a second UI stack and less
component sharing at exactly the prototype stage where uniformity matters most. It stays the
documented **escape hatch** for `apps/partners` and `apps/admin`, not the v1 choice.

### 2. Monorepo layout

```
apps/
  member/     Expo Router — iOS + Android + web (scanner, XP/Streak, home, reminders,
              passwordless checkout & manage)
  partners/   Expo web — Agent/Affiliate (commission plane + consent-gated coaching plane)
  admin/      Expo web — Admin Console (Box provisioning, intake waves, payout, config, support)
packages/
  core/       DOMAIN: invariants, lifecycle state machines, PORTS (adapter interfaces), Zod types
  db/         Supabase schema, migrations, RLS policies, generated TypeScript types
  config/     dynamic-config client (dials + grandfathering semantics — ADR-0013)
  ui/         shared design system (React Native + web)
supabase/
  functions/  Edge Functions (scan-sync, refill, commission, config-apply, adapter-webhook-sim)
  migrations/
```

**Invariants live in the lowest shared layer — `packages/db` (as DB constraints/RLS) and
`packages/core` (as domain logic) — never in a screen.** All four apps inherit them. The full
data model + RLS is specified in [architecture/data-model.md](../architecture/data-model.md).

### 3. Ports / adapters — the seam for parked domains

Parked third-party domains are **ports** (TypeScript interfaces in `packages/core`) from day 1;
v1 ships **stubs that simulate the real *async* state machines**, not no-ops:

| Port | v1 stub behaviour | Real impl later |
|---|---|---|
| **PaymentPort** | `authorize → capture → fail → refund` transitions; drives the "paid order" event | payment provider (parked) |
| **FulfillmentPort** | `created → shipped → delivered` + synthetic tracking; feeds delivery-aware refill scheduling and the "our-fault" Streak freeze ([ADR-0011](./0011-refill-mode-decoupled-and-benefit-clock.md)) | carrier + fulfilment (parked) |
| **PayoutPort** | monthly per-recipient statement → agency ([ADR-0008](./0008-agency-payout-intermediary.md)) | agency integration (parked) |
| **NotifyPort** | order/ship/tracking + transactional sends (closes the [OPEN-FLOWS](../OPEN-FLOWS.md) transactional-notifications gap) | email/SMS/push provider (parked) |

Stubs emit their async events through an **`outbox` table + an `adapter-webhook-sim` Edge
Function**, so the whole lifecycle (benefit clock keyed off "paid order", refill off "delivered",
Streak freeze off "in transit") behaves exactly as in production — only the port implementation is
swapped when a domain unparks.

### 4. Build sequencing (dependency-honest, tracer-bullet)

- **Phase 0 — Foundation:** the `fluofit-build` skill (the [CLAUDE.md](../../CLAUDE.md) stage
  gate) · schema + RLS + fraud-floor trigger · ports + stubs · audit log · config engine.
- **Phase 1 — Commercial core:** passwordless checkout (stub payment) · Subscription · Box
  provisioning (Admin) · Activation + whole-Subscription transfer ([ADR-0012](./0012-identity-checkout-and-box-ownership.md)).
- **Phase 2 — Habit loop (highest technical risk):** always-live scanner · scan ledger ·
  XP/Streak/Level engine · offline sync · fraud floor end-to-end.
- **Phase 3 — Lifecycle:** refill engine (Smart/Manual) · benefit clock · lapse/pause · local
  reminders (heuristic).
- **Phase 4 — Growth:** Agent/Affiliate program · commission lifecycle · consent/coaching plane.
- **Phase 5 — Loyalty + Admin completion:** Perks/Partners · intake waves · payout statement ·
  support override toolkit.

Order follows dependencies (nothing to scan before a Box/Subscription exists), with the riskiest
piece (offline scan + fraud floor) pulled to Phase 2.

## Consequences

- **The `fluofit-build` skill is now the enforced entry point** to every coding session — the
  stage gate in [CLAUDE.md](../../CLAUDE.md) is satisfied and updated.
- **A new owning doc, [architecture/data-model.md](../architecture/data-model.md)**, holds the
  schema + RLS; `ARCHITECTURE.md` becomes the index for that domain (per the CLAUDE.md
  fan-out rule) and its "Data model / schema" open question is closed.
- **The ports boundary makes "parked" a code seam, not a blocker** — v1 is a fully functional
  prototype; unparking a domain is a port swap, not a rewrite.
- **Escape hatch recorded:** `apps/partners` / `apps/admin` may migrate to Next.js without
  touching the backend if React Native Web proves too thin for data-dense dashboards.
- **The numbers are still pending COGS → pricing** — unchanged by this ADR; config dials carry
  placeholders ([ADR-0013](./0013-dynamic-config-grandfathering-and-manual-margin.md)).
