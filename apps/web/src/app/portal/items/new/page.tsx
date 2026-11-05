import Link from "next/link";
import { requireMyShop } from "@/lib/auth";
import { ItemForm } from "./item-form";

export default async function NewItemPage() {
  await requireMyShop();
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link href="/portal" className="text-sm text-zinc-500 hover:underline">← All items</Link>
        <h1 className="text-2xl font-semibold">Add an item</h1>
      </div>
      <ItemForm />
    </div>
  );
}
