"use client";

import { useState, useTransition } from "react";
import { Button, FormError } from "@/components/ui";
import { issuePassport } from "./actions";

export function IssueButton({ itemId, disabledReason }: { itemId: string; disabledReason?: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  return (
    <div className="flex flex-col gap-2">
      <Button
        disabled={pending || Boolean(disabledReason)}
        onClick={() => start(async () => setError((await issuePassport(itemId)).error))}
      >
        {pending ? "Issuing…" : "Issue passport"}
      </Button>
      {disabledReason && <p className="text-sm text-zinc-500">{disabledReason}</p>}
      <FormError message={error} />
    </div>
  );
}
