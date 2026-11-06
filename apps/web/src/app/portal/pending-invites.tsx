import { createClient } from "@/lib/supabase/server";
import { ActionForm } from "./staff/action-form";
import { acceptInvite } from "./staff/actions";
import { ROLE_LABEL } from "./staff/shared";

/**
 * Invitations that wait for the person to press Accept: becoming a shop
 * admin always needs their own say-so and a fresh sign-in code.
 */
export async function PendingInvites() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_pending_invites");
  if (error) throw error;
  if (!data?.length) return null;
  return (
    <div className="flex flex-col gap-3">
      {data.map((i) => (
        <div key={i.id} className="flex flex-col gap-3 rounded-lg border border-gold-400/60 bg-amber-50 p-4 text-sm dark:bg-amber-950/40">
          <p>
            <strong>{i.invited_by_name}</strong> at <strong>{i.shop_name}</strong> wants to make you a{" "}
            {ROLE_LABEL[i.role].toLowerCase()}. You&apos;ll be able to add and remove staff. Only accept if you expected this.
          </p>
          <ActionForm action={acceptInvite} submit="Accept" pendingLabel="Accepting…" hidden={{ inviteId: i.id }} />
        </div>
      ))}
    </div>
  );
}
