# Admin Console runs on Next.js + Tailwind + shadcn-style UI, with a light-mode, desktop-first design language

> **Invokes the escape hatch in [ADR-0014 §1](./0014-stack-monorepo-and-ports.md)** (which pre-authorised moving
> `apps/admin` to Next.js if a data-dense dashboard outgrows React Native Web). Backend
> (Supabase + RPCs) is unchanged. `apps/member` and `apps/partners` stay on Expo.

## Context

The founder re-prioritised to **complete the whole Admin Console** and set explicit UX
constraints: **light mode, English copy, desktop-first, and a genuinely professional look.** The
v1 admin shell was an Expo-web app (React Native Web, dark, Serbian). For a data-dense internal
tool — tables, forms, config dials, audit log, support queue — React Native Web is awkward:
no mature table/form/dialog primitives, weaker keyboard/pointer ergonomics, and it fights the
"professional admin" bar. The design brief from `ui-ux-pro-max` returned a **Data-Dense
Dashboard** style best realised with a real web stack + a component system.

## Decision

- **`apps/admin` is a Next.js (App Router) app** with **Tailwind CSS v4** and **shadcn-style
  components** (hand-vendored: `Button`, `Card`, … via `class-variance-authority` + `cn`), Lucide
  icons, and `@supabase/supabase-js` for auth + RPC calls. No service-role key in the bundle;
  every admin RPC stays `is_admin()`-gated and audited.
- **Design language (from [ui-ux-pro-max], persisted at `apps/admin/design-system/`):**
  - **Light only** (no dark mode for the internal tool). Palette: primary `#1E40AF`, secondary
    `#3B82F6`, accent `#D97706`, background `#F8FAFC`, surface `#FFFFFF`, semantic
    success/warning/destructive. Tokens are CSS variables mapped through Tailwind v4 `@theme`.
  - **Fira Sans** (UI) + **Fira Code** (tabular data columns / amounts).
  - **Desktop-first:** fixed left **sidebar** nav + wide content (`max-w-[1400px]`), data-dense
    tables with hover rows / sort / filter, dialogs for mutations.
  - **English** copy throughout.
  - WCAG AA contrast, visible focus rings, `prefers-reduced-motion`, 150–300ms transitions.
- **Escape hatch used, not the default:** this is the ADR-0014 exception for the admin surface
  only. The member and partners apps remain Expo (one mobile stack). The monorepo now has two UI
  stacks by design: Expo for product surfaces, Next.js for the internal dashboard.

Rejected — restyling the Expo-web admin to light/English/desktop: cheaper short-term but caps
the professional ceiling and keeps fighting RN Web for tables/forms; the existing shell (login +
provisioning only) was cheap to replace.

## Consequences

- The Expo `apps/admin` was removed and rebuilt as Next.js; `next build` + `tsc` pass (M0).
- A dedicated **Admin completion track (M0–M6)** in [`ROADMAP.md`](../ROADMAP.md) now supersedes
  the admin items previously scattered across Phases 1/4/5.
- The design system is persisted (`apps/admin/design-system/fluofit-admin/MASTER.md`) so every
  admin page stays visually consistent across sessions.
- A second toolchain (Next.js/Tailwind) enters the repo — accepted for the internal tool; the
  member/partners mobile stack is untouched.
