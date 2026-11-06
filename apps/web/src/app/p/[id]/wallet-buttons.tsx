/**
 * "Add to Apple Wallet" and "Add to Google Wallet". Each shows only once its
 * keys are set up on the server. Plain links: the phone does the rest.
 */
export function WalletButtons({ publicId, apple, google }: { publicId: string; apple: boolean; google: boolean }) {
  if (!apple && !google) return null;
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-gold-300 p-4 print:hidden dark:border-gold-800/70 dark:bg-emerald-deep/60">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-medium">Keep it on your phone</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Add this passport to your phone&rsquo;s wallet. It works offline and always links back to this page.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        {apple && (
          <a href={`/p/${publicId}/wallet/apple`} className="btn-gold">
            <WalletIcon />
            Add to Apple Wallet
          </a>
        )}
        {google && (
          <a href={`/p/${publicId}/wallet/google`} className="btn-gold">
            <WalletIcon />
            Add to Google Wallet
          </a>
        )}
      </div>
    </section>
  );
}

function WalletIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 10h18M16 14.5h2" strokeLinecap="round" />
      <path d="M6 6l9-3 1.5 3" strokeLinejoin="round" />
    </svg>
  );
}
