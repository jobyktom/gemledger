-- Keep security-definer helpers out of the API-exposed public schema, so
-- they can't be called through /rest/v1/rpc. Policies and triggers refer to
-- functions by OID, so they keep working after the move.
-- public.get_public_passport stays public on purpose: it powers the verify page.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

alter function public.is_shop_member(uuid, public.shop_role[]) set schema private;
alter function public.is_shop_approved(uuid) set schema private;
alter function public.handle_new_shop() set schema private;
alter function public.check_item_shop() set schema private;
alter function public.guard_shop_status() set schema private;
alter function public.touch_updated_at() set schema private;

-- Trigger functions are never called directly.
revoke execute on function private.handle_new_shop() from public, anon, authenticated;
revoke execute on function private.check_item_shop() from public, anon, authenticated;
revoke execute on function private.guard_shop_status() from public, anon, authenticated;
revoke execute on function private.touch_updated_at() from public, anon, authenticated;

-- Policy helpers run as the signed-in user, so they need execute.
revoke execute on function private.is_shop_member(uuid, public.shop_role[]) from public, anon;
revoke execute on function private.is_shop_approved(uuid) from public, anon;
grant execute on function private.is_shop_member(uuid, public.shop_role[]) to authenticated;
grant execute on function private.is_shop_approved(uuid) to authenticated;
