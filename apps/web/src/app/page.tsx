import { verificationLabels, VerificationStatus } from "@gemledger/shared";
import type { ReactNode } from "react";

const FEATURES: { title: string; note: string; icon: ReactNode }[] = [
  {
    title: "BIS hallmark",
    note: "HUID recorded per piece",
    icon: <path d="M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6l-8-3Zm-3.5 9 2.5 2.5 4.5-5" />,
  },
  {
    title: "Grading reports",
    note: "Checked with the lab where possible",
    icon: <path d="M7 3h7l4 4v14H7V3Zm7 0v4h4M10 12h5M10 15.5h5M10 8.5h2" />,
  },
  {
    title: "Invoice & warranty",
    note: "Kept with the piece",
    icon: <path d="M4 8h16v12H4V8Zm8 0v12M4 12h16M12 8c-1.5-3-5-3.5-5-1.5S10 8 12 8Zm0 0c1.5-3 5-3.5 5-1.5S14 8 12 8Z" />,
  },
  {
    title: "QR passport",
    note: "Opens on any phone",
    icon: <path d="M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 0h2v2h-2v-2Zm4 0h2v2h-2v-2Zm-4 4h2v2h-2v-2Zm4 0h2v2h-2v-2Z" />,
  },
];

/** Line drawing of a brilliant-cut stone, used as decoration only. */
function Brilliant({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 180" fill="none" stroke="currentColor" strokeWidth="0.9" aria-hidden className={className}>
      <path d="M40 12h120l38 46-98 118L2 58 40 12Z" />
      <path d="M2 58h196M40 12l22 46 38-46 38 46 22-46M62 58l38 118 38-118M2 58l98 118 98-118" />
      <path d="M62 58 81 12M138 58 119 12" opacity="0.6" />
    </svg>
  );
}

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <span className="brand text-lg">GemLedger</span>
          <a href="/portal" className="text-sm tracking-wide text-zinc-600 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-gold-300">
            Jeweller sign in
          </a>
        </div>
      </header>

      <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 md:grid-cols-[1.2fr_1fr] md:py-24">
        <div className="flex flex-col gap-6">
          <p className="eyebrow">Digital jewellery passports</p>
          <h1 className="text-4xl leading-[1.1] sm:text-5xl md:text-6xl">
            Every piece, with its story kept safe
          </h1>
          <p className="max-w-lg text-lg text-zinc-600 dark:text-zinc-300">
            Issued by your jeweller. Your hallmark (HUID), lab reports, invoice and warranty, kept together on your
            phone.
          </p>
          <div className="flex flex-wrap items-center gap-4 pt-2">
            <a href="/portal" className="btn-gold">
              Jeweller sign in <span aria-hidden>→</span>
            </a>
          </div>
        </div>
        <div className="relative hidden justify-center md:flex">
          <div className="absolute inset-0 rounded-full bg-emerald-glow/40 blur-3xl" aria-hidden />
          <Brilliant className="relative w-full max-w-sm text-gold-600 dark:text-gold-400" />
        </div>
      </section>

      <section className="border-y border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-emerald-deep/70">
        <ul className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-6 px-4 py-8 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <li key={f.title} className="flex items-center gap-4">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinejoin="round"
                strokeLinecap="round"
                aria-hidden
                className="size-8 shrink-0 text-gold-600 dark:text-gold-400"
              >
                {f.icon}
              </svg>
              <div className="flex flex-col">
                <span className="font-medium">{f.title}</span>
                <span className="text-sm text-zinc-600 dark:text-zinc-400">{f.note}</span>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-16 sm:px-6">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl sm:text-3xl">How each record is labelled</h2>
          <span className="hidden h-px w-16 bg-gold-600 sm:block dark:bg-gold-400" aria-hidden />
        </div>
        <p className="max-w-2xl text-zinc-600 dark:text-zinc-400">
          A passport always says where each detail came from, so an uploaded document is never mistaken for one we
          checked with the lab.
        </p>
        <ul className="flex flex-wrap gap-2">
          {VerificationStatus.options.map((s) => (
            <li
              key={s}
              className="rounded-full border border-zinc-300 px-4 py-1.5 text-sm dark:border-gold-400/40 dark:text-zinc-200"
            >
              {verificationLabels[s]}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
