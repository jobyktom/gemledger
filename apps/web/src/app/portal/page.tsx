import Link from "next/link";
import { requireMyShop } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const PAGE_SIZE = 50;
const KARAT_LABEL: Record<number, string> = { 24: "24K", 23: "23K", 22: "22K", 20: "20K", 18: "18K", 14: "14K" };

export default async function PortalHome({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; photoFailures?: string; page?: string }>;
}) {
  const shop = await requireMyShop();
  const { saved, photoFailures, page: pageParam } = await searchParams;
  const page = Math.max(1, Math.floor(Number(pageParam)) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const supabase = await createClient();

  const { data: rows, error } = await supabase
    .from("items")
    .select("id, title, metal, karat, gross_weight_g, created_at, item_huids (huid), documents (storage_path, kind), passports (status)")
    .eq("shop_id", shop.id)
    .order("created_at", { ascending: false })
    .order("id")
    // One extra row tells us whether there is a next page.
    .range(from, from + PAGE_SIZE);
  if (error) throw error;
  const hasNext = (rows?.length ?? 0) > PAGE_SIZE;
  const items = rows?.slice(0, PAGE_SIZE);

  // One thumbnail per item, via short-lived signed URLs (the bucket is private).
  const firstPhotos = (items ?? [])
    .map((i) => i.documents.find((d) => d.kind === "photo")?.storage_path)
    .filter((p): p is string => Boolean(p));
  const thumbs = new Map<string, string>();
  if (firstPhotos.length) {
    const { data } = await supabase.storage.from("item-files").createSignedUrls(firstPhotos, 600);
    for (const s of data ?? []) if (s.path && s.signedUrl) thumbs.set(s.path, s.signedUrl);
  }

  return (
    <div className="flex flex-col gap-6">
      {shop.status === "pending" && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <strong>Your shop is waiting for approval.</strong> You can add items now; issuing passports opens once we&apos;ve
          checked your shop.
        </p>
      )}
      {shop.status === "suspended" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
          Your shop is suspended. Please contact GemLedger support.
        </p>
      )}
      {saved && (
        <p role="status" className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-900 dark:bg-green-950 dark:text-green-200">
          Item saved.
          {photoFailures && ` ${photoFailures} photo(s) didn't upload; you can add them again later.`}
        </p>
      )}

      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Items</h1>
        <Link href="/portal/items/new" className="rounded-lg bg-amber-700 px-4 py-2.5 font-medium text-white hover:bg-amber-800">
          Add item
        </Link>
      </div>

      {!items?.length ? (
        <p className="rounded-lg border border-dashed border-zinc-300 px-4 py-10 text-center text-zinc-500 dark:border-zinc-700">
          {page === 1 ? "No items yet. Add your first piece to start issuing passports." : "No more items."}
        </p>
      ) : (
        <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {items.map((item) => {
            const photo = item.documents.find((d) => d.kind === "photo")?.storage_path;
            const thumb = photo ? thumbs.get(photo) : undefined;
            const passport = item.passports.find((p) => p.status !== "revoked");
            return (
              <li key={item.id} className="flex items-center gap-4 px-4 py-3">
                {thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element -- signed URLs expire; skip the image optimiser
                  <img src={thumb} alt="" className="size-14 shrink-0 rounded-md object-cover" />
                ) : (
                  <div className="size-14 shrink-0 rounded-md bg-zinc-100 dark:bg-zinc-800" />
                )}
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium">{item.title}</span>
                  <span className="text-sm text-zinc-500">
                    {item.metal === "gold" && item.karat ? `${KARAT_LABEL[item.karat] ?? `${item.karat}K`} gold` : item.metal}
                    {" · "}
                    {Number(item.gross_weight_g).toFixed(3)} g
                    {item.item_huids.length > 0 && ` · HUID ${item.item_huids.map((h) => h.huid).join(", ")}`}
                  </span>
                </div>
                <span className="shrink-0 text-xs text-zinc-500">{passport ? `Passport ${passport.status}` : "No passport yet"}</span>
              </li>
            );
          })}
        </ul>
      )}

      {(page > 1 || hasNext) && (
        <nav className="flex items-center justify-between text-sm" aria-label="Pages">
          {page > 1 ? (
            <Link href={page === 2 ? "/portal" : `/portal?page=${page - 1}`} className="hover:underline">← Newer</Link>
          ) : <span />}
          <span className="text-zinc-500">Page {page}</span>
          {hasNext ? (
            <Link href={`/portal?page=${page + 1}`} className="hover:underline">Older →</Link>
          ) : <span />}
        </nav>
      )}
    </div>
  );
}
