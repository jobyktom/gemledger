import { redirect } from "next/navigation";
import { getMyShop } from "@/lib/auth";
import { ShopForm } from "./shop-form";

export default async function NewShopPage() {
  if (await getMyShop()) redirect("/portal");
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Register your shop</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          We check every shop before it can issue passports. You can add items while you wait.
        </p>
      </div>
      <ShopForm />
    </div>
  );
}
