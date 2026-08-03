// The fraud floor (ADR-0006), mirrored client-side for the OPTIMISTIC view only. The
// authoritative enforcement is the DB trigger in 0006_scans_progress_fraud_floor.sql — this
// helper never replaces it; it lets the device pre-empt an obviously-invalid earning scan.
//
// Invariant: earning scans ≤ 28 × activated Boxes (aggregate, not per-Box). Each earning scan
// consumes one Sachet; "XP ≤ Sachets bought" is the customer-facing shorthand.

export const SACHETS_PER_BOX = 28;

export class FraudFloorError extends Error {
  constructor(earningScansTotal: number, activatedBoxes: number) {
    super(
      `fraud_floor: earning scans (${earningScansTotal}) would exceed ` +
        `${SACHETS_PER_BOX} × activated Boxes (${SACHETS_PER_BOX * activatedBoxes})`,
    );
    this.name = "FraudFloorError";
  }
}

export function maxEarningScans(activatedBoxes: number): number {
  return SACHETS_PER_BOX * activatedBoxes;
}

/** True if one more earning scan is still within the supply the Member has paid for. */
export function canEarnAnotherScan(
  earningScansTotal: number,
  activatedBoxes: number,
): boolean {
  return earningScansTotal < maxEarningScans(activatedBoxes);
}

/** Throws FraudFloorError if the given total already exceeds the supply ceiling. */
export function assertFraudFloor(
  earningScansTotal: number,
  activatedBoxes: number,
): void {
  if (earningScansTotal > maxEarningScans(activatedBoxes)) {
    throw new FraudFloorError(earningScansTotal, activatedBoxes);
  }
}
