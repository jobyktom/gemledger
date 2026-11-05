import Link from "next/link";
import type { ReactNode } from "react";
import { getMyShop } from "@/lib/auth";
import { signOut } from "./actions";

export default async function PortalLayout({ children }: { children: ReactNode }) {
  const shop = await getMyShop();
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/portal" className="font-semibold">
            GemLedger{shop && <span className="font-normal text-zinc-500"> · {shop.name}</span>}
          </Link>
          <form action={signOut}>
            <button className="text-sm text-zinc-600 hover:underline dark:text-zinc-400">Sign out</button>
          </form>
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-8">{children}</div>
    </div>
  );
}
