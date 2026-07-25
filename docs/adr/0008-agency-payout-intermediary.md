# A marketing agency is the payout rail for all referrers

## Context

Opening the referral channel to the masses (the **Agent** role — any Member who levels up
can become a paid referrer) collides with the entity gate in [ADR-0004](./0004-referral-economics.md)
/ [PRODUCT §4](../PRODUCT.md): "an Affiliate must be a registered entity that invoices FluoFit;
unregistered individuals cannot be Affiliates." Most leveled-up Members are private
individuals — FluoFit cannot legally wire recurring commission to hundreds of them directly.

## Decision

A **paušalna marketing agency** sits between FluoFit and the referrers as the payout rail.
**FluoFit issues one invoice-in to the agency**; the agency distributes cash to **both Agents
and Affiliates**. This **supersedes the per-person entity gate** in ADR-0004 — an individual
Agent no longer needs to be a registered entity to be paid.

The commission lifecycle is unchanged (`Accrued → Cleared` after a 30-day hold + clawback
`→ Payable → Paid`, monthly with a minimum threshold); only *who FluoFit pays* changes — the
agency, not each referrer.

## Consequences

- The "every user can become an Agent" vision becomes legally viable without mass entity
  registration.
- FluoFit's accounting sees a single vendor (the agency), not N referrers.
- The agency owns the individual-payout tax/withholding relationship with each referrer —
  that obligation moves off FluoFit but must be honored by the agency.
- ⬜ Cross-border flow if FluoFit (Dubai) funds the agency (Serbia) — still flagged, parked.
