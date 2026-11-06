"use client";

import { type ReactNode, useActionState, useState } from "react";
import { ConfirmIdentity } from "@/components/confirm-identity";
import { Button, FormError } from "@/components/ui";
import type { ActionResult, ShareInfo } from "./shared";

type Action = (prev: ActionResult, form: FormData) => Promise<ActionResult>;

/**
 * A form for one staff action. Shows the result, any messages to send, and,
 * when the database asks for it, the "confirm it's you" step.
 */
export function ActionForm({
  action,
  submit,
  pendingLabel = "Saving…",
  variant = "primary",
  confirm,
  hidden,
  children,
  className = "flex flex-col gap-3",
}: {
  action: Action;
  submit: string;
  pendingLabel?: string;
  variant?: "primary" | "secondary";
  /** Asks "are you sure?" before submitting. */
  confirm?: string;
  hidden?: Record<string, string>;
  children?: ReactNode;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [confirmedFor, setConfirmedFor] = useState<ActionResult>();
  const needsConfirm = state.reauth && confirmedFor !== state;

  return (
    <div className="flex flex-col gap-3">
      <form
        action={formAction}
        className={className}
        onSubmit={(e) => {
          if (confirm && !window.confirm(confirm)) e.preventDefault();
        }}
      >
        {Object.entries(hidden ?? {}).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        {children}
        <Button variant={variant} disabled={pending}>
          {pending ? pendingLabel : submit}
        </Button>
      </form>
      {needsConfirm ? (
        <>
          <FormError message={state.error} />
          <ConfirmIdentity onConfirmed={() => setConfirmedFor(state)} />
        </>
      ) : state.reauth ? (
        <p role="status" className="text-sm text-green-800 dark:text-green-300">Confirmed. Press &ldquo;{submit}&rdquo; again.</p>
      ) : (
        <FormError message={state.error} />
      )}
      {state.ok && state.notice && (
        <p role="status" className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-900 dark:bg-green-950 dark:text-green-200">
          {state.notice}
        </p>
      )}
      {state.ok && state.share?.map((s) => <ShareLinks key={s.title} share={s} />)}
    </div>
  );
}

/** Buttons that open WhatsApp, SMS or email on the admin's own device with the message filled in. */
export function ShareLinks({ share }: { share: ShareInfo }) {
  const [copied, setCopied] = useState(false);
  const text = encodeURIComponent(share.text);
  const digits = share.phone?.replace(/\D/g, "");
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-800">
      <p className="font-medium">{share.title}</p>
      <p className="text-zinc-600 dark:text-zinc-400">{share.text}</p>
      <div className="flex flex-wrap gap-2">
        {digits && (
          <>
            <a className="btn-quiet" href={`https://wa.me/${digits}?text=${text}`} target="_blank" rel="noreferrer">WhatsApp</a>
            <a className="btn-quiet" href={`sms:+${digits}?body=${text}`}>SMS</a>
          </>
        )}
        {share.email && (
          <a className="btn-quiet" href={`mailto:${share.email}?subject=${encodeURIComponent("GemLedger")}&body=${text}`}>Email</a>
        )}
        <button
          type="button"
          className="btn-quiet"
          onClick={() => navigator.clipboard?.writeText(share.text).then(() => setCopied(true))}
        >
          {copied ? "Copied" : "Copy message"}
        </button>
      </div>
    </div>
  );
}
