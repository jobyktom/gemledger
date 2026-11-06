"use client";

import { IndianMobile } from "@gemledger/shared";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { z } from "zod";
import { Button, Field, FormError, Input } from "@/components/ui";
import { safeNext } from "@/lib/safe-next";
import { createClient } from "@/lib/supabase/client";


type Method = "phone" | "email";

/**
 * Pre-launch only: the test shop's number is filled in so testers can sign in
 * quickly. Before going live, set NEXT_PUBLIC_LOGIN_PREFILL_PHONE to an empty
 * value (or "off") and rebuild, or delete this constant.
 */
const PREFILL_PHONE = (() => {
  const v = process.env.NEXT_PUBLIC_LOGIN_PREFILL_PHONE;
  if (v === undefined) return "99999 00001";
  return v === "off" ? "" : v;
})();
const EmailAddress = z.email("Enter a valid email address").transform((s) => s.trim().toLowerCase());

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [method, setMethod] = useState<Method>("phone");
  const [step, setStep] = useState<"address" | "code">("address");
  const [phone, setPhone] = useState(PREFILL_PHONE);
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | undefined>(
    params.get("error") === "link" ? "That sign-in link has already been used or has expired. Request a new one, then open the newest email only." : undefined,
  );
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
      // The default Supabase email holds a sign-in link, not a code.
      const callback = new URL("/auth/callback", window.location.origin);
      callback.searchParams.set("next", safeNext(params.get("next")));
      result = await auth.signInWithOtp({ email: target, options: { emailRedirectTo: callback.toString() } });
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
    const { error } = await auth.verifyOtp({ phone: sentTo, token, type: "sms" });
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
        <Button disabled={busy}>{busy ? "Sending…" : method === "phone" ? "Send code" : "Email me a sign-in link"}</Button>
      </form>
    );
  }

  if (method === "email") {
    return (
      <div className="flex flex-col gap-4">
        <p>
          We sent a sign-in link to <strong>{sentTo}</strong>. Open it on this device, in this browser, to finish signing
          in. The link works once and expires in an hour. Each new request cancels the links sent before it.
        </p>
        <p className="text-sm text-zinc-500">No email? Check your spam folder, or wait a minute and try again.</p>
        <Button type="button" variant="secondary" onClick={() => { setStep("address"); setError(undefined); }}>
          Use a different email
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={verify} className="flex flex-col gap-4">
      <Field label={`Code sent to ${sentTo.replace("+91", "+91 ")}`}>
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
        Use a different number
      </Button>
    </form>
  );
}
