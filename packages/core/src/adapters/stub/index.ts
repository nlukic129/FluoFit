// v1 stub adapters. They simulate the REAL async state machines (authorize→capture→refund,
// created→shipped→delivered, agency statement) and record every event through an OutboxWriter,
// so downstream logic (benefit clock, refill scheduling, Streak freeze) behaves exactly as it
// will in production. Only the implementation swaps when a domain unparks (ADR-0014).

import type {
  Address,
  ChargeResult,
  FulfillmentPort,
  NotifyChannel,
  NotifyPort,
  OutboxWriter,
  PaymentPort,
  PayoutLine,
  PayoutPort,
  Ports,
  Shipment,
  ShipmentStatus,
  Statement,
} from "../../ports/index";

type IdGen = () => string;
const defaultId: IdGen = () => globalThis.crypto.randomUUID();

export class StubPaymentPort implements PaymentPort {
  constructor(private outbox: OutboxWriter, private id: IdGen = defaultId) {}

  async chargeBox(input: { subscriptionId: string; amount: number }): Promise<ChargeResult> {
    const chargeRef = `ch_${this.id()}`;
    await this.outbox.enqueue("payment", "authorized", { chargeRef, ...input });
    // Simulated success path: authorize → capture. A real provider would settle async.
    await this.outbox.enqueue("payment", "captured", { chargeRef, ...input });
    return { chargeRef, status: "captured" };
  }

  async refund(chargeRef: string): Promise<void> {
    await this.outbox.enqueue("payment", "refunded", { chargeRef });
  }
}

export class StubFulfillmentPort implements FulfillmentPort {
  private shipments = new Map<string, ShipmentStatus>();

  constructor(private outbox: OutboxWriter, private id: IdGen = defaultId) {}

  async createShipment(input: { orderId: string; address: Address }): Promise<Shipment> {
    const shipmentId = `shp_${this.id()}`;
    const trackingRef = `trk_${this.id()}`;
    this.shipments.set(shipmentId, "created");
    await this.outbox.enqueue("fulfillment", "created", {
      shipmentId,
      trackingRef,
      orderId: input.orderId,
    });
    return { shipmentId, status: "created", trackingRef };
  }

  async getStatus(shipmentId: string): Promise<ShipmentStatus> {
    return this.shipments.get(shipmentId) ?? "created";
  }

  /** Test/dev hook: advance a simulated shipment so delivery-driven logic can be exercised. */
  async advance(shipmentId: string, status: ShipmentStatus): Promise<void> {
    this.shipments.set(shipmentId, status);
    await this.outbox.enqueue("fulfillment", status, { shipmentId });
  }
}

export class StubPayoutPort implements PayoutPort {
  constructor(private outbox: OutboxWriter) {}

  async generateStatement(period: string, lines: PayoutLine[]): Promise<Statement> {
    const total = lines.reduce((sum, l) => sum + l.amount, 0);
    const statement: Statement = { period, lines, total };
    await this.outbox.enqueue("payout", "statement_generated", statement);
    return statement;
  }
}

export class StubNotifyPort implements NotifyPort {
  constructor(private outbox: OutboxWriter) {}

  async send(input: {
    channel: NotifyChannel;
    template: string;
    to: string;
    payload: Record<string, unknown>;
  }): Promise<void> {
    await this.outbox.enqueue("notify", "sent", input);
  }
}

/** Convenience: wire all four stubs to one OutboxWriter. */
export function createStubPorts(outbox: OutboxWriter): Ports {
  return {
    payment: new StubPaymentPort(outbox),
    fulfillment: new StubFulfillmentPort(outbox),
    payout: new StubPayoutPort(outbox),
    notify: new StubNotifyPort(outbox),
  };
}

/** An in-memory OutboxWriter for tests/dev; the DB-backed one lands with Phase 1. */
export class InMemoryOutbox implements OutboxWriter {
  readonly events: Array<{ port: string; eventType: string; payload: unknown }> = [];
  async enqueue(port: string, eventType: string, payload: unknown): Promise<void> {
    this.events.push({ port, eventType, payload });
  }
}
