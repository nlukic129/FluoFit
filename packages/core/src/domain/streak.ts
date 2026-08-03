// Streak day-boundary helper. A "day" is a calendar day in the Member's ACCOUNT timezone —
// not UTC, not the live device clock (CONTEXT: Streak, ADR-0011). This function turns a raw
// scan timestamp into the local calendar date used by the ledger (scan_date_local).
//
// The full streak computation (rolling weekly grace, the "our-fault in-transit" freeze) is a
// Phase 2 engine over the scan ledger; only the boundary primitive is needed now.

/** Returns the YYYY-MM-DD calendar date of `scannedAt` in the given IANA timezone. */
export function scanDateLocal(scannedAt: Date, timeZone: string): string {
  // en-CA formats as YYYY-MM-DD; timeZone shifts to the account's local day.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(scannedAt);
}

/**
 * Server-side timestamp clamp on sync (ARCHITECTURE §2): reject a future scan; clamp
 * suspicious backdating to receipt time. Returns the timestamp to persist.
 */
export function clampScanTimestamp(clientScannedAt: Date, receivedAt: Date): Date {
  if (clientScannedAt.getTime() > receivedAt.getTime()) {
    // A scan cannot happen in the future — clamp to receipt.
    return receivedAt;
  }
  return clientScannedAt;
}
