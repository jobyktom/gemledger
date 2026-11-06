-- Apple Wallet and Google Wallet passes.
--
-- Apple Wallet asks every pass to carry an authentication token, and an
-- iPhone that holds the pass registers itself with our web service so we can
-- tell it when the pass changes. These tables store that, and nothing about
-- the customer: Apple's device and push identifiers are anonymous.
--
-- Security boundary: anyone who knows a passport's public_id can already open
-- its page and download its pass, which contains the token. So the token adds
-- no secrecy beyond the public_id; it exists because Apple requires it, and it
-- stops someone who only knows a device identifier from changing that
-- device's registrations for other passes.

create table private.wallet_tokens (
  passport_id uuid primary key references public.passports (id) on delete cascade,
  token       text not null default encode(extensions.gen_random_bytes(24), 'hex'),
  created_at  timestamptz not null default now()
);

create table private.wallet_apple_registrations (
  device_library_id text not null check (device_library_id ~ '^[A-Za-z0-9._-]{1,128}$'),
  passport_id       uuid not null references public.passports (id) on delete cascade,
  push_token        text not null check (push_token ~ '^[A-Za-z0-9]{1,200}$'),
  created_at        timestamptz not null default now(),
  primary key (device_library_id, passport_id)
);
create index on private.wallet_apple_registrations (passport_id);

alter table private.wallet_tokens enable row level security;
alter table private.wallet_apple_registrations enable row level security;
revoke all on private.wallet_tokens, private.wallet_apple_registrations from public, anon, authenticated;

-- A pass also shows the item's HUIDs and grading reports and the shop's name
-- and city. Changing any of those marks the item as updated, so phones fetch
-- a fresh pass.
create function private.touch_item_for_wallet()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_table_name = 'shops' then
    update public.items i set updated_at = now() where i.shop_id = new.id;
  else
    if tg_op <> 'DELETE' then update public.items i set updated_at = now() where i.id = new.item_id; end if;
    if tg_op <> 'INSERT' then update public.items i set updated_at = now() where i.id = old.item_id; end if;
  end if;
  return null;
end;
$$;
revoke execute on function private.touch_item_for_wallet() from public, anon, authenticated;
create trigger touch_item_for_wallet after insert or update or delete on public.item_huids
  for each row execute function private.touch_item_for_wallet();
create trigger touch_item_for_wallet after insert or update or delete on public.grading_reports
  for each row execute function private.touch_item_for_wallet();
create trigger touch_item_for_wallet after update of name, city on public.shops
  for each row when (old.name is distinct from new.name or old.city is distinct from new.city)
  execute function private.touch_item_for_wallet();

-- When anything shown on the pass last changed. Wallet uses this to decide
-- whether to download a fresh copy.
create function private.wallet_pass_updated_at(p public.passports)
returns timestamptz
language sql stable security definer set search_path = ''
as $$
  select greatest(p.issued_at, p.claimed_at, p.revoked_at,
                  (select i.updated_at from public.items i where i.id = p.item_id));
$$;
revoke execute on function private.wallet_pass_updated_at(public.passports) from public, anon, authenticated;

-- The pass's token (created on first use) and its last change time.
create function public.wallet_pass_meta(p_public_id text)
returns table (token text, updated_at timestamptz)
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_passport public.passports;
begin
  select * into v_passport from public.passports p where p.public_id = p_public_id;
  if not found then return; end if;
  insert into private.wallet_tokens (passport_id) values (v_passport.id) on conflict do nothing;
  return query
    select t.token, private.wallet_pass_updated_at(v_passport)
    from private.wallet_tokens t where t.passport_id = v_passport.id;
end;
$$;

-- Apple web service: a device starts receiving updates for a pass.
-- Returns 'created', 'exists' or 'unauthorized'.
create function public.wallet_apple_register(p_public_id text, p_token text, p_device text, p_push_token text)
returns text
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_passport_id uuid;
begin
  select p.id into v_passport_id
  from public.passports p join private.wallet_tokens t on t.passport_id = p.id
  where p.public_id = p_public_id and t.token = p_token;
  if v_passport_id is null then return 'unauthorized'; end if;

  update private.wallet_apple_registrations r set push_token = p_push_token
  where r.device_library_id = p_device and r.passport_id = v_passport_id;
  if found then return 'exists'; end if;

  -- A real pass is on a handful of devices; this stops anyone filling the table.
  if (select count(*) from private.wallet_apple_registrations r where r.passport_id = v_passport_id) >= 50 then
    return 'unauthorized';
  end if;

  insert into private.wallet_apple_registrations (device_library_id, passport_id, push_token)
  values (p_device, v_passport_id, p_push_token)
  on conflict do nothing;
  return 'created';
end;
$$;

-- Apple web service: a device removed the pass. Returns false if unauthorized.
create function public.wallet_apple_unregister(p_public_id text, p_token text, p_device text)
returns boolean
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_passport_id uuid;
begin
  select p.id into v_passport_id
  from public.passports p join private.wallet_tokens t on t.passport_id = p.id
  where p.public_id = p_public_id and t.token = p_token;
  if v_passport_id is null then return false; end if;
  delete from private.wallet_apple_registrations r
  where r.device_library_id = p_device and r.passport_id = v_passport_id;
  return true;
end;
$$;

-- Apple web service: which of a device's passes changed since a time.
create function public.wallet_apple_device_passes(p_device text, p_since timestamptz default null)
returns table (public_id text, updated_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select p.public_id, private.wallet_pass_updated_at(p)
  from private.wallet_apple_registrations r
  join public.passports p on p.id = r.passport_id
  where r.device_library_id = p_device
    and (p_since is null or private.wallet_pass_updated_at(p) > p_since);
$$;

-- Push tokens of the devices holding a pass, so the app can tell them it
-- changed. Only the issuing shop's staff and GemLedger admins can read them.
create function public.wallet_apple_push_tokens(p_public_id text)
returns table (push_token text)
language sql stable security definer set search_path = ''
as $$
  select r.push_token
  from public.passports p
  join private.wallet_apple_registrations r on r.passport_id = p.id
  where p.public_id = p_public_id
    and (private.is_shop_member(p.shop_id) or private.is_platform_admin());
$$;

revoke execute on function public.wallet_pass_meta(text) from public;
revoke execute on function public.wallet_apple_register(text, text, text, text) from public;
revoke execute on function public.wallet_apple_unregister(text, text, text) from public;
revoke execute on function public.wallet_apple_device_passes(text, timestamptz) from public;
revoke execute on function public.wallet_apple_push_tokens(text) from public, anon;
grant execute on function public.wallet_pass_meta(text) to anon, authenticated;
grant execute on function public.wallet_apple_register(text, text, text, text) to anon, authenticated;
grant execute on function public.wallet_apple_unregister(text, text, text) to anon, authenticated;
grant execute on function public.wallet_apple_device_passes(text, timestamptz) to anon, authenticated;
grant execute on function public.wallet_apple_push_tokens(text) to authenticated;
