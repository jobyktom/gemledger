export default function PassportNotFound() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-3 px-4 py-16">
      <h1 className="text-2xl font-semibold">Passport not found</h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        This QR code does not match any GemLedger passport. Check the link, or ask the jeweller who issued it.
      </p>
    </main>
  );
}
