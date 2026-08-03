"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useSession } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase/client";

// Admin access = Email OTP, provisioned (no self-signup) — admin-console §3.
export default function LoginPage() {
  const router = useRouter();
  const { session } = useSession();
  const [stage, setStage] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (session) router.replace("/overview");
  }, [session, router]);

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
    <div className="flex h-dvh items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-base">FluoFit Admin</CardTitle>
          <CardDescription>
            {stage === "email"
              ? "Sign in with a one-time code sent to your email."
              : `Enter the 6-digit code sent to ${email}.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {stage === "email" ? (
            <>
              <Field
                type="email"
                placeholder="admin@fluofit.com"
                value={email}
                onChange={setEmail}
              />
              <Button className="w-full" disabled={!email.includes("@") || loading} onClick={send}>
                {loading ? "Sending…" : "Send code"}
              </Button>
            </>
          ) : (
            <>
              <Field
                inputMode="numeric"
                placeholder="123456"
                value={token}
                onChange={setToken}
              />
              <Button className="w-full" disabled={token.length < 6 || loading} onClick={verify}>
                {loading ? "Verifying…" : "Sign in"}
              </Button>
            </>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  value,
  onChange,
  ...props
}: {
  value: string;
  onChange: (v: string) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <input
      className="h-9 w-full rounded-md border border-border bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      {...props}
    />
  );
}
