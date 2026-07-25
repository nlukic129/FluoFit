# FluoFit — Skills guide (how I use Claude Code skills)

A personal working guide. **You focus on the product; skills do the specialized work.**
Not part of the product spec — this is about *how you work*, so it's separate from
`PRODUCT.md` / `ARCHITECTURE.md`.

## What a skill is

A packaged set of expert instructions Claude loads on demand (Supabase rules, TDD loop,
security review, etc.). Two ways they run:

- **Auto** — Claude picks the skill up itself when your request matches its triggers.
  You do nothing. (e.g. you say *"this is throwing"* → `diagnose`; a diff appears → `code-review`.)
- **You invoke** — skills that change *how you work*; start them with `/name` or by asking.
  (e.g. `/grill-with-docs`, `/tdd`, `/security-review`.) Claude won't force these on you.

Rule of thumb: **routine work = Claude auto-picks; process/mode changes = you call it.**

## Your stack skills (installed for FluoFit)

| Skill | Covers | How |
|---|---|---|
| **supabase** | Auth, RLS, Edge Functions, migrations, schema, security audits | auto when Supabase work appears |
| **supabase-postgres-best-practices** | Postgres query/schema/index optimization | auto when writing/reviewing SQL |
| **vercel-react-native-skills** | React Native patterns (project-scoped) | auto during app code |
| **expo/skills** (23 skills) | Official Expo: `expo-router`, `expo-native-ui`, `expo-data-fetching`, `expo-project-structure`, `expo-dev-client`, `eas-*` (build/deploy/hosting/workflows)… | auto per task |

These fill the real gap — your backend privacy model (ADR-0003 → RLS) and your Expo app.

> Note: the official Expo set installed clean, but Snyk flagged **`eas-hosting`** and
> **`expo-skill-feedback`** as "High Risk" (heuristic, on official Expo repo — low real
> concern; skip `eas-hosting` anyway since you host data on Supabase, not EAS Hosting).

## When to use what — by phase

### Now — product discovery (where you are)
- **`/grill-with-docs`** — stress-test an open ⬜ decision (XP formula, number of Levels);
  it updates `CONTEXT.md` / ADRs as you decide. Your main tool right now.
- **`/grill-me`** — lighter challenge, no doc writes.
- **`/to-prd`** → **`/to-issues`** — once a topic is decided, turn it into a PRD, then build tickets.
- **`ui-ux-pro-max` / `prototype` / `artifact-design`** — UI mockups (you already have `box-experience.html`).
- **`/handoff`** — compact a long session for the next one.

### Later — building (Expo + Supabase)
- **`/tdd`** — test-first for scan / XP / refill logic. **Use here** — this is where the
  invariant *XP ≤ Sachets bought* must be enforced by tests.
- **`/security-review`** — ⚠️ before shipping anything touching RLS, auth, affiliate consent
  (GDPR/PDPL), or payment. Non-negotiable for this app.
- **`supabase` + `supabase-postgres-best-practices`** — auto, while writing schema/queries.
- **`verify`** / **`run`** — confirm a change actually works / launch the app.
- **`code-review`** / **`simplify`** — on diffs.
- **`diagnose`** — when you report a bug.
- **`dataviz`** — the affiliate dashboard (consumption calendar, commission charts).
- **`improve-codebase-architecture`** — once code exists; it reads `CONTEXT.md` + ADRs.

## Ignore these (wrong stack)

You have a big Cloudflare set that FluoFit does not use (you're on Supabase/Expo):
`cloudflare*`, `durable-objects`, `sandbox-sdk`, `workers-best-practices`, `wrangler`,
`turnstile-spin`, `agents-sdk`, `web-perf`. Also weak/optional: `svg-icon-generator`.
They won't fire unless the request matches — just don't reach for them.

## Adding / restoring skills

- **Find more:** `npx skills find <query>` (e.g. `supabase`, `expo`, `postgres`). Prefer
  official sources (supabase, expo, vercel-labs) with 100K+ installs.
- **Add:** `npx skills add <owner/repo@skill>` — project-scoped skills land in `.agents/`
  and are recorded in `skills-lock.json` (tracked in git); vendored files are gitignored.
- **Restore on a fresh clone:** `npx skills add` reads `skills-lock.json` (24 skills tracked).
- **Make your own:** `/write-a-skill` — worth it for a FluoFit-specific build skill that
  encodes the invariants (XP ≤ Sachets, RLS boundary, offline scan queue).

## Before you write code — build the FluoFit project skill

**This is a gate.** FluoFit is docs-only for now. The first time work turns to app code,
`CLAUDE.md` will remind you (and Claude) to do this first. It takes ~10 minutes with
`/write-a-skill` and pays off every session after.

**Why:** the installed skills (`supabase`, `expo`) know their tools generically but know
nothing about FluoFit's rules. A project skill teaches Claude *your* rules so every future
session enforces them automatically — instead of Claude re-reading the docs and sometimes
missing one.

**What it should encode** (all sourced from the docs — link, don't recopy):
- **Invariant: XP / Streak ≤ Sachets actually bought** (28/Box) — the fraud floor. Any
  scan/XP/streak code must enforce it. (CONTEXT.md, PRODUCT §2)
- **RLS boundary** — an Affiliate sees a client's consumption **only** with explicit opt-in;
  no cross-Affiliate leakage; time-of-day of scans is never shared. (ADR-0003)
- **Levels never cut FluoFit's own product price** — the only price discount is the Affiliate
  referral split. (ADR-0002, ADR-0004)
- **Offline-first scanning** — local queue + client-generated idempotency key; XP computed
  from validated scan date, not sync date; server clamps timestamps. (ARCHITECTURE §2)
- **Use the glossary terms** exactly (Box, Sachet, Member…). (CONTEXT.md)

**How, when the time comes:**
1. Run `/write-a-skill`.
2. Target location: `FluoFit/.claude/skills/fluofit-build/` (project-scoped, so it only fires here).
3. Trigger it on schema / scan / XP / affiliate / RLS work.
4. Keep it thin — it should *point to* the ADRs and CONTEXT, not duplicate them (same
   "one fact = one place" rule as the docs).

## One line to remember

Talk product. When something specialized comes up, either Claude grabs the right skill
automatically, or you type `/` and pick the process skill — nothing to memorize beyond this doc.
