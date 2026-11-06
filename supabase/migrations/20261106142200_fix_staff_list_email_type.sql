-- auth.users.email is varchar(255), so staff_list's RETURN QUERY failed with
-- "structure of query does not match function result type". Cast to text.
create or replace function public.staff_list(p_shop uuid, p_include_removed boolean default false)
returns table (
  user_id uuid, display_name text, role public.shop_role, status public.member_status,
  contact text, joined_at timestamptz, last_sign_in_at timestamptz, is_me boolean)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_admin boolean := private.is_active_member(p_shop, array['owner']::public.shop_role[]);
begin
  if not private.is_active_member(p_shop) then
    raise exception 'not a member of this shop' using errcode = '42501';
  end if;
  return query
  select m.user_id, m.display_name, m.role, m.status,
         case when v_admin then coalesce(u.email::text, '+' || u.phone) end,
         m.created_at,
         case when v_admin then u.last_sign_in_at end,
         m.user_id = (select auth.uid())
  from public.shop_members m left join auth.users u on u.id = m.user_id
  where m.shop_id = p_shop
    and (m.status <> 'removed' or (p_include_removed and v_admin))
  order by m.status, m.role, coalesce(m.display_name, u.email::text, u.phone);
end;
$$;
