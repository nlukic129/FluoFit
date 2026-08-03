import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { Body, Button, Card, Field, Heading, Screen, Subheading } from "@fluofit/ui";

import { useSession } from "@/hooks/use-session";
import { supabase } from "@/lib/supabase";

// Member management login (magic-link / OTP) + a minimal account view. The account is
// provisioned at checkout (ADR-0012), so login uses shouldCreateUser:false. Lifecycle controls
// (pause / switch mode / change cadence / cancel) land in Phase 3 — this view is read-only.
export default function Account() {
  const { session, loading } = useSession();
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", backgroundColor: "#0B0B0F" }}>
        <ActivityIndicator color="#208AEF" />
      </View>
    );
  }
  return session ? <AccountView /> : <Login />;
}

function Login() {
  const [stage, setStage] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setLoading(true);
    setError(null);
    const { error: e } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });
    setLoading(false);
    if (e) setError(e.message);
    else setStage("code");
  }
  async function verify() {
    setLoading(true);
    setError(null);
    const { error: e } = await supabase.auth.verifyOtp({ email, token, type: "email" });
    setLoading(false);
    if (e) setError(e.message);
  }

  return (
    <Screen>
      <Heading>Prijava</Heading>
      {stage === "email" ? (
        <>
          <Body>Upravljaj pretplatom — pošaljemo ti kod na email.</Body>
          <Field
            label="Email"
            placeholder="ti@primer.rs"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <Button title="Pošalji kod" loading={loading} disabled={!email.includes("@")} onPress={send} />
        </>
      ) : (
        <>
          <Body>Unesi kod sa {email}.</Body>
          <Field label="Kod" placeholder="123456" keyboardType="number-pad" value={token} onChangeText={setToken} />
          <Button title="Prijavi se" loading={loading} disabled={token.length < 6} onPress={verify} />
        </>
      )}
      {error && <Body>⚠️ {error}</Body>}
    </Screen>
  );
}

type Subscription = {
  id: string;
  status: string;
  refill_mode: string;
  cadence_days: number | null;
  benefit_clock_expires_at: string | null;
};

function AccountView() {
  const [sub, setSub] = useState<Subscription | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error: e } = await supabase
      .from("subscriptions")
      .select("id,status,refill_mode,cadence_days,benefit_clock_expires_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (e) setError(e.message);
    else setSub(data as Subscription | null);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Screen scroll maxWidth={520}>
      <Heading>Moj nalog</Heading>
      {error && <Body>⚠️ {error}</Body>}
      {sub ? (
        <Card>
          <Subheading>Pretplata</Subheading>
          <Body>Status: {sub.status}</Body>
          <Body>
            Dopuna: {sub.refill_mode}
            {sub.cadence_days ? ` (${sub.cadence_days} dana)` : ""}
          </Body>
          {sub.benefit_clock_expires_at && (
            <Body>Benefiti aktivni do: {new Date(sub.benefit_clock_expires_at).toLocaleDateString()}</Body>
          )}
        </Card>
      ) : (
        <Body>Nema aktivne pretplate.</Body>
      )}
      <Body>Pauza, promena načina dopune i otkazivanje stižu u sledećoj fazi.</Body>
      <Button title="Odjava" variant="secondary" onPress={() => void supabase.auth.signOut()} />
    </Screen>
  );
}
