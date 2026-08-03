import { useCallback, useEffect, useState } from "react";
import { Platform, View } from "react-native";

import { Body, Button, Card, Field, Heading, Screen, Subheading } from "@fluofit/ui";
import { supabase } from "@/lib/supabase";

// QR / Box provisioning (admin-console §4). Calls the admin-gated RPCs from 0012:
// fn_provision_batch (generate a named Batch of unbound Boxes) and fn_void_box.
type Batch = { id: string; name: string; unit_count: number; created_at: string };
type Box = { id: string; human_code: string; status: string; batch_id: string };

export default function Provisioning() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [name, setName] = useState("");
  const [count, setCount] = useState("500");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [b, x] = await Promise.all([
      supabase.from("batches").select("*").order("created_at", { ascending: false }),
      supabase.from("boxes").select("id,human_code,status,batch_id").limit(200),
    ]);
    if (b.data) setBatches(b.data as Batch[]);
    if (x.data) setBoxes(x.data as Box[]);
    if (b.error) setError(b.error.message);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function createBatch() {
    setBusy(true);
    setError(null);
    const { error: e } = await supabase.rpc("fn_provision_batch", {
      p_name: name,
      p_count: Number(count),
    });
    setBusy(false);
    if (e) setError(e.message);
    else {
      setName("");
      await reload();
    }
  }

  async function voidBox(box: Box) {
    const reason =
      Platform.OS === "web"
        ? ((globalThis as { prompt?: (m: string) => string | null }).prompt?.("Razlog poništenja:") ??
          null)
        : "voided from admin";
    if (!reason) return;
    const { error: e } = await supabase.rpc("fn_void_box", { p_box_id: box.id, p_reason: reason });
    if (e) setError(e.message);
    else await reload();
  }

  function exportCsv() {
    if (Platform.OS !== "web") return;
    const rows = [["human_code", "status", "batch_id"], ...boxes.map((b) => [b.human_code, b.status, b.batch_id])];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const doc = (globalThis as { document?: any }).document;
    if (!doc) return;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = doc.createElement("a");
    a.href = url;
    a.download = "fluofit-boxes.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Screen scroll maxWidth={720}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Heading>Box provisioning</Heading>
        <Button title="Odjava" variant="secondary" onPress={() => void supabase.auth.signOut()} />
      </View>

      <Card>
        <Subheading>Novi batch</Subheading>
        <Field label="Naziv" placeholder="Batch #12 — Mart" value={name} onChangeText={setName} />
        <Field label="Broj Box-eva" keyboardType="number-pad" value={count} onChangeText={setCount} />
        <Button
          title="Generiši batch"
          loading={busy}
          disabled={!name || !(Number(count) > 0)}
          onPress={createBatch}
        />
      </Card>

      {error && <Body>⚠️ {error}</Body>}

      <Subheading>Batches ({batches.length})</Subheading>
      {batches.map((b) => (
        <Card key={b.id}>
          <Body>
            {b.name} — {b.unit_count} kom
          </Body>
        </Card>
      ))}

      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Subheading>Box-evi ({boxes.length})</Subheading>
        {Platform.OS === "web" && (
          <Button title="Export CSV" variant="secondary" onPress={exportCsv} />
        )}
      </View>
      {boxes.slice(0, 50).map((b) => (
        <Card key={b.id}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Body>
              {b.human_code} · {b.status}
            </Body>
            {b.status === "unbound" && (
              <Button title="Void" variant="danger" onPress={() => voidBox(b)} />
            )}
          </View>
        </Card>
      ))}
    </Screen>
  );
}
