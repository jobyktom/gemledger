"use client";

import { IndianMobile } from "@gemledger/shared";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button, Field, FormError, Input } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

/** Only allow redirects back into our own portal. */
function safeNext(next: string | null) {
  return next && /^\/(portal|admin)(\/|$)/.test(next) ? next : "/portal";
}

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [e164, setE164] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    const parsed = IndianMobile.safeParse(phone);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message);
    setBusy(true);
    const { error } = await createClient().auth.signInWithOtp({ phone: parsed.data });
    setBusy(false);
    if (error) return setError(error.message);
    setE164(parsed.data);
    setStep("code");
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    setBusy(true);
    const { error } = await createClient().auth.verifyOtp({ phone: e164, token: code.trim(), type: "sms" });
    setBusy(false);
    if (error) return setError("That code didn't work. Check it, or request a new one.");
    router.replace(safeNext(params.get("next")));
    router.refresh();
  }

  if (step === "phone") {
    return (
      <form onSubmit={sendCode} className="flex flex-col gap-4">
        <Field label="Mobile number">
          <Input
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            placeholder="98765 43210"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
        </Field>
        <FormError message={error} />
        <Button disabled={busy}>{busy ? "Sending…" : "Send code"}</Button>
      </form>
    );
  }

  return (
    <form onSubmit={verify} className="flex flex-col gap-4">
      <Field label={`Code sent to ${e164.replace("+91", "+91 ")}`}>
        <Input
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          placeholder="6-digit code"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          required
          autoFocus
        />
      </Field>
      <FormError message={error} />
      <Button disabled={busy || code.length !== 6}>{busy ? "Checking…" : "Verify and sign in"}</Button>
      <Button type="button" variant="secondary" onClick={() => { setStep("phone"); setCode(""); setError(undefined); }}>
        Use a different number
      </Button>
    </form>
  );
}
