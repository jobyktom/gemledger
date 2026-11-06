-- Super admin dashboard: platform admins can READ every shop's data, so they
-- never need to sign in as a jeweller. Writes are unchanged: admins can still
-- only change a shop's details and status (see 20261105170000).

-- ---------------------------------------------------------------- read access
create policy "platform admins read all members" on public.shop_members for select to authenticated
  using (private.is_platform_admin());
create policy "platform admins read all items" on public.items for select to authenticated
  using (private.is_platform_admin());
create policy "platform admins read all huids" on public.item_huids for select to authenticated
  using (private.is_platform_admin());
create policy "platform admins read all reports" on public.grading_reports for select to authenticated
  using (private.is_platform_admin());
create policy "platform admins read all documents" on public.documents for select to authenticated
  using (private.is_platform_admin());
create policy "platform admins read all passports" on public.passports for select to authenticated
  using (private.is_platform_admin());
create policy "platform admins read all shop files" on storage.objects for select to authenticated
  using (bucket_id = 'item-files' and private.is_platform_admin());

-- ---------------------------------------------------------------- stats
-- One row per shop with its counts. Months follow Indian time.
create function public.admin_shop_stats()
returns table (
  shop_id            uuid,
  name               text,
  city               text,
  state              text,
  gstin              text,
  phone              text,
  status             public.shop_status,
  created_at         timestamptz,
  members            bigint,
  items              bigint,
  passports_issued   bigint,
  passports_claimed  bigint,
  passports_revoked  bigint,
  issued_this_month  bigint,
  last_activity_at   timestamptz
)
language plpgsql stable security invoker set search_path = ''
as $$
declare
  v_month_start timestamptz := date_trunc('month', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata';
begin
  if not private.is_platform_admin() then
    raise exception 'only GemLedger admins can view platform statistics' using errcode = '42501';
  end if;
  return query
  select s.id, s.name, s.city, s.state, s.gstin, s.phone, s.status, s.created_at,
         (select count(*) from public.shop_members m where m.shop_id = s.id),
         (select count(*) from public.items i where i.shop_id = s.id),
         (select count(*) from public.passports p where p.shop_id = s.id),
         (select count(*) from public.passports p where p.shop_id = s.id and p.claimed_at is not null),
         (select count(*) from public.passports p where p.shop_id = s.id and p.status = 'revoked'),
         (select count(*) from public.passports p where p.shop_id = s.id and p.issued_at >= v_month_start),
         greatest(s.created_at,
                  (select max(i.created_at) from public.items i where i.shop_id = s.id),
                  (select max(p.issued_at) from public.passports p where p.shop_id = s.id))
  from public.shops s
  order by s.created_at desc;
end;
$$;

-- Passports issued and claimed per week (weeks start Monday, Indian time).
create function public.admin_weekly_passports(p_weeks integer default 12, p_shop uuid default null)
returns table (week_start date, issued bigint, claimed bigint)
language plpgsql stable security invoker set search_path = ''
as $$
declare
  v_first date := (date_trunc('week', now() at time zone 'Asia/Kolkata'))::date - 7 * (least(greatest(p_weeks, 1), 104) - 1);
begin
  if not private.is_platform_admin() then
    raise exception 'only GemLedger admins can view platform statistics' using errcode = '42501';
  end if;
  return query
  select w::date,
         (select count(*) from public.passports p
           where (p_shop is null or p.shop_id = p_shop)
             and (p.issued_at at time zone 'Asia/Kolkata')::date >= w::date
             and (p.issued_at at time zone 'Asia/Kolkata')::date < w::date + 7),
         (select count(*) from public.passports p
           where (p_shop is null or p.shop_id = p_shop)
             and (p.claimed_at at time zone 'Asia/Kolkata')::date >= w::date
             and (p.claimed_at at time zone 'Asia/Kolkata')::date < w::date + 7)
  from generate_series(v_first, (date_trunc('week', now() at time zone 'Asia/Kolkata'))::date, interval '7 days') as w
  order by 1;
end;
$$;

-- Who works at a shop. Sign-in details live in auth.users, which the API
-- cannot read, so this runs as definer after checking the caller is an admin.
create function public.admin_shop_members(p_shop uuid)
returns table (user_id uuid, role public.shop_role, email text, phone text, joined_at timestamptz, last_sign_in_at timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.is_platform_admin() then
    raise exception 'only GemLedger admins can view shop members' using errcode = '42501';
  end if;
  return query
  select m.user_id, m.role, u.email::text, u.phone::text, m.created_at, u.last_sign_in_at
  from public.shop_members m
  join auth.users u on u.id = m.user_id
  where m.shop_id = p_shop
  order by m.created_at;
end;
$$;

revoke execute on function public.admin_shop_stats() from public, anon;
revoke execute on function public.admin_weekly_passports(integer, uuid) from public, anon;
revoke execute on function public.admin_shop_members(uuid) from public, anon;
grant execute on function public.admin_shop_stats() to authenticated;
grant execute on function public.admin_weekly_passports(integer, uuid) to authenticated;
grant execute on function public.admin_shop_members(uuid) to authenticated;
