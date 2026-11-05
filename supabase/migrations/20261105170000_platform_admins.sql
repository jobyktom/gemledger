-- GemLedger staff who approve shops. Rows are added by hand in the SQL editor
-- (service role); there is no API to grant yourself admin.
create table private.platform_admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create function private.is_platform_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from private.platform_admins a where a.user_id = (select auth.uid()));
$$;
revoke execute on function private.is_platform_admin() from public, anon;
grant execute on function private.is_platform_admin() to authenticated;

-- Shop status may now be changed by the service role or a platform admin.
create or replace function private.guard_shop_status()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and new.status <> 'pending'
     and auth.role() <> 'service_role' and not private.is_platform_admin() then
    raise exception 'new shops start as pending';
  end if;
  if tg_op = 'UPDATE' and new.status is distinct from old.status
     and auth.role() <> 'service_role' and not private.is_platform_admin() then
    raise exception 'only GemLedger admins can change a shop''s status';
  end if;
  return new;
end;
$$;

-- Admins see every shop (to review them) and may update any shop.
create policy "platform admins read all shops" on public.shops for select to authenticated
  using (private.is_platform_admin());
create policy "platform admins update shops" on public.shops for update to authenticated
  using (private.is_platform_admin()) with check (private.is_platform_admin());

-- Lets the web app show the admin screen only to admins.
create function public.am_platform_admin()
returns boolean
language sql stable security invoker set search_path = ''
as $$ select private.is_platform_admin(); $$;
revoke execute on function public.am_platform_admin() from public, anon;
grant execute on function public.am_platform_admin() to authenticated;
