import { useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { Body, Button, Card, Field, Heading, Screen, Subheading } from "@fluofit/ui";

import { useSession } from "@/hooks/use-session";
import { supabase } from "@/lib/supabase";

// Agent/Affiliate portal SHELL. Login works now; the role-adaptive dashboard (tier progress,
// commission plane, consent-gated coaching) is built in Phase 4 (agent-affiliate-app).
export default function Index() {
  const { session, loading } = useSession();
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", backgroundColor: "#0B0B0F" }}>
        <ActivityIndicator color="#208AEF" />
      </View>
    );
  }
  return session ? <Dashboard /> : <Login />;
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
      <Heading>FluoFit — Partneri</Heading>
      {stage === "email" ? (
        <>
          <Body>Prijava kodom na email (Agent/Affiliate nalog).</Body>
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
          <Body>Unesi 6-cifreni kod poslat na {email}.</Body>
          <Field label="Kod" placeholder="123456" keyboardType="number-pad" value={token} onChangeText={setToken} />
          <Button title="Prijavi se" loading={loading} disabled={token.length < 6} onPress={verify} />
        </>
      )}
      {error && <Body>⚠️ {error}</Body>}
    </Screen>
  );
}

function Dashboard() {
  return (
    <Screen scroll maxWidth={720}>
      <Heading>Dashboard</Heading>
      <Card>
        <Subheading>Uskoro (Faza 4)</Subheading>
        <Body>
          Ovde stiže: napredak tiera / fiksni %, zarada po statusu (Accrued/Cleared/Payable/Paid),
          referral link + QR, i coaching plane za klijente koji su dali saglasnost.
        </Body>
      </Card>
      <Button title="Odjava" variant="secondary" onPress={() => void supabase.auth.signOut()} />
    </Screen>
  );
}
