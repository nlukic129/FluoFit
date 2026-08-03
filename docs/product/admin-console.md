# Admin Console

FluoFit's internal control plane — the web surface where the team operates everything the
product exposes to Members, Agents, Affiliates, and Partners. Terms in
[`/CONTEXT.md`](../../CONTEXT.md); decisions in [`docs/adr/`](../adr/). Parent index:
[`PRODUCT §8`](../PRODUCT.md#8-admin-console-).

> Status legend: ✅ decided · 🟡 partially decided · ⬜ open · 🅿️ parked

---

## 1. Scope — what the Console does in v1 ✅

The Console operates only what is **live and needs human hands now**. Parked operational
domains (payment, fulfilment) stay out until they're unparked — the module design leaves
room to slot them in without redesign.

**In v1:**

| Domain | Admin does |
|---|---|
| **Agent/Affiliate ops** | open/curate/close intake waves, approve applicants, manually add Affiliates, offboarding |
| **Payout** | generate the monthly statement → agency, review held/clawback, mark `Paid` on agency confirmation |
| **Fraud review** | hard cases, held commissions |
| **QR / Box provisioning** | generate, export-to-print, void, and track Box codes (see §4) |
| **Gamification config** | Level thresholds, Perk↔Level mapping, Agent eligibility Level (see §8) |
| **Member support** | lookup, state, the support queue + the bounded override toolkit (see §6) |
| **Partner onboarding** | fully admin-managed Partner records + perk/tier config (see §7) |
| **Disputes** | attribution, trainer change — human arbitration |

**Out of v1 (parked dependencies):** payment ops (refunds, dunning config), fulfilment /
inventory beyond Box-code status, sending transactional notifications, account-deletion /
data-rights processing, community moderation (community itself is post-v1 direction).

---

## 2. Roles & accountability ✅

- **One Admin profile in v1**, personally controlled by the founders. No RBAC split yet —
  premature for a small team. Modules are grouped so **role-based access can be layered
  later** via the existing `roles text[]` pattern ([ARCHITECTURE §1](../ARCHITECTURE.md#1-authentication--identity-)) with no redesign.
- **Audit log is an invariant, not a feature.** The whole system rests on *"disputes are
  arbitrated by a human, not an algorithm"* (activation, attribution, fraud). For that human
  arbitration to be **accountable**, every mutating admin action records **who, when, what,
  and why** — with a **mandatory reason** on sensitive actions (XP correction, releasing a
  held commission, attribution override, offboarding, config changes to Level/XP). Without
  it, the admin is an unaccountable black box over other people's money and progress.

---

## 3. Access ✅

Web surface, **Email OTP**, provisioned (no self-signup) — as in [ARCHITECTURE §1](../ARCHITECTURE.md#1-authentication--identity-).

---

## 4. QR generator & Box provisioning ✅

The point where physical product **enters the system**. Broad fulfilment/inventory stays
parked, but Box-code generation is in v1 — without it there's nothing to print.

- **Batch generation → a Box gets a life before ownership.** Generating *N* codes creates
  *N* **Box** records in a **Manufactured / Unbound** state (printed, bound to no one) →
  later **Activated** (bound to an account on first scan). This introduces a **pre-activation
  Box lifecycle**.
- **Named batches** for tracking — e.g. "Batch #12 — March, 500 units".
- **Each label carries both** the unique **QR** (encoding an opaque token) **and** the
  human-readable **~12-char fallback code** — both under the tamper seal (per the [scan model](../PRODUCT.md#2-scan-model-)).
- **Codes are opaque, high-entropy, random tokens** — never sequential, no embedded data.
  The QR carries only a token/URL; the token→Box mapping is server-side. Prevents guessing
  or forging another Box's code.
- **Export = print-ready** PDF label sheets (and/or CSV for the printer).
- **Void** — the admin can void a generated code (misprint, lost sheet) so it can never
  activate.
- **Status tracking** — per code: `Generated → Activated` (or `Void`). A light
  inventory/fraud signal without a full inventory system.
- **Sachet QR is separate** — it is **non-unique** (the same code on every sachet), so it's
  a single static code managed on its own, not batch-generated.

---

## 5. Intake wave operations ✅

Runs the Agent intake designed in [agent-affiliate-program §1](./agent-affiliate-program.md).

- **Flow:** create wave (soft cap + optional city-focus + optional niche note) → applications
  accumulate → admin reviews → selects → approve → portal access granted → close wave.
- **What admin sees per applicant (to curate):** Level, delivery city, tenure, and their own
  engagement (active streak, own activations) — proof they *live the product*. All data FluoFit
  already holds.
- **The cap is a soft guideline** — admin may approve **fewer or more** than the displayed
  number, full discretion. (Caveat: publicly promising "30 spots" then routinely exceeding it
  erodes the scarcity signal over time — a framing choice, not a system limit.)
- **Not selected → auto-carried to a waitlist** for the next wave; no re-application needed,
  no "rejected" state.
- **Explicit block** — a rare, audited action to bar a specific Member from the program
  (fraud history, brand risk) so they stop appearing in waves.

---

## 6. Support surface & override toolkit ✅

Closes the long-standing **"contact-support surface"** gap that multiple flows ended at.

- **Member-facing front door (v1):** a simple in-app **"Contact support"** that creates a
  lightweight ticket → lands in a **Support queue** in the Console. No full ticketing system
  (Zendesk) — right-sized for a small team.
- **Override toolkit** — a bounded set of actions, each **audited with a reason**:

| Action | When |
|---|---|
| **Manual Box activation** | QR unreadable beyond the fallback code, or a dispute resolved for the Member |
| **Unbind / re-bind Box** | "already bound" resolved — detach from the wrong account, allow rebind |
| **XP / Streak correction** | fix a glitch/bug |
| **Release held commission / manual clawback** | fraud-review outcome |
| **Fix / assign attribution** | trainer dispute, `ref` within the grace window |

- **Guardrail:** an **XP correction must not silently break the fraud floor** ("XP ≤ Sachets
  bought", [ADR-0006](../adr/0006-aggregate-supply-and-fraud-floor.md)). If a correction would
  push XP above the aggregate supply ceiling, it's a **loud exception** (explicit flag/confirm),
  never an ordinary edit — otherwise the admin becomes a hole in the very invariant the model
  protects.

---

## 7. Partner onboarding ✅ (verification mechanism deferred)

Partner (a business that funds Perks) returns as an entity in v1 — but as a **fully
admin-managed record with no partner-facing platform**. The team enters everything.

- **Admin configures per Partner:** profile (name, type: gym/shop/event, contact), the
  Perk(s) funded, the **discount tier ↔ Level** mapping, and a validity period / active toggle.
- **No partner surface in v1** — no partner login, no partner portal.
- **Verification & member-side redemption mechanism = deferred until the first real Partner**
  — whether it's a rotating member QR, a single-use code, or something else depends on what
  that Partner offers and needs. Until then, redemption is handled **manually / concierge** at
  the small early scale.

---

## 8. Gamification & referral config ✅

The Console holds **every tunable dial** — leveling *and* referral numbers. Full propagation
semantics live in **[ADR-0013](../adr/0013-dynamic-config-grandfathering-and-manual-margin.md)**;
this is the surface. Two invariants config must never violate: **"Level never drops"** and
**"don't move the goalposts on the already-qualified."**

**How a change propagates depends on the dial** (forward-only, grandfathered-backward):

| Dial | Editability | On change |
|---|---|---|
| Wave cap / city-focus | free, runtime | — |
| **Which Levels exist** | add freely | a **Level with holders is never deleted** — only cosmetics (name, icon) edited |
| **XP threshold to next Level** (checkpoint) | sensitive | applies to Members **still climbing**; **never demotes** anyone past it |
| **Spend-funded / zero-cost reward** ↔ Level | free, runtime, audited | **grandfathered** — snapshotted at crossing; change reaches only future crossers |
| **Partner-funded reward** ↔ Level | free, runtime, audited | **live for all holders** — a partner can leave, so it can't be pinned |
| **Buyer discount %** | sensitive | **new buyers only**; existing buyers stay locked ([ADR-0004](../adr/0004-referral-economics.md)) |
| **Agent tier rate + thresholds** | sensitive | **live for all at the next monthly snapshot**; only `Accrued` frozen |
| **Agent eligibility Level** | sensitive, rare | **never strips** eligibility from the already-qualified |
| **XP formula** (base + streak multiplier) | most sensitive | config-only, **no live UI** — thresholds already give the difficulty knob |

- **XP is checkpoint-based** — progress toward the next Level, not a displayed lifetime total; the cumulative count still backs the fraud floor ([ADR-0006](../adr/0006-aggregate-supply-and-fraud-floor.md)).
- **No enforced margin guardrail.** The Console **lets** the Admin save a money-losing ladder; self-financing is protected by **founder discipline + an offline calculator** (margin-per-Member vs reward COGS), not by construction ([ADR-0013](../adr/0013-dynamic-config-grandfathering-and-manual-margin.md), amending [ADR-0002](../adr/0002-two-purse-gamification-funding.md)). The one hard-enforced invariant remains the **fraud floor** — an XP correction still can't silently break `XP ≤ Sachets bought` (§6).
- **Every dial change is audited** (who/when/what/why), sensitive ones with a mandatory reason.

Principle: config touching **Level/XP is audited and one-directional w.r.t. the invariants** —
a threshold change never demotes existing holders; nothing silently rewrites a Member's past.

---

## Open / deferred

- 🅿️ Partner verification + member-side redemption mechanism — decided with the first Partner.
- 🅿️ XP-formula live admin UI — deferred; config-only in v1.
- 🅿️ Modules for parked domains (payment ops, fulfilment/inventory, transactional
  notifications, data-rights processing) — added when those domains unpark.
- ⬜ RBAC / multiple admin roles — when the team grows past one profile.
