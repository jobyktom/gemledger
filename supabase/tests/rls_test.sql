-- Row-level security checks. Run against a database with the migrations applied
-- (see supabase/README.md). Raises an exception on the first failure.
\set ON_ERROR_STOP 1
begin;
insert into auth.users values ('aaaaaaaa-0000-0000-0000-000000000001'), ('bbbbbbbb-0000-0000-0000-000000000002');

create function pg_temp.as_user(u text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', u, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';
end $$;

-- Jeweller A registers a shop; it starts pending and A becomes owner.
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
insert into public.shops (id, name, city, state) values ('11111111-0000-0000-0000-000000000001', 'Asha Jewellers', 'Kochi', 'Kerala');
do $$ begin
  if (select role from public.shop_members where shop_id = '11111111-0000-0000-0000-000000000001') <> 'owner' then
    raise exception 'FAIL: creator is not owner'; end if;
end $$;

-- A cannot approve their own shop.
do $$ begin
  begin
    update public.shops set status = 'approved' where id = '11111111-0000-0000-0000-000000000001';
    raise exception 'FAIL: shop self-approved';
  exception when raise_exception then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
end $$;

-- A adds an item with a HUID.
insert into public.items (id, shop_id, title, metal, karat, gross_weight_g, price_paise)
values ('22222222-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'Temple necklace', 'gold', 22, 32.5, 18500000);
insert into public.item_huids (item_id, shop_id, huid) values ('22222222-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'AB12CD');

-- An item cannot be moved to another shop, even one the user also belongs to.
insert into public.shops (id, name, city, state) values ('11111111-0000-0000-0000-000000000002', 'Asha Gold (branch)', 'Thrissur', 'Kerala');
do $$ begin
  begin
    update public.items set shop_id = '11111111-0000-0000-0000-000000000002' where id = '22222222-0000-0000-0000-000000000001';
    raise exception 'FAIL: item moved between shops';
  exception when raise_exception then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
end $$;

-- A pending shop cannot issue passports.
do $$ begin
  begin
    insert into public.passports (item_id, shop_id, public_id)
    values ('22222222-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'AAAAAAAAAAAAAAAAAAAAAA');
    raise exception 'FAIL: pending shop issued a passport';
  exception when insufficient_privilege then null;
  end;
end $$;

-- A cannot mark a lab report as lab_matched themselves.
do $$ begin
  begin
    insert into public.grading_reports (item_id, shop_id, lab, report_number, status)
    values ('22222222-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'GIA', '1234567890', 'lab_matched');
    raise exception 'FAIL: shop self-verified a lab report';
  exception when insufficient_privilege then null;
  end;
end $$;
insert into public.grading_reports (item_id, shop_id, lab, report_number)
values ('22222222-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'GIA', '1234567890');

-- Admin approves the shop (service role).
reset role;
set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
update public.shops set status = 'approved' where id = '11111111-0000-0000-0000-000000000001';

-- Now A can issue.
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
insert into public.passports (item_id, shop_id, public_id)
values ('22222222-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'Zx9Qk2LmP4rT7vW1yB3nC5');

-- Jeweller B sees none of A's data and cannot write into A's shop.
select pg_temp.as_user('bbbbbbbb-0000-0000-0000-000000000002');
do $$ begin
  if exists (select 1 from public.items) or exists (select 1 from public.shops)
     or exists (select 1 from public.passports) or exists (select 1 from public.item_huids) then
    raise exception 'FAIL: tenant isolation broken'; end if;
end $$;
do $$ begin
  begin
    insert into public.items (shop_id, title, metal, karat, gross_weight_g)
    values ('11111111-0000-0000-0000-000000000001', 'Fake ring', 'gold', 22, 5);
    raise exception 'FAIL: outsider wrote into another shop';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Anyone can verify by public ID, and sees no price or owner.
reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
do $$
declare r record;
begin
  select * into r from public.get_public_passport('Zx9Qk2LmP4rT7vW1yB3nC5');
  if r.shop_name <> 'Asha Jewellers' or r.huids <> array['AB12CD'] or r.reports->0->>'status' <> 'uploaded' then
    raise exception 'FAIL: public passport wrong: %', row_to_json(r); end if;
  if row_to_json(r)::text like '%18500000%' then raise exception 'FAIL: price leaked'; end if;
  if exists (select 1 from public.get_public_passport('nope')) then raise exception 'FAIL: bad id matched'; end if;
  if exists (select 1 from public.items) or exists (select 1 from public.passports) then
    raise exception 'FAIL: anon can read shop tables'; end if;
end $$;

reset role;
select 'ALL RLS TESTS PASSED' as result;
rollback;
