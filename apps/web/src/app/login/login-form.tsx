"use client";

import { IndianMobile } from "@gemledger/shared";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { z } from "zod";
import { Button, Field, FormError, Input } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

/** Only allow redirects back into our own portal. */
function safeNext(next: string | null) {
  return next && /^\/(portal|admin)(\/|$)/.test(next) ? next : "/portal";
}

type Method = "phone" | "email";
const EmailAddress = z.email("Enter a valid email address").transform((s) => s.trim().toLowerCase());

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [method, setMethod] = useState<Method>("phone");
  const [step, setStep] = useState<"address" | "code">("address");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    const auth = createClient().auth;
    let target: string;
    let result;
    if (method === "phone") {
      const parsed = IndianMobile.safeParse(phone);
      if (!parsed.success) return setError(parsed.error.issues[0]?.message);
      target = parsed.data;
      setBusy(true);
      result = await auth.signInWithOtp({ phone: target });
    } else {
      const parsed = EmailAddress.safeParse(email);
      if (!parsed.success) return setError(parsed.error.issues[0]?.message);
      target = parsed.data;
      setBusy(true);
      result = await auth.signInWithOtp({ email: target });
    }
    setBusy(false);
    if (result.error) return setError(result.error.message);
    setSentTo(target);
    setStep("code");
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    setBusy(true);
    const auth = createClient().auth;
    const token = code.trim();
    const { error } =
      method === "phone"
        ? await auth.verifyOtp({ phone: sentTo, token, type: "sms" })
        : await auth.verifyOtp({ email: sentTo, token, type: "email" });
    setBusy(false);
    if (error) return setError("That code didn't work. Check it, or request a new one.");
    router.replace(safeNext(params.get("next")));
    router.refresh();
  }

  function switchMethod(next: Method) {
    setMethod(next);
    setError(undefined);
  }

  if (step === "address") {
    return (
      <form onSubmit={sendCode} className="flex flex-col gap-4">
        <div role="tablist" aria-label="Sign in with" className="grid grid-cols-2 rounded-md border border-zinc-300 p-1 text-sm dark:border-zinc-700">
          {(["phone", "email"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={method === m}
              onClick={() => switchMethod(m)}
              className={`rounded px-3 py-1.5 ${method === m ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "text-zinc-600 dark:text-zinc-400"}`}
            >
              {m === "phone" ? "Mobile" : "Email"}
            </button>
          ))}
        </div>
        {method === "phone" ? (
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
        ) : (
          <Field label="Email address">
            <Input
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </Field>
        )}
        <FormError message={error} />
        <Button disabled={busy}>{busy ? "Sending…" : "Send code"}</Button>
      </form>
    );
  }

  return (
    <form onSubmit={verify} className="flex flex-col gap-4">
      <Field label={`Code sent to ${method === "phone" ? sentTo.replace("+91", "+91 ") : sentTo}`}>
        <Input
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6,10}"
          maxLength={10}
          placeholder="Code"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          required
          autoFocus
        />
      </Field>
      <FormError message={error} />
      <Button disabled={busy || code.length < 6}>{busy ? "Checking…" : "Verify and sign in"}</Button>
      <Button
        type="button"
        variant="secondary"
        onClick={() => {
          setStep("address");
          setCode("");
          setError(undefined);
        }}
      >
        {method === "phone" ? "Use a different number" : "Use a different email"}
      </Button>
    </form>
  );
}
