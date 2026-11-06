"use client";

import { useState } from "react";
import { Field, Input, Select } from "@/components/ui";
import { ActionForm } from "./action-form";
import { changeLogin, inviteStaff } from "./actions";

/** Mobile-or-email picker; posts method + phone or email. */
export function ContactFields({ label = "Signs in with" }: { label?: string }) {
  const [method, setMethod] = useState<"phone" | "email">("phone");
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1.5 text-sm font-medium tracking-wide text-zinc-700 dark:text-zinc-300">{label}</legend>
      <input type="hidden" name="method" value={method} />
      <div className="flex gap-4 text-sm">
        {(["phone", "email"] as const).map((m) => (
          <label key={m} className="flex items-center gap-1.5">
            <input type="radio" checked={method === m} onChange={() => setMethod(m)} />
            {m === "phone" ? "Mobile number" : "Email"}
          </label>
        ))}
      </div>
      {method === "phone" ? (
        <Input name="phone" type="tel" inputMode="tel" placeholder="98765 43210" aria-label="Mobile number" required />
      ) : (
        <Input name="email" type="email" inputMode="email" placeholder="name@example.com" aria-label="Email" required />
      )}
    </fieldset>
  );
}

export function AddStaffForm() {
  return (
    <ActionForm action={inviteStaff} submit="Send invitation" pendingLabel="Inviting…">
      <Field label="Name">
        <Input name="name" maxLength={80} autoComplete="off" required />
      </Field>
      <Field label="Role" hint="Shop admins can add and remove people. Making one needs a fresh sign-in code.">
        <Select name="role" defaultValue="staff">
          <option value="staff">Staff: add items and issue passports</option>
          <option value="manager">Manager: also edit shop details and delete documents</option>
          <option value="owner">Shop admin: everything, including staff</option>
        </Select>
      </Field>
      <ContactFields />
    </ActionForm>
  );
}

export function ChangeLoginForm({ userId }: { userId: string }) {
  return (
    <ActionForm
      action={changeLogin}
      submit="Change sign-in"
      pendingLabel="Requesting…"
      hidden={{ userId }}
      confirm="Change how this person signs in? The new number or email must sign in before the change takes effect."
    >
      <ContactFields label="New mobile number or email" />
    </ActionForm>
  );
}
