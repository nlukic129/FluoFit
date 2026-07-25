# Affiliates see client consumption only via separate, explicit opt-in

## Context

The Affiliate dashboard's differentiating feature is letting a trainer see a referred client's consumption ("how many Sachets, when to nudge"). This is personal data about an identified individual, shared with a third party (the trainer). GDPR / UAE PDPL require consent that is specific, informed, unbundled, and revocable — bundling it into blanket privacy-policy acceptance makes the consent invalid.

## Decision

Two data planes:
- **Commission plane** (the Affiliate's own money — counts, earnings) is always visible.
- **Coaching plane** (the client's consumption) is visible **only after the client's explicit opt-in**, captured as a **separate, non-pre-ticked checkbox** shown at signup *only when a trainer code is present* — never bundled into privacy-policy acceptance. Revocable anytime.

Shared coaching set (all-or-nothing, no tiering in v1): first + last name, **day-level** consumption calendar (which days a Sachet was scanned, **never time-of-day**), Sachets remaining, derived stats (streak, adherence %).

Time-of-day of scans is **never** shared — it stays internal to feed the Member's own reminders. Cross-Affiliate isolation is enforced with row-level security.

**Scope note (2026-07, broadened):** the coaching plane is available to **any referrer** — **Agent or Affiliate** — whose client has opted in; **consent, not role, is the gate.** The visibility is **binary**: no consent → the referrer sees only **pseudonymous** commission rows (status/earnings, no identity); consent → the **full coaching set** (identity + day-level consumption). There is no middle "name-only" tier. This extends the original decision (first framed as a trainer feature) to the whole referral program, but the boundary is unchanged: separate, unbundled, revocable consent; time-of-day never shared; RLS isolation. Surface + render: [Agent/Affiliate web app §2](../product/agent-affiliate-app.md). Terms: [CONTEXT.md](../../CONTEXT.md).

## Consequences

- One extra checkbox at signup (only for code-referred Members) — accepted as the cost of valid consent.
- The dashboard's coaching view is dark for any client who hasn't opted in; the commission view still works.
- Reminder personalization (time-of-day) and trainer coaching (day-level) draw from the same scan data but expose different granularities — the pipeline must keep them separate.
