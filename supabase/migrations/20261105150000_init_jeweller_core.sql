-- GemLedger core schema: shops, staff, items, evidence and passports.
-- Every shop-owned row carries shop_id, and row-level security limits access
-- to members of that shop. The public verify page reads only through
-- public.get_public_passport(), which returns non-sensitive fields.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------- types
create type public.shop_status as enum ('pending', 'approved', 'suspended');
create type public.shop_role as enum ('owner', 'manager', 'staff');
create type public.metal as enum ('gold', 'silver', 'platinum', 'other');
create type public.grading_lab as enum ('GIA', 'IGI', 'HRD', 'SGL', 'other');
create type public.verification_status as enum
  ('uploaded', 'jeweller_attested', 'lab_matched', 'mismatch', 'not_checkable');
create type public.document_kind as enum
  ('photo', 'invoice', 'warranty', 'lab_report', 'hallmark', 'other');
create type public.passport_status as enum ('issued', 'claimed', 'transferred', 'revoked');

-- ---------------------------------------------------------------- shops
create table public.shops (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) between 2 and 120),
  legal_name  text,
  gstin       text check (gstin is null or gstin ~ '^[0-9]{2}[A-Z0-9]{13}$'),
  city        text not null,
  state       text not null,
  phone       text,
  status      public.shop_status not null default 'pending',
  created_by  uuid not null default auth.uid() references auth.users (id),
  created_at  timestamptz not null default now()
);

create table public.shop_members (
  shop_id    uuid not null references public.shops (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       public.shop_role not null default 'staff',
  created_at timestamptz not null default now(),
  primary key (shop_id, user_id)
);
create index on public.shop_members (user_id);

-- Membership checks run as definer so policies on shop_members don't recurse.
create function public.is_shop_member(p_shop uuid, p_roles public.shop_role[] default null)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.shop_members m
    where m.shop_id = p_shop
      and m.user_id = (select auth.uid())
      and (p_roles is null or m.role = any (p_roles))
  );
$$;

create function public.is_shop_approved(p_shop uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.shops s where s.id = p_shop and s.status = 'approved');
$$;

-- Whoever registers a shop becomes its owner. New shops start as 'pending'
-- and an admin approves them before they can issue passports.
create function public.handle_new_shop()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.shop_members (shop_id, user_id, role)
  values (new.id, new.created_by, 'owner');
  return new;
end;
$$;
create trigger on_shop_created after insert on public.shops
  for each row execute function public.handle_new_shop();

-- Shops cannot approve themselves: only the service role may change status.
create function public.guard_shop_status()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and new.status <> 'pending' and auth.role() <> 'service_role' then
    raise exception 'new shops start as pending';
  end if;
  if tg_op = 'UPDATE' and new.status is distinct from old.status and auth.role() <> 'service_role' then
    raise exception 'only GemLedger admins can change a shop''s status';
  end if;
  return new;
end;
$$;
create trigger guard_shop_status before insert or update on public.shops
  for each row execute function public.guard_shop_status();

-- ---------------------------------------------------------------- items
create table public.items (
  id               uuid primary key default gen_random_uuid(),
  shop_id          uuid not null references public.shops (id) on delete restrict,
  title            text not null check (length(trim(title)) between 2 and 120),
  description      text check (length(description) <= 2000),
  metal            public.metal not null,
  karat            smallint check (karat in (14, 18, 20, 22, 23, 24)),
  gross_weight_g   numeric(10, 3) not null check (gross_weight_g > 0),
  net_weight_g     numeric(10, 3) check (net_weight_g > 0),
  -- Private to the shop; never exposed on the public verify page.
  price_paise      bigint check (price_paise >= 0),
  created_by       uuid not null default auth.uid() references auth.users (id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (metal <> 'gold' or karat is not null),
  check (net_weight_g is null or net_weight_g <= gross_weight_g)
);
create index on public.items (shop_id, created_at desc);

create table public.item_huids (
  item_id  uuid not null references public.items (id) on delete cascade,
  shop_id  uuid not null references public.shops (id),
  huid     text not null check (huid ~ '^[A-Z0-9]{6}$'),
  primary key (item_id, huid)
);
create index on public.item_huids (huid);

create table public.grading_reports (
  id             uuid primary key default gen_random_uuid(),
  item_id        uuid not null references public.items (id) on delete cascade,
  shop_id        uuid not null references public.shops (id),
  lab            public.grading_lab not null,
  report_number  text not null check (length(report_number) between 4 and 32),
  status         public.verification_status not null default 'uploaded',
  checked_at     timestamptz,
  lab_fields     jsonb,
  created_at     timestamptz not null default now(),
  unique (item_id, lab, report_number)
);

create table public.documents (
  id            uuid primary key default gen_random_uuid(),
  item_id       uuid not null references public.items (id) on delete cascade,
  shop_id       uuid not null references public.shops (id),
  kind          public.document_kind not null,
  storage_path  text not null unique,
  sha256        text check (sha256 ~ '^[0-9a-f]{64}$'),
  uploaded_by   uuid not null default auth.uid() references auth.users (id),
  created_at    timestamptz not null default now()
);
create index on public.documents (item_id);

-- ---------------------------------------------------------------- passports
create table public.passports (
  id          uuid primary key default gen_random_uuid(),
  item_id     uuid not null references public.items (id) on delete restrict,
  shop_id     uuid not null references public.shops (id),
  -- Unguessable ID printed in the QR code (22 base62 chars, see packages/shared).
  public_id   text not null unique check (public_id ~ '^[0-9A-Za-z]{22}$'),
  status      public.passport_status not null default 'issued',
  issued_by   uuid not null default auth.uid() references auth.users (id),
  issued_at   timestamptz not null default now(),
  claimed_by  uuid references auth.users (id),
  claimed_at  timestamptz,
  revoked_at  timestamptz
);
create index on public.passports (item_id);
create index on public.passports (claimed_by);
-- One live passport per item.
create unique index passports_one_live_per_item on public.passports (item_id)
  where status <> 'revoked';

-- Child rows must belong to the same shop as their item.
create function public.check_item_shop()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.items i where i.id = new.item_id and i.shop_id = new.shop_id) then
    raise exception 'item % does not belong to shop %', new.item_id, new.shop_id;
  end if;
  return new;
end;
$$;
create trigger check_item_shop before insert or update on public.item_huids
  for each row execute function public.check_item_shop();
create trigger check_item_shop before insert or update on public.grading_reports
  for each row execute function public.check_item_shop();
create trigger check_item_shop before insert or update on public.documents
  for each row execute function public.check_item_shop();
create trigger check_item_shop before insert or update on public.passports
  for each row execute function public.check_item_shop();

create function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger touch_items before update on public.items
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------- RLS
alter table public.shops           enable row level security;
alter table public.shop_members    enable row level security;
alter table public.items           enable row level security;
alter table public.item_huids      enable row level security;
alter table public.grading_reports enable row level security;
alter table public.documents       enable row level security;
alter table public.passports       enable row level security;

-- shops
create policy "members read their shop" on public.shops for select to authenticated
  using (public.is_shop_member(id));
create policy "signed-in users register a shop" on public.shops for insert to authenticated
  with check (created_by = (select auth.uid()));
create policy "owners and managers edit their shop" on public.shops for update to authenticated
  using (public.is_shop_member(id, array['owner', 'manager']::public.shop_role[]))
  with check (public.is_shop_member(id, array['owner', 'manager']::public.shop_role[]));

-- shop_members
create policy "members see their colleagues" on public.shop_members for select to authenticated
  using (public.is_shop_member(shop_id));
create policy "owners manage staff" on public.shop_members for all to authenticated
  using (public.is_shop_member(shop_id, array['owner']::public.shop_role[]))
  with check (public.is_shop_member(shop_id, array['owner']::public.shop_role[]));

-- items and evidence: any member of the shop can read and write
create policy "members read items" on public.items for select to authenticated
  using (public.is_shop_member(shop_id));
create policy "members add items" on public.items for insert to authenticated
  with check (public.is_shop_member(shop_id) and created_by = (select auth.uid()));
create policy "members edit items" on public.items for update to authenticated
  using (public.is_shop_member(shop_id)) with check (public.is_shop_member(shop_id));

create policy "members manage huids" on public.item_huids for all to authenticated
  using (public.is_shop_member(shop_id)) with check (public.is_shop_member(shop_id));

create policy "members read reports" on public.grading_reports for select to authenticated
  using (public.is_shop_member(shop_id));
-- Shops may only record what they entered; lab_matched/mismatch are set by
-- the server-side lab connector (service role).
create policy "members add reports" on public.grading_reports for insert to authenticated
  with check (public.is_shop_member(shop_id) and status in ('uploaded', 'jeweller_attested', 'not_checkable'));
create policy "members delete reports" on public.grading_reports for delete to authenticated
  using (public.is_shop_member(shop_id));

create policy "members read documents" on public.documents for select to authenticated
  using (public.is_shop_member(shop_id));
create policy "members add documents" on public.documents for insert to authenticated
  with check (public.is_shop_member(shop_id) and uploaded_by = (select auth.uid()));
create policy "managers delete documents" on public.documents for delete to authenticated
  using (public.is_shop_member(shop_id, array['owner', 'manager']::public.shop_role[]));

-- passports: only approved shops can issue
create policy "members read passports" on public.passports for select to authenticated
  using (public.is_shop_member(shop_id) or claimed_by = (select auth.uid()));
create policy "approved shops issue passports" on public.passports for insert to authenticated
  with check (
    public.is_shop_member(shop_id)
    and public.is_shop_approved(shop_id)
    and status = 'issued'
    and issued_by = (select auth.uid())
    and claimed_by is null
  );

-- ---------------------------------------------------------------- public verify
-- What anyone scanning a QR code may see. No owner, price, or other items.
create function public.get_public_passport(p_public_id text)
returns table (
  public_id      text,
  status         public.passport_status,
  issued_at      timestamptz,
  shop_name      text,
  shop_city      text,
  item_title     text,
  metal          public.metal,
  karat          smallint,
  gross_weight_g numeric,
  huids          text[],
  reports        jsonb
)
language sql stable security definer set search_path = ''
as $$
  select p.public_id, p.status, p.issued_at,
         s.name, s.city,
         i.title, i.metal, i.karat, i.gross_weight_g,
         coalesce((select array_agg(h.huid order by h.huid) from public.item_huids h where h.item_id = i.id), '{}'),
         coalesce((select jsonb_agg(jsonb_build_object(
                     'lab', r.lab, 'report_number', r.report_number,
                     'status', r.status, 'checked_at', r.checked_at) order by r.created_at)
                   from public.grading_reports r where r.item_id = i.id), '[]'::jsonb)
  from public.passports p
  join public.items i on i.id = p.item_id
  join public.shops s on s.id = p.shop_id
  where p.public_id = p_public_id and p_public_id ~ '^[0-9A-Za-z]{22}$';
$$;

revoke execute on function public.get_public_passport(text) from public;
grant execute on function public.get_public_passport(text) to anon, authenticated;
revoke execute on function public.is_shop_member(uuid, public.shop_role[]) from public, anon;
revoke execute on function public.is_shop_approved(uuid) from public, anon;

-- ---------------------------------------------------------------- storage
-- Private bucket; objects live under "<shop_id>/<item_id>/<file>".
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('item-files', 'item-files', false, 20971520,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'])
on conflict (id) do nothing;

create policy "members read shop files" on storage.objects for select to authenticated
  using (bucket_id = 'item-files'
         and public.is_shop_member(((storage.foldername(name))[1])::uuid));
create policy "members upload shop files" on storage.objects for insert to authenticated
  with check (bucket_id = 'item-files'
              and public.is_shop_member(((storage.foldername(name))[1])::uuid));
create policy "managers delete shop files" on storage.objects for delete to authenticated
  using (bucket_id = 'item-files'
         and public.is_shop_member(((storage.foldername(name))[1])::uuid,
                                   array['owner', 'manager']::public.shop_role[]));
