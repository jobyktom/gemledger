"use client";

import { INDIAN_STATES } from "@gemledger/shared";
import { useActionState } from "react";
import { Button, Field, FormError, Input, Select } from "@/components/ui";
import { registerShop, type ShopFormState } from "./actions";

export function ShopForm() {
  const [state, action, pending] = useActionState<ShopFormState, FormData>(registerShop, {});
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="Shop name" error={fe.name}>
        <Input name="name" required maxLength={120} placeholder="Asha Jewellers" />
      </Field>
      <Field label="Registered business name" hint="Optional, if different from the shop name" error={fe.legalName}>
        <Input name="legalName" maxLength={200} />
      </Field>
      <Field label="GSTIN" hint="Optional. Helps us approve your shop faster." error={fe.gstin}>
        <Input name="gstin" maxLength={15} placeholder="32ABCDE1234F1Z5" className="uppercase" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="City" error={fe.city}>
          <Input name="city" required maxLength={80} placeholder="Kochi" />
        </Field>
        <Field label="State" error={fe.state}>
          <Select name="state" required defaultValue="">
            <option value="" disabled>Choose a state</option>
            {INDIAN_STATES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Shop phone" hint="Optional" error={fe.phone}>
        <Input name="phone" type="tel" inputMode="tel" placeholder="98765 43210" />
      </Field>
      <FormError message={state.error} />
      <Button disabled={pending}>{pending ? "Saving…" : "Register shop"}</Button>
    </form>
  );
}
