-- Shop staff management: shop admins (role 'owner') add, suspend and remove
-- staff, change their role or name, and change the phone or email they sign
-- in with. There are no passwords, so the sign-in phone or email IS the
-- account; changing it is treated as the most sensitive action.
--
-- Design:
-- * shop_members rows are never deleted. A person who leaves is 'removed', so
--   items and passports they created still point at a named record.
-- * Staff join through shop_invites. An invite names an exact phone or email
--   and is accepted only by a user who has VERIFIED that phone or email with
--   Supabase Auth. There is no secret link to leak or forward.
-- * Invites that grant the shop admin role are never accepted automatically:
--   the person must press Accept within 10 minutes of a fresh sign-in code.
-- * All writes go through the security-definer functions below. The old
--   "owners manage staff" policy, which let an owner write any row (including
--   removing themselves), is dropped.
-- * Every change is written to staff_activity_log, which cannot be edited.

-- ---------------------------------------------------------------- members
create type public.member_status as enum ('active', 'suspended', 'removed');

alter table public.shop_members
  add column display_name      text check (display_name is null or length(trim(display_name)) between 1 and 80),
  add column status            public.member_status not null default 'active',
  add column invited_by        uuid references auth.users (id) on delete set null,
  add column status_changed_at timestamptz,
  add column status_changed_by uuid references auth.users (id) on delete set null;

drop policy "owners manage staff" on public.shop_members;
revoke insert, update, delete, truncate on public.shop_members from anon, authenticated;

-- True when the caller entered a sign-in code (or opened a sign-in link)
-- within the last p_seconds. Supabase records this in the token's amr claim,
-- and it does not change when the token is refreshed.
create function private.verified_recently(p_seconds integer default 600)
returns boolean
language sql stable set search_path = ''
as $$
  select coalesce(
    (select max((a ->> 'timestamp')::bigint)
       from jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) as a),
    0) >= extract(epoch from now())::bigint - p_seconds;
$$;
revoke execute on function private.verified_recently(integer) from public, anon;
grant execute on function private.verified_recently(integer) to authenticated;

-- Membership now means: an ACTIVE member of a shop that is not suspended,
-- and, for staff and managers, signed in within the last 12 hours (shop
-- counters are shared devices).
-- Every existing policy (items, documents, passports, storage) calls this
-- function by OID, so suspending or removing someone takes effect on their
-- very next request.
create or replace function private.is_shop_member(p_shop uuid, p_roles public.shop_role[] default null)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.shop_members m
    join public.shops s on s.id = m.shop_id
    where m.shop_id = p_shop
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and s.status <> 'suspended'
      and (m.role = 'owner' or private.verified_recently(43200))
      and (p_roles is null or m.role = any (p_roles))
  );
$$;

-- Active membership regardless of the shop's status. Lets a suspended shop
-- still see its own name and lets its admin offboard people.
create function private.is_active_member(p_shop uuid, p_roles public.shop_role[] default null)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.shop_members m
    where m.shop_id = p_shop
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and (p_roles is null or m.role = any (p_roles))
  );
$$;
revoke execute on function private.is_active_member(uuid, public.shop_role[]) from public, anon;
grant execute on function private.is_active_member(uuid, public.shop_role[]) to authenticated;

create policy "members read their shop even when suspended" on public.shops for select to authenticated
  using (private.is_active_member(id));
create policy "people read their own memberships" on public.shop_members for select to authenticated
  using (user_id = (select auth.uid()));

create function private.require_recent_verification()
returns void
language plpgsql stable set search_path = ''
as $$
begin
  if not private.verified_recently(600) then
    raise exception 'reauth_required'
      using errcode = '42501', hint = 'Confirm it is you with a fresh sign-in code, then try again.';
  end if;
end;
$$;
revoke execute on function private.require_recent_verification() from public, anon;
grant execute on function private.require_recent_verification() to authenticated;

-- ---------------------------------------------------------------- invites
create table public.shop_invites (
  id                uuid primary key default gen_random_uuid(),
  shop_id           uuid not null references public.shops (id) on delete cascade,
  display_name      text not null check (length(trim(display_name)) between 1 and 80),
  role              public.shop_role not null,
  -- Exactly one way to recognise the invitee:
  phone             text check (phone ~ '^91[6-9][0-9]{9}$'),            -- as Supabase stores it, no "+"
  email             text check (email = lower(email) and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  for_user_id       uuid references auth.users (id) on delete cascade,   -- existing member offered the admin role
  -- Set when this invite changes an existing member's sign-in phone or email.
  replaces_user_id  uuid references auth.users (id) on delete set null,
  invited_by        uuid references auth.users (id) on delete set null,
  by_platform_admin boolean not null default false,
  created_at        timestamptz not null default now(),
  expires_at        timestamptz not null default now() + interval '7 days',
  accepted_at       timestamptz,
  accepted_by       uuid references auth.users (id) on delete set null,
  cancelled_at      timestamptz,
  cancelled_by      uuid references auth.users (id) on delete set null,
  check (num_nonnulls(phone, email, for_user_id) = 1),
  check (accepted_at is null or cancelled_at is null)
);
create index on public.shop_invites (shop_id, created_at desc);
create index on public.shop_invites (phone) where accepted_at is null and cancelled_at is null;
create index on public.shop_invites (email) where accepted_at is null and cancelled_at is null;
create index on public.shop_invites (for_user_id) where accepted_at is null and cancelled_at is null;

alter table public.shop_invites enable row level security;
revoke insert, update, delete, truncate on public.shop_invites from anon, authenticated;
create policy "shop admins read their invites" on public.shop_invites for select to authenticated
  using (private.is_active_member(shop_id, array['owner']::public.shop_role[]));
create policy "platform admins read all invites" on public.shop_invites for select to authenticated
  using (private.is_platform_admin());

-- ---------------------------------------------------------------- activity log
create table public.staff_activity_log (
  id                bigint generated always as identity primary key,
  shop_id           uuid not null references public.shops (id),
  actor_id          uuid references auth.users (id) on delete set null,
  by_platform_admin boolean not null default false,
  action            text not null check (action in (
                      'invited', 'invite_cancelled', 'joined', 'role_changed', 'renamed',
                      'suspended', 'reactivated', 'removed',
                      'login_change_requested', 'login_changed', 'admin_offered', 'admin_accepted')),
  target_user_id    uuid references auth.users (id) on delete set null,
  target_name       text,
  details           jsonb not null default '{}',
  created_at        timestamptz not null default now()
);
create index on public.staff_activity_log (shop_id, created_at desc);

alter table public.staff_activity_log enable row level security;
revoke insert, update, delete, truncate on public.staff_activity_log from anon, authenticated;
create policy "shop admins read their activity" on public.staff_activity_log for select to authenticated
  using (private.is_active_member(shop_id, array['owner']::public.shop_role[]));
create policy "platform admins read all activity" on public.staff_activity_log for select to authenticated
  using (private.is_platform_admin());

-- Append-only, for everyone including the service role.
create function private.forbid_change()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  raise exception 'the staff activity log cannot be changed';
end;
$$;
revoke execute on function private.forbid_change() from public, anon, authenticated;
create trigger staff_activity_log_append_only before update or delete on public.staff_activity_log
  for each row execute function private.forbid_change();
create trigger staff_activity_log_no_truncate before truncate on public.staff_activity_log
  for each statement execute function private.forbid_change();

-- ---------------------------------------------------------------- helpers
create function private.log_staff(
  p_shop uuid, p_action text, p_target uuid, p_name text, p_details jsonb default '{}', p_platform boolean default false)
returns void
language sql security definer set search_path = ''
as $$
  insert into public.staff_activity_log (shop_id, actor_id, by_platform_admin, action, target_user_id, target_name, details)
  values (p_shop, (select auth.uid()), p_platform, p_action, p_target, p_name, coalesce(p_details, '{}'));
$$;
revoke execute on function private.log_staff(uuid, text, uuid, text, jsonb, boolean) from public, anon, authenticated;

create function private.require_shop_admin(p_shop uuid)
returns void
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.is_active_member(p_shop, array['owner']::public.shop_role[]) then
    raise exception 'only this shop''s admins can manage its staff' using errcode = '42501';
  end if;
end;
$$;
revoke execute on function private.require_shop_admin(uuid) from public, anon, authenticated;

-- "98765 43210", "+91 98765-43210" -> "919876543210". Null if not an Indian mobile.
create function private.normalise_phone(p text)
returns text
language sql immutable set search_path = ''
as $$
  select case
    when d ~ '^[6-9][0-9]{9}$' then '91' || d
    when d ~ '^91[6-9][0-9]{9}$' then d
    when d ~ '^0[6-9][0-9]{9}$' then '91' || substr(d, 2)
  end
  from (select regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g') as d) x;
$$;
revoke execute on function private.normalise_phone(text) from public, anon, authenticated;

-- Shows "+91 98•••••210" or "ra•••@gmail.com" in the log, never the full value.
create function private.mask_contact(p_phone text, p_email text)
returns text
language sql immutable set search_path = ''
as $$
  select case
    when p_phone is not null then '+' || substr(p_phone, 1, 4) || '•••••' || right(p_phone, 3)
    when p_email is not null then left(split_part(p_email, '@', 1), 2) || '•••@' || split_part(p_email, '@', 2)
  end;
$$;
revoke execute on function private.mask_contact(text, text) from public, anon, authenticated;

-- Validates a phone/email pair; returns the normalised values.
create function private.check_contact(p_phone text, p_email text, out o_phone text, out o_email text)
language plpgsql immutable set search_path = ''
as $$
begin
  o_phone := nullif(trim(coalesce(p_phone, '')), '');
  o_email := nullif(lower(trim(coalesce(p_email, ''))), '');
  if (o_phone is null) = (o_email is null) then
    raise exception 'Give either a mobile number or an email address';
  end if;
  if o_phone is not null then
    o_phone := private.normalise_phone(o_phone);
    if o_phone is null then raise exception 'Enter a 10-digit Indian mobile number'; end if;
  end if;
  if o_email is not null and o_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Enter a valid email address';
  end if;
end;
$$;
revoke execute on function private.check_contact(text, text) from public, anon, authenticated;

-- The user (if any) who has verified this phone or email.
create function private.user_for_contact(p_phone text, p_email text)
returns uuid
language sql stable security definer set search_path = ''
as $$
  select u.id from auth.users u
  where (p_phone is not null and u.phone = p_phone and u.phone_confirmed_at is not null)
     or (p_email is not null and lower(u.email) = p_email and u.email_confirmed_at is not null)
  limit 1;
$$;
revoke execute on function private.user_for_contact(text, text) from public, anon, authenticated;

-- Stops the invite feature being used to spam people.
create function private.check_invite_rate(p_shop uuid)
returns void
language plpgsql stable security definer set search_path = ''
as $$
begin
  if (select count(*) from public.shop_invites
       where shop_id = p_shop and created_at > now() - interval '1 day') >= 20 then
    raise exception 'This shop has sent 20 invitations in the last day. Please try again tomorrow.';
  end if;
end;
$$;
revoke execute on function private.check_invite_rate(uuid) from public, anon, authenticated;

create function private.member_name(p_shop uuid, p_user uuid)
returns text
language sql stable security definer set search_path = ''
as $$
  select coalesce(m.display_name, u.email, '+' || u.phone, 'Unnamed')
  from public.shop_members m left join auth.users u on u.id = m.user_id
  where m.shop_id = p_shop and m.user_id = p_user;
$$;
revoke execute on function private.member_name(uuid, uuid) from public, anon, authenticated;

-- The role an invite would actually grant. A login change carries the
-- member's role at acceptance time (they may have been promoted since), and an
-- admin offer always grants owner.
create function private.effective_invite_role(p_invite public.shop_invites)
returns public.shop_role
language sql stable security definer set search_path = ''
as $$
  select case
    when p_invite.for_user_id is not null then 'owner'::public.shop_role
    when p_invite.replaces_user_id is not null then coalesce(
      (select m.role from public.shop_members m
        where m.shop_id = p_invite.shop_id and m.user_id = p_invite.replaces_user_id), p_invite.role)
    else p_invite.role
  end;
$$;
revoke execute on function private.effective_invite_role(public.shop_invites) from public, anon, authenticated;

-- Serialises staff changes per shop, so two admins removing each other at
-- the same moment can't leave a shop with no admin. Callers recheck their
-- own membership after taking the lock.
create function private.lock_shop(p_shop uuid)
returns void
language sql volatile security definer set search_path = ''
as $$
  select null::void from public.shops where id = p_shop for no key update;
$$;
revoke execute on function private.lock_shop(uuid) from public, anon, authenticated;

-- Turns an accepted invite into a membership. The caller has already checked
-- that p_user verified the invite's phone/email (or is its for_user_id).
create function private.apply_invite(p_invite public.shop_invites, p_user uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_old public.shop_members;
  v_role public.shop_role := p_invite.role;
  v_name text := p_invite.display_name;
begin
  perform private.lock_shop(p_invite.shop_id);
  if p_invite.replaces_user_id is not null then
    select * into v_old from public.shop_members
      where shop_id = p_invite.shop_id and user_id = p_invite.replaces_user_id;
    if v_old.user_id is null or v_old.status = 'removed' then
      -- The person was removed after the change was requested.
      update public.shop_invites set cancelled_at = now() where id = p_invite.id;
      return;
    end if;
    v_role := v_old.role;
    v_name := v_old.display_name;  -- may be null; never copy the old phone/email in as a name
    if p_user <> v_old.user_id then
      update public.shop_members
        set status = 'removed', status_changed_at = now(), status_changed_by = p_user
        where shop_id = v_old.shop_id and user_id = v_old.user_id;
    end if;
  end if;

  if p_invite.for_user_id is not null then
    update public.shop_members set role = 'owner'
      where shop_id = p_invite.shop_id and user_id = p_user and status = 'active';
    if not found then
      update public.shop_invites set cancelled_at = now() where id = p_invite.id;
      return;
    end if;
  else
    insert into public.shop_members (shop_id, user_id, role, display_name, invited_by, status, status_changed_at, status_changed_by)
    values (p_invite.shop_id, p_user, v_role, v_name, p_invite.invited_by, 'active', now(), p_user)
    on conflict (shop_id, user_id) do update
      set role = excluded.role, display_name = excluded.display_name, invited_by = excluded.invited_by,
          status = 'active', status_changed_at = now(), status_changed_by = p_user;
  end if;

  update public.shop_invites set accepted_at = now(), accepted_by = p_user where id = p_invite.id;
  perform private.log_staff(
    p_invite.shop_id,
    case when p_invite.replaces_user_id is not null then 'login_changed'
         when p_invite.for_user_id is not null then 'admin_accepted'
         else 'joined' end,
    p_user, coalesce(v_name, p_invite.display_name),
    jsonb_build_object('role', case when p_invite.for_user_id is not null then 'owner' else v_role::text end,
                       'replaced_user_id', p_invite.replaces_user_id));
end;
$$;
revoke execute on function private.apply_invite(public.shop_invites, uuid) from public, anon, authenticated;

-- Open invites the signed-in user can accept.
create function private.my_open_invites()
returns setof public.shop_invites
language sql stable security definer set search_path = ''
as $$
  select i.* from public.shop_invites i, auth.users u
  where u.id = (select auth.uid())
    and i.accepted_at is null and i.cancelled_at is null and i.expires_at > now()
    and ((i.phone is not null and i.phone = u.phone and u.phone_confirmed_at is not null)
      or (i.email is not null and i.email = lower(u.email) and u.email_confirmed_at is not null)
      or i.for_user_id = u.id);
$$;
revoke execute on function private.my_open_invites() from public, anon, authenticated;

-- ---------------------------------------------------------------- API: invitee
-- Called by the app after every sign-in. Accepts staff and manager invites
-- for the user's verified phone/email. Admin invites are left for
-- accept_staff_invite(), which needs a fresh code.
create function public.accept_staff_invites()
returns table (shop_id uuid, shop_name text, role public.shop_role)
language plpgsql security definer set search_path = ''
as $$
declare
  v_inv public.shop_invites;
begin
  if auth.uid() is null then return; end if;
  for v_inv in
    select i.* from private.my_open_invites() i
    join public.shops s on s.id = i.shop_id
    where private.effective_invite_role(i) <> 'owner' and s.status <> 'suspended'
    order by i.created_at
  loop
    perform private.apply_invite(v_inv, auth.uid());
  end loop;
  return query
    select s.id, s.name, m.role from public.shop_members m join public.shops s on s.id = m.shop_id
    where m.user_id = (select auth.uid()) and m.status = 'active';
end;
$$;

-- Invites still waiting for this user to press Accept (admin invites).
create function public.my_pending_invites()
returns table (id uuid, shop_id uuid, shop_name text, role public.shop_role, invited_by_name text, expires_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select i.id, i.shop_id, s.name, private.effective_invite_role(i),
         case when i.by_platform_admin then 'GemLedger support' else private.member_name(i.shop_id, i.invited_by) end,
         i.expires_at
  from private.my_open_invites() i join public.shops s on s.id = i.shop_id
  where s.status <> 'suspended'
  order by i.created_at;
$$;

create function public.accept_staff_invite(p_invite uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_inv public.shop_invites;
begin
  select * into v_inv from private.my_open_invites() i where i.id = p_invite;
  if v_inv.id is null then
    raise exception 'This invitation has expired, been cancelled, or is for someone else';
  end if;
  if (select status from public.shops where id = v_inv.shop_id) = 'suspended' then
    raise exception 'This shop is suspended';
  end if;
  if private.effective_invite_role(v_inv) = 'owner' then perform private.require_recent_verification(); end if;
  perform private.apply_invite(v_inv, auth.uid());
end;
$$;

-- ---------------------------------------------------------------- API: shop admin
-- The shop's people. Contact details and last sign-in only for shop admins.
create function public.staff_list(p_shop uuid, p_include_removed boolean default false)
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
         case when v_admin then coalesce(u.email, '+' || u.phone) end,
         m.created_at,
         case when v_admin then u.last_sign_in_at end,
         m.user_id = (select auth.uid())
  from public.shop_members m left join auth.users u on u.id = m.user_id
  where m.shop_id = p_shop
    and (m.status <> 'removed' or (p_include_removed and v_admin))
  order by m.status, m.role, coalesce(m.display_name, u.email, u.phone);
end;
$$;

create function public.staff_invite(p_shop uuid, p_name text, p_role public.shop_role, p_phone text, p_email text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_contact record;
  v_existing uuid;
  v_id uuid;
begin
  perform private.lock_shop(p_shop);
  perform private.require_shop_admin(p_shop);
  if (select status from public.shops where id = p_shop) = 'suspended' then
    raise exception 'This shop is suspended, so it cannot add people';
  end if;
  if p_role = 'owner' then perform private.require_recent_verification(); end if;
  if length(trim(coalesce(p_name, ''))) not between 1 and 80 then
    raise exception 'Enter the person''s name';
  end if;
  select * into v_contact from private.check_contact(p_phone, p_email);
  perform private.check_invite_rate(p_shop);

  v_existing := private.user_for_contact(v_contact.o_phone, v_contact.o_email);
  if v_existing is not null and exists (
       select 1 from public.shop_members
       where shop_id = p_shop and user_id = v_existing and status <> 'removed') then
    raise exception 'This person already works at your shop';
  end if;

  -- A new invite to the same person replaces any open one ("send again").
  update public.shop_invites
    set cancelled_at = now(), cancelled_by = auth.uid()
    where shop_id = p_shop and accepted_at is null and cancelled_at is null and replaces_user_id is null
      and (phone = v_contact.o_phone or email = v_contact.o_email);

  insert into public.shop_invites (shop_id, display_name, role, phone, email, invited_by)
  values (p_shop, trim(p_name), p_role, v_contact.o_phone, v_contact.o_email, auth.uid())
  returning id into v_id;

  perform private.log_staff(p_shop, 'invited', null, trim(p_name),
    jsonb_build_object('role', p_role, 'contact', private.mask_contact(v_contact.o_phone, v_contact.o_email)));
  return v_id;
end;
$$;

create function public.staff_cancel_invite(p_invite uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_inv public.shop_invites;
begin
  select * into v_inv from public.shop_invites where id = p_invite;
  if v_inv.id is null then raise exception 'invitation not found' using errcode = '42501'; end if;
  perform private.require_shop_admin(v_inv.shop_id);
  if v_inv.accepted_at is not null or v_inv.cancelled_at is not null then
    raise exception 'This invitation is no longer open';
  end if;
  update public.shop_invites set cancelled_at = now(), cancelled_by = auth.uid() where id = p_invite;
  perform private.log_staff(v_inv.shop_id, 'invite_cancelled', v_inv.for_user_id, v_inv.display_name,
    jsonb_build_object('role', v_inv.role, 'contact', private.mask_contact(v_inv.phone, v_inv.email)));
end;
$$;

-- Loads the target membership for an admin action, with the shared checks.
create function private.target_member(p_shop uuid, p_user uuid)
returns public.shop_members
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_m public.shop_members;
begin
  perform private.lock_shop(p_shop);
  perform private.require_shop_admin(p_shop);
  select * into v_m from public.shop_members where shop_id = p_shop and user_id = p_user;
  if v_m.user_id is null or v_m.status = 'removed' then
    raise exception 'This person does not work at your shop';
  end if;
  return v_m;
end;
$$;
revoke execute on function private.target_member(uuid, uuid) from public, anon, authenticated;

create function public.staff_rename(p_shop uuid, p_user uuid, p_name text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_m public.shop_members := private.target_member(p_shop, p_user);
begin
  if length(trim(coalesce(p_name, ''))) not between 1 and 80 then
    raise exception 'Enter the person''s name';
  end if;
  update public.shop_members set display_name = trim(p_name) where shop_id = p_shop and user_id = p_user;
  perform private.log_staff(p_shop, 'renamed', p_user, trim(p_name),
    jsonb_build_object('from', v_m.display_name));
end;
$$;

-- Staff <-> manager, or step an admin down. Making someone an admin goes
-- through staff_offer_admin so they must accept it themselves.
create function public.staff_change_role(p_shop uuid, p_user uuid, p_role public.shop_role)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_m public.shop_members := private.target_member(p_shop, p_user);
begin
  if p_role = 'owner' then
    raise exception 'Use "Make shop admin" so the person can accept it themselves';
  end if;
  if p_user = auth.uid() then
    raise exception 'You cannot change your own role. Ask another shop admin.';
  end if;
  if v_m.role = p_role then return; end if;
  if v_m.role = 'owner' then perform private.require_recent_verification(); end if;
  -- The caller is an active admin and is not the target, so at least one
  -- admin always remains.
  update public.shop_members set role = p_role where shop_id = p_shop and user_id = p_user;
  perform private.log_staff(p_shop, 'role_changed', p_user, private.member_name(p_shop, p_user),
    jsonb_build_object('from', v_m.role, 'to', p_role));
end;
$$;

create function public.staff_offer_admin(p_shop uuid, p_user uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_m public.shop_members := private.target_member(p_shop, p_user);
  v_id uuid;
begin
  perform private.require_recent_verification();
  if v_m.role = 'owner' then raise exception 'This person is already a shop admin'; end if;
  if v_m.status <> 'active' then raise exception 'Reactivate this person first'; end if;
  perform private.check_invite_rate(p_shop);
  update public.shop_invites set cancelled_at = now(), cancelled_by = auth.uid()
    where shop_id = p_shop and for_user_id = p_user and accepted_at is null and cancelled_at is null;
  insert into public.shop_invites (shop_id, display_name, role, for_user_id, invited_by)
  values (p_shop, private.member_name(p_shop, p_user), 'owner', p_user, auth.uid())
  returning id into v_id;
  perform private.log_staff(p_shop, 'admin_offered', p_user, private.member_name(p_shop, p_user));
  return v_id;
end;
$$;

-- Suspend, reactivate or remove. Removal is final; to bring someone back,
-- invite them again.
create function public.staff_set_status(p_shop uuid, p_user uuid, p_status public.member_status)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_m public.shop_members := private.target_member(p_shop, p_user);
begin
  if p_user = auth.uid() then
    raise exception 'You cannot suspend or remove yourself. Ask another shop admin.';
  end if;
  if v_m.status = p_status then return; end if;
  if v_m.role = 'owner' then perform private.require_recent_verification(); end if;
  update public.shop_members
    set status = p_status, status_changed_at = now(), status_changed_by = auth.uid()
    where shop_id = p_shop and user_id = p_user;
  if p_status = 'removed' then
    -- Any pending login change or admin offer for them is void.
    update public.shop_invites set cancelled_at = now(), cancelled_by = auth.uid()
      where shop_id = p_shop and accepted_at is null and cancelled_at is null
        and (replaces_user_id = p_user or for_user_id = p_user);
  end if;
  perform private.log_staff(p_shop,
    case p_status when 'active' then 'reactivated' when 'suspended' then 'suspended' else 'removed' end,
    p_user, private.member_name(p_shop, p_user), jsonb_build_object('role', v_m.role));
end;
$$;

-- Change the phone or email someone signs in with. The new phone/email must
-- sign in (proving it is theirs) before the old one loses access.
create function public.staff_change_login(p_shop uuid, p_user uuid, p_phone text, p_email text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_m public.shop_members := private.target_member(p_shop, p_user);
  v_contact record;
  v_existing uuid;
  v_id uuid;
begin
  perform private.require_recent_verification();
  select * into v_contact from private.check_contact(p_phone, p_email);
  perform private.check_invite_rate(p_shop);
  v_existing := private.user_for_contact(v_contact.o_phone, v_contact.o_email);
  if v_existing = p_user then
    raise exception 'That is already how this person signs in';
  end if;
  if v_existing is not null and exists (
       select 1 from public.shop_members
       where shop_id = p_shop and user_id = v_existing and status <> 'removed') then
    raise exception 'That number or email belongs to someone else at your shop';
  end if;
  update public.shop_invites set cancelled_at = now(), cancelled_by = auth.uid()
    where shop_id = p_shop and replaces_user_id = p_user and accepted_at is null and cancelled_at is null;
  insert into public.shop_invites (shop_id, display_name, role, phone, email, replaces_user_id, invited_by)
  values (p_shop, private.member_name(p_shop, p_user), v_m.role, v_contact.o_phone, v_contact.o_email, p_user, auth.uid())
  returning id into v_id;
  perform private.log_staff(p_shop, 'login_change_requested', p_user, private.member_name(p_shop, p_user),
    jsonb_build_object('to', private.mask_contact(v_contact.o_phone, v_contact.o_email)));
  return v_id;
end;
$$;

-- ---------------------------------------------------------------- API: platform admin
-- Recovery when a shop's only admin is locked out: invite a new admin. They
-- still have to sign in and accept with a fresh code.
create function public.admin_invite_shop_admin(p_shop uuid, p_name text, p_phone text, p_email text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_contact record;
  v_id uuid;
begin
  if not private.is_platform_admin() then
    raise exception 'only GemLedger admins can do this' using errcode = '42501';
  end if;
  perform private.require_recent_verification();
  if not exists (select 1 from public.shops where id = p_shop) then raise exception 'shop not found'; end if;
  if length(trim(coalesce(p_name, ''))) not between 1 and 80 then raise exception 'Enter the person''s name'; end if;
  select * into v_contact from private.check_contact(p_phone, p_email);
  update public.shop_invites set cancelled_at = now(), cancelled_by = auth.uid()
    where shop_id = p_shop and accepted_at is null and cancelled_at is null and replaces_user_id is null
      and (phone = v_contact.o_phone or email = v_contact.o_email);
  insert into public.shop_invites (shop_id, display_name, role, phone, email, invited_by, by_platform_admin)
  values (p_shop, trim(p_name), 'owner', v_contact.o_phone, v_contact.o_email, auth.uid(), true)
  returning id into v_id;
  perform private.log_staff(p_shop, 'invited', null, trim(p_name),
    jsonb_build_object('role', 'owner', 'contact', private.mask_contact(v_contact.o_phone, v_contact.o_email)), true);
  return v_id;
end;
$$;

-- Emergency suspend (or reactivate) of one person at a shop.
create function public.admin_set_member_status(p_shop uuid, p_user uuid, p_status public.member_status)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_old public.member_status;
begin
  if not private.is_platform_admin() then
    raise exception 'only GemLedger admins can do this' using errcode = '42501';
  end if;
  if p_status = 'removed' then raise exception 'Suspend instead; the shop admin removes people'; end if;
  select status into v_old from public.shop_members where shop_id = p_shop and user_id = p_user;
  if v_old is null or v_old = 'removed' then raise exception 'This person does not work at that shop'; end if;
  if v_old = p_status then return; end if;
  update public.shop_members set status = p_status, status_changed_at = now(), status_changed_by = auth.uid()
    where shop_id = p_shop and user_id = p_user;
  perform private.log_staff(p_shop, case p_status when 'active' then 'reactivated' else 'suspended' end,
    p_user, private.member_name(p_shop, p_user), '{}', true);
end;
$$;

-- The dashboard's people list now includes name and status.
drop function public.admin_shop_members(uuid);
create function public.admin_shop_members(p_shop uuid)
returns table (user_id uuid, role public.shop_role, email text, phone text, joined_at timestamptz, last_sign_in_at timestamptz,
               display_name text, status public.member_status)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.is_platform_admin() then
    raise exception 'only GemLedger admins can view shop members' using errcode = '42501';
  end if;
  return query
  select m.user_id, m.role, u.email::text, u.phone::text, m.created_at, u.last_sign_in_at, m.display_name, m.status
  from public.shop_members m
  join auth.users u on u.id = m.user_id
  where m.shop_id = p_shop
  order by m.status, m.created_at;
end;
$$;

-- ---------------------------------------------------------------- grants
do $$
declare
  f text;
begin
  foreach f in array array[
    'public.accept_staff_invites()',
    'public.my_pending_invites()',
    'public.accept_staff_invite(uuid)',
    'public.staff_list(uuid, boolean)',
    'public.staff_invite(uuid, text, public.shop_role, text, text)',
    'public.staff_cancel_invite(uuid)',
    'public.staff_rename(uuid, uuid, text)',
    'public.staff_change_role(uuid, uuid, public.shop_role)',
    'public.staff_offer_admin(uuid, uuid)',
    'public.staff_set_status(uuid, uuid, public.member_status)',
    'public.staff_change_login(uuid, uuid, text, text)',
    'public.admin_invite_shop_admin(uuid, text, text, text)',
    'public.admin_set_member_status(uuid, uuid, public.member_status)',
    'public.admin_shop_members(uuid)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
