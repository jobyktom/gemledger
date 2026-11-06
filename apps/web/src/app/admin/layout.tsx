import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { isPlatformAdmin } from "@/lib/auth";
import { signOut } from "../portal/actions";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  // Non-admins get a 404 rather than learning these pages exist.
  if (!(await isPlatformAdmin())) notFound();
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <nav className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 text-sm">
          <Link href="/admin" className="brand text-base">
            GemLedger <span className="font-normal text-zinc-500">admin</span>
          </Link>
          <Link href="/admin" className="hover:underline">Dashboard</Link>
          <Link href="/admin/shops" className="hover:underline">Approvals</Link>
          <Link href="/portal" className="hover:underline">My shop</Link>
          <form action={signOut} className="ml-auto">
            <button className="text-zinc-600 hover:underline dark:text-zinc-400">Sign out</button>
          </form>
        </nav>
      </header>
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-8">{children}</div>
    </div>
  );
}
