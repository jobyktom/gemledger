"use client";

export function PrintButton() {
  return (
    <button onClick={() => window.print()} className="rounded-lg border border-zinc-300 px-4 py-2.5 hover:bg-zinc-100 print:hidden dark:border-zinc-700 dark:hover:bg-zinc-800">
      Print QR card
    </button>
  );
}
