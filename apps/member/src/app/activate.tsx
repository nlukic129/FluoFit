import { useState } from "react";
import { View } from "react-native";

import { Body, Button, Field, Heading, Screen } from "@/components/ui";
import { supabase } from "@/lib/supabase";

// Box Activation via the human-readable fallback code (the QR scanner path lands in Phase 2).
// Calls fn_activate_box (0012): a Subscription Box transfers the whole Subscription onto the
// scanner (ADR-0012); a retail Box makes them a Standalone Box holder (ADR-0007). Requires a
// signed-in session (the RPC uses auth.uid()).
export default function Activate() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function activate() {
    setLoading(true);
    setError(null);
    setResult(null);
    const { data, error: rpcError } = await supabase.rpc("fn_activate_box", { p_code: code });
    setLoading(false);

    if (rpcError) {
      // The DB raises box_already_bound / box_void / box_not_found — route to a human message.
      const msg = rpcError.message.includes("already_bound")
        ? "Ovaj Box je već aktiviran na drugom nalogu. Ako misliš da je greška, kontaktiraj podršku."
        : rpcError.message.includes("box_void")
          ? "Ovaj Box je poništen."
          : rpcError.message.includes("not_found")
            ? "Kod nije pronađen — proveri i pokušaj ponovo."
            : rpcError.message;
      setError(msg);
      return;
    }

    const outcome = (data as { outcome?: string } | null)?.outcome;
    setResult(
      outcome === "subscription_transferred"
        ? "Aktivirano! Pretplata je sada na tvom nalogu."
        : "Aktivirano! Imaš Standalone Box — pretplati se da otključaš Perks.",
    );
  }

  return (
    <Screen>
      <View style={{ flex: 1, gap: 16 }}>
        <Heading>Aktiviraj Box</Heading>
        <Body>Unesi 12-cifreni kod ispod QR-a (kad kamera ne može da pročita).</Body>
        <Field
          label="Kod sa kutije"
          placeholder="npr. A1B2C3D4E5F6"
          autoCapitalize="characters"
          value={code}
          onChangeText={setCode}
        />
        {result && <Body>✅ {result}</Body>}
        {error && <Body>⚠️ {error}</Body>}
      </View>
      <Button title="Aktiviraj" loading={loading} disabled={code.length < 6} onPress={activate} />
    </Screen>
  );
}
