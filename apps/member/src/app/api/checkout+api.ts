// Server API route (runs server-side, can read secret env — expo-project-structure). This is
// the app-less checkout brain (ADR-0010/0012): auto-provision the account from the email, create
// the Subscription, place the first order, "charge" via the stub PaymentPort, mark it paid (which
// sets the benefit clock). Uses the service-role client — it BYPASSES RLS, so it must live only
// here on the server, never in a screen.
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const BOX_PRICE = 4000; // RSD

export async function POST(request: Request): Promise<Response> {
  const { email, refillMode, cadenceDays, refCode } = await request.json();

  if (!email || (refillMode !== "smart" && refillMode !== "manual")) {
    return Response.json({ error: "email and a valid refillMode are required" }, { status: 400 });
  }
  if (refillMode === "manual" && !(cadenceDays >= 28 && cadenceDays <= 60)) {
    return Response.json({ error: "manual cadence must be 28–60 days" }, { status: 400 });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1. Auto-provision the account from the checkout email (passwordless).
  const { data: created, error: userErr } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  if (userErr || !created?.user) {
    // TODO(Phase 1): resume an existing account (look up by email) instead of erroring.
    return Response.json(
      { error: userErr?.message ?? "could not provision account" },
      { status: 409 },
    );
  }
  const ownerId = created.user.id;
  await admin.from("profiles").upsert({ id: ownerId });

  // 2. Create the Subscription (mode + cadence chosen at checkout).
  const { data: subId, error: subErr } = await admin.rpc("fn_create_subscription", {
    p_owner: ownerId,
    p_refill_mode: refillMode,
    p_smart_substate: refillMode === "smart" ? "pending" : null,
    p_cadence: refillMode === "manual" ? cadenceDays : null,
    p_ref_code: refCode ?? null,
    p_discount: null,
  });
  if (subErr) return Response.json({ error: subErr.message }, { status: 500 });

  // 3. Place the first order, "charge" via the stub PaymentPort, then capture it.
  const { data: orderId, error: orderErr } = await admin.rpc("fn_place_order", {
    p_subscription: subId,
    p_amount: BOX_PRICE,
  });
  if (orderErr) return Response.json({ error: orderErr.message }, { status: 500 });

  const chargeRef = `ch_stub_${globalThis.crypto.randomUUID()}`; // stub PaymentPort success
  const { error: payErr } = await admin.rpc("fn_mark_order_paid", {
    p_order: orderId,
    p_charge_ref: chargeRef,
  });
  if (payErr) return Response.json({ error: payErr.message }, { status: 500 });

  // 4. TODO(Phase 1): FulfillmentPort.createShipment for the first Box; NotifyPort magic link.
  return Response.json({ subscriptionId: subId, status: "active" });
}
