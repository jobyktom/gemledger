import type { Json } from "@/lib/supabase/database.types";
import { ACTION_LABEL, ROLE_LABEL, type Role } from "../shared";

export type ActivityEntry = {
  id: number;
  action: string;
  actor_id: string | null;
  by_platform_admin: boolean;
  target_user_id: string | null;
  target_name: string | null;
  details: Json;
  created_at: string;
};

const timeFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

function role(r: unknown): string {
  return typeof r === "string" && r in ROLE_LABEL ? ROLE_LABEL[r as Role].toLowerCase() : "";
}

function describe(e: ActivityEntry): string {
  const d = (e.details ?? {}) as Record<string, unknown>;
  const who = e.target_name ?? "someone";
  switch (e.action) {
    case "invited":
      return `Invited ${who} as ${role(d.role)} (${d.contact ?? ""})`;
    case "role_changed":
      return `Changed ${who} from ${role(d.from)} to ${role(d.to)}`;
    case "renamed":
      return d.from ? `Renamed ${d.from} to ${who}` : `Named ${who}`;
    case "login_change_requested":
      return `Asked to move ${who}'s sign-in to ${d.to ?? "a new number"}`;
    case "joined":
      return `${who} joined as ${role(d.role)}`;
    default:
      return `${ACTION_LABEL[e.action] ?? e.action} ${who}`;
  }
}

/** The staff activity log, newest first. Entries cannot be edited or deleted. */
export function ActivityList({ entries, names }: { entries: ActivityEntry[]; names: Map<string, string> }) {
  if (!entries.length) return <p className="text-sm text-zinc-500">Nothing yet.</p>;
  return (
    <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 text-sm dark:divide-zinc-800 dark:border-zinc-800">
      {entries.map((e) => {
        const actor = e.by_platform_admin
          ? "GemLedger support"
          : e.actor_id
            ? (names.get(e.actor_id) ?? "Former staff")
            : "System";
        const selfAction = ["joined", "login_changed", "admin_accepted"].includes(e.action);
        return (
          <li key={e.id} className="flex flex-col gap-0.5 px-4 py-2 sm:flex-row sm:gap-4">
            <span className="shrink-0 text-zinc-500 sm:w-44">{timeFmt.format(new Date(e.created_at))}</span>
            <span>
              {describe(e)}
              {!selfAction && <span className="text-zinc-500"> · by {actor}</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
