import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getLostAccess, getMyShop } from "@/lib/auth";

export const metadata: Metadata = { title: "No access · GemLedger" };

export default async function NoAccessPage() {
  if (await getMyShop()) redirect("/portal");
  const lost = await getLostAccess();
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">{lost === "suspended" ? "Your access is paused" : "You no longer have access"}</h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        {lost === "suspended"
          ? "A shop admin has suspended your access to their shop. Ask them if you think this is a mistake."
          : "A shop admin has removed you from their shop. Your own jewellery passports, if you have any, are not affected."}
      </p>
      <p className="text-sm text-zinc-500">
        Own a shop yourself? <Link href="/portal/shop/new" className="underline">Register it here</Link>.
      </p>
    </div>
  );
}
