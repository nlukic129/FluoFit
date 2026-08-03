import { useState } from "react";

import { Body, Button, Field, Heading, Screen } from "@fluofit/ui";
import { supabase } from "@/lib/supabase";

// Admin access = Email OTP, provisioned (no self-signup) — ARCHITECTURE §1 / admin-console §3.
export default function Login() {
  const [stage, setStage] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode() {
    setLoading(true);
    setError(null);
    const { error: e } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false }, // OTP only reaches a pre-provisioned admin email
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
    if (e) setError(e.message); // session updates via onAuthStateChange on success
  }

  return (
    <Screen>
      <Heading>Admin Console</Heading>
      {stage === "email" ? (
        <>
          <Body>Prijava kodom na email (nalog mora biti unapred kreiran).</Body>
          <Field
            label="Email"
            placeholder="admin@fluofit.rs"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <Button title="Pošalji kod" loading={loading} disabled={!email.includes("@")} onPress={sendCode} />
        </>
      ) : (
        <>
          <Body>Unesi 6-cifreni kod poslat na {email}.</Body>
          <Field
            label="Kod"
            placeholder="123456"
            keyboardType="number-pad"
            value={token}
            onChangeText={setToken}
          />
          <Button title="Prijavi se" loading={loading} disabled={token.length < 6} onPress={verify} />
        </>
      )}
      {error && <Body>⚠️ {error}</Body>}
    </Screen>
  );
}
