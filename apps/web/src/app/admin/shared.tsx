import { setShopStatus } from "./shops/actions";

export type ShopStatus = "pending" | "approved" | "suspended";

const STATUS_STYLE: Record<ShopStatus, string> = {
  pending: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  approved: "bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-200",
  suspended: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200",
};

export function StatusBadge({ status }: { status: ShopStatus }) {
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[status]}`}>{status}</span>;
}

/** Approve / Suspend buttons for one shop. */
export function ShopStatusButtons({ shopId, status }: { shopId: string; status: ShopStatus }) {
  return (
    <form action={setShopStatus} className="flex gap-2">
      <input type="hidden" name="shopId" value={shopId} />
      {status !== "approved" && (
        <button name="status" value="approved" className="rounded-lg bg-green-700 px-3 py-1.5 text-sm text-white hover:bg-green-800">
          Approve
        </button>
      )}
      {status !== "suspended" && (
        <button
          name="status"
          value="suspended"
          className="btn-quiet px-3 py-1.5 text-sm"
        >
          Suspend
        </button>
      )}
    </form>
  );
}

export function StatTile({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <span className="text-sm text-zinc-500">{label}</span>
      <span className="text-2xl font-semibold tabular-nums">{value}</span>
      {note && <span className="text-xs text-zinc-500">{note}</span>}
    </div>
  );
}

/** Simple bar chart of passports issued per week. */
export function WeeklyChart({ weeks }: { weeks: { week_start: string; issued: number; claimed: number }[] }) {
  const max = Math.max(1, ...weeks.map((w) => w.issued));
  const total = weeks.reduce((n, w) => n + w.issued, 0);
  return (
    <figure className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <figcaption className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium">Passports issued per week</span>
        <span className="text-zinc-500">{total} in the last {weeks.length} weeks</span>
      </figcaption>
      <div className="flex h-32 items-end gap-1" role="img" aria-label={`Passports issued per week: ${weeks.map((w) => w.issued).join(", ")}`}>
        {weeks.map((w) => (
          <div key={w.week_start} className="flex h-full flex-1 flex-col justify-end" title={`Week of ${weekLabel(w.week_start)}: ${w.issued} issued, ${w.claimed} claimed`}>
            <div className="rounded-t bg-gold-600 dark:bg-gold-400" style={{ height: `${(w.issued / max) * 100}%`, minHeight: w.issued ? 4 : 1 }} />
          </div>
        ))}
      </div>
      <div className="flex justify-between text-xs text-zinc-500">
        <span>{weeks[0] && weekLabel(weeks[0].week_start)}</span>
        <span>This week</span>
      </div>
    </figure>
  );
}

const dayMonth = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
function weekLabel(isoDate: string) {
  return dayMonth.format(new Date(`${isoDate}T00:00:00Z`));
}

export const dateFmt = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" });
export const rupees = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export function claimRate(claimed: number, issued: number) {
  return issued ? `${Math.round((claimed / issued) * 100)}%` : "–";
}
