# FluoFit

Single-serving supplement brand: app + subscription + affiliate program + loyalty.
**Product & decisions live in docs — start at [`CLAUDE.md`](./CLAUDE.md)** (the router) and
[`docs/README.md`](./docs/README.md).

> Writing app code? Load the **`fluofit-build`** skill first — it encodes the five invariants
> the whole system rests on. Build shape: [ADR-0014](./docs/adr/0014-stack-monorepo-and-ports.md).

## Monorepo

```
apps/       member (Expo iOS/Android/web) · partners · admin   ← Phase 1+
packages/   core (invariants, ports, stubs) · db (client+types) · config · ui
supabase/   migrations (0001–0011) + config.toml
```

## Quickstart

```bash
corepack pnpm install          # deps (Node ≥ 20; see .nvmrc)
pnpm -r typecheck              # typecheck every package
pnpm --filter @fluofit/core test   # invariant unit tests (fraud floor, streak boundary)

pnpm db:start                 # boot local Supabase + apply migrations   (needs Docker)
pnpm db:types                 # regenerate packages/db/src/database.types.ts
pnpm db:reset                 # re-apply migrations from scratch
```

## Status

**Phase 0 (foundation) done:** schema + RLS + fraud-floor trigger + config engine (all
migration-tested), adapter ports + stubs, shared types, `fluofit-build` skill. Next:
**Phase 1 — commercial core** (checkout, Subscription, Box provisioning, Activation).

Live progress per phase → [`docs/ROADMAP.md`](./docs/ROADMAP.md); the frozen sequencing
decision → [ADR-0014](./docs/adr/0014-stack-monorepo-and-ports.md).
