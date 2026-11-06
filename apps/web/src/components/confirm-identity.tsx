"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, Field, FormError, Input } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

/**
 * Step-up check before a sensitive action (adding or removing a shop admin,
 * changing someone's sign-in). Sends a fresh code to the signed-in user's own
 * phone, or a fresh link to their email. The database accepts the action only
 * within 10 minutes of that.
 */
export function ConfirmIdentity({ onConfirmed }: { onConfirmed: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const [target, setTarget] = useState<{ phone?: string; email?: string } | null>(null);
  const [step, setStep] = useState<"start" | "code" | "emailed">("start");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => setTarget({ phone: data.user?.phone || undefined, email: data.user?.email || undefined }));
  }, []);

  if (!target) return null;
  const phone = target.phone ? `+${target.phone.replace(/^\+/, "")}` : undefined;

  async function send() {
    setError(undefined);
    setBusy(true);
    const auth = createClient().auth;
    if (phone) {
      const { error } = await auth.signInWithOtp({ phone, options: { shouldCreateUser: false } });
      setBusy(false);
      if (error) return setError(error.message);
      setStep("code");
    } else if (target?.email) {
      const callback = new URL("/auth/callback", window.location.origin);
      callback.searchParams.set("next", pathname);
      const { error } = await auth.signInWithOtp({
        email: target.email,
        options: { shouldCreateUser: false, emailRedirectTo: callback.toString() },
      });
      setBusy(false);
      if (error) return setError(error.message);
      setStep("emailed");
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (!phone) return;
    setBusy(true);
    const { error } = await createClient().auth.verifyOtp({ phone, token: code.trim(), type: "sms" });
    setBusy(false);
    if (error) return setError("That code didn't work. Check it, or send a new one.");
    router.refresh();
    onConfirmed();
  }

  const masked = phone ? `${phone.slice(0, 5)}•••••${phone.slice(-3)}` : target.email;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
      <p className="font-medium">Confirm it&apos;s you</p>
      {step === "start" && (
        <>
          <p>We&apos;ll send a one-time {phone ? "code" : "sign-in link"} to {masked}.</p>
          <Button type="button" onClick={send} disabled={busy}>{busy ? "Sending…" : phone ? "Send code" : "Email me a link"}</Button>
        </>
      )}
      {step === "code" && (
        <form onSubmit={verify} className="flex flex-col gap-3">
          <Field label={`Code sent to ${masked}`}>
            <Input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={10}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              autoFocus
              required
            />
          </Field>
          <Button disabled={busy || code.length < 6}>{busy ? "Checking…" : "Confirm"}</Button>
        </form>
      )}
      {step === "emailed" && (
        <p>
          We emailed a link to {masked}. Open it on this device, in this browser. It brings you back here; then press the
          button again within 10 minutes.
        </p>
      )}
      <FormError message={error} />
    </div>
  );
}
