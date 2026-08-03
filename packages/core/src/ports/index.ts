// Ports = the seam for the deliberately parked domains (ADR-0014). Nothing in the app or an
// Edge Function calls a third-party SDK directly — it goes through one of these interfaces.
// v1 ships stubs (../adapters/stub) that simulate the REAL async state machines; unparking a
// domain later is a port swap, not a rewrite.

export type PortName = "payment" | "fulfillment" | "payout" | "notify";

/** Stubs record their async events here; in the DB this is the `outbox` table. */
export interface OutboxWriter {
  enqueue(port: PortName, eventType: string, payload: unknown): Promise<void>;
}

// ── Payment ────────────────────────────────────────────────────────────────────
export type ChargeStatus = "authorized" | "captured" | "failed";
export interface ChargeResult {
  chargeRef: string;
  status: ChargeStatus;
}
export interface PaymentPort {
  /** Charge for a single Box (billed per Box at shipment — ADR-0001). */
  chargeBox(input: { subscriptionId: string; amount: number }): Promise<ChargeResult>;
  refund(chargeRef: string): Promise<void>;
}

// ── Fulfillment ──────────────────────────────────────────────────────────────────
export type ShipmentStatus = "created" | "shipped" | "in_transit" | "delivered";
export interface Address {
  line1: string;
  city: string;
  postalCode: string;
  country: string;
}
export interface Shipment {
  shipmentId: string;
  status: ShipmentStatus;
  trackingRef?: string;
}
export interface FulfillmentPort {
  createShipment(input: { orderId: string; address: Address }): Promise<Shipment>;
  getStatus(shipmentId: string): Promise<ShipmentStatus>;
}

// ── Payout ─────────────────────────────────────────────────────────────────────
export interface PayoutLine {
  referrerId: string;
  amount: number;
}
export interface Statement {
  period: string; // e.g. "2026-08"
  lines: PayoutLine[];
  total: number;
}
export interface PayoutPort {
  /** One statement → the paušalna agency, which pays Agents & Affiliates (ADR-0008). */
  generateStatement(period: string, lines: PayoutLine[]): Promise<Statement>;
}

// ── Notify ─────────────────────────────────────────────────────────────────────
export type NotifyChannel = "email" | "sms" | "push";
export interface NotifyPort {
  send(input: {
    channel: NotifyChannel;
    template: string;
    to: string;
    payload: Record<string, unknown>;
  }): Promise<void>;
}

export interface Ports {
  payment: PaymentPort;
  fulfillment: FulfillmentPort;
  payout: PayoutPort;
  notify: NotifyPort;
}
