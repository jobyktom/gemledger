import { verificationLabels, VerificationStatus } from "@gemledger/shared";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-16">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">GemLedger</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Digital jewellery passports issued by your jeweller. Your hallmark (HUID),
          lab reports, invoice and warranty, kept together on your phone.
        </p>
      </header>
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">How each record is labelled</h2>
        <ul className="flex flex-wrap gap-2">
          {VerificationStatus.options.map((s) => (
            <li
              key={s}
              className="rounded-full border border-zinc-300 px-3 py-1 text-sm dark:border-zinc-700"
            >
              {verificationLabels[s]}
            </li>
          ))}
        </ul>
      </section>
      <a href="/portal" className="self-start rounded-lg bg-amber-700 px-4 py-2.5 font-medium text-white hover:bg-amber-800">
        Jeweller sign in
      </a>
    </main>
  );
}
