import { useRouter } from "expo-router";
import { useState } from "react";
import { Platform, ScrollView, View } from "react-native";

import { Body, Button, Choice, Field, Heading, Screen } from "@/components/ui";
import type { RefillMode } from "@fluofit/core";

// Passwordless email-first checkout (ADR-0012). The account is auto-provisioned from the
// checkout email server-side (see src/app/api/checkout+api.ts) — no password wall. Mode +
// cadence are chosen here (ADR-0011). Payment is a stub PaymentPort on the server for v1.

type Step = "email" | "plan" | "done";

const CADENCES = [28, 35, 42, 50, 60];

export default function Checkout() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [mode, setMode] = useState<RefillMode>("smart");
  const [cadence, setCadence] = useState(35);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      const base = Platform.OS === "web" ? "" : (process.env.EXPO_PUBLIC_API_URL ?? "");
      const res = await fetch(`${base}/api/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          refillMode: mode,
          cadenceDays: mode === "manual" ? cadence : null,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Checkout failed");
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Greška");
    } finally {
      setLoading(false);
    }
  }

  if (step === "done") {
    return (
      <Screen>
        <View style={{ flex: 1, justifyContent: "center", gap: 12 }}>
          <Heading>Pretplata je aktivna 🎉</Heading>
          <Body>
            Poslali smo link na {email} za upravljanje pretplatom. Prvi Box kreće odmah — skeniraj
            ga kad stigne da otključaš ekosistem.
          </Body>
        </View>
        <Button title="Nazad na početnu" onPress={() => router.replace("/")} />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ gap: 16 }} keyboardShouldPersistTaps="handled">
        {step === "email" && (
          <>
            <Heading>Tvoj email</Heading>
            <Body>Bez lozinke — nalog pravimo iz email-a, link za upravljanje stiže posle.</Body>
            <Field
              label="Email"
              placeholder="ti@primer.rs"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            <Button
              title="Nastavi"
              disabled={!email.includes("@")}
              onPress={() => setStep("plan")}
            />
          </>
        )}

        {step === "plan" && (
          <>
            <Heading>Način dopune</Heading>
            <Choice
              label="Smart — dopuna po potrošnji (skeniraš)"
              selected={mode === "smart"}
              onPress={() => setMode("smart")}
            />
            <Choice
              label="Manual — po kalendaru (28–60 dana)"
              selected={mode === "manual"}
              onPress={() => setMode("manual")}
            />

            {mode === "manual" && (
              <View style={{ gap: 8 }}>
                <Body>Na koliko dana da stiže Box?</Body>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {CADENCES.map((d) => (
                    <View key={d} style={{ minWidth: 64 }}>
                      <Choice
                        label={`${d}d`}
                        selected={cadence === d}
                        onPress={() => setCadence(d)}
                      />
                    </View>
                  ))}
                </View>
              </View>
            )}

            {error && <Body>⚠️ {error}</Body>}
            <Button title="Potvrdi i plati" loading={loading} onPress={submit} />
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
