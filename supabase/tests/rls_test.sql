-- Row-level security checks. Run against a database with the migrations applied
-- (see supabase/README.md). Raises an exception on the first failure.
\set ON_ERROR_STOP 1
begin;
insert into auth.users (id) values ('aaaaaaaa-0000-0000-0000-000000000001'), ('bbbbbbbb-0000-0000-0000-000000000002');

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

do $$ begin
  if public.am_platform_admin() then raise exception 'FAIL: jeweller is admin'; end if;
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

-- create_item writes item, HUIDs and reports together, under the caller's RLS.
do $$
declare v_id uuid;
begin
  v_id := public.create_item('11111111-0000-0000-0000-000000000001', 'Jhumka pair', null, 'gold', 22::smallint, 12.4, null, null,
                             array['zz99yy', 'XX88WW'], '[{"lab": "IGI", "report_number": "LG12345678"}]');
  if (select count(*) from public.item_huids where item_id = v_id) <> 2
     or (select huid from public.item_huids where item_id = v_id order by huid limit 1) <> 'XX88WW'
     or (select status from public.grading_reports where item_id = v_id) <> 'uploaded' then
    raise exception 'FAIL: create_item did not write children';
  end if;
  -- A bad HUID rolls back the whole item.
  begin
    perform public.create_item('11111111-0000-0000-0000-000000000001', 'Bad ring', null, 'gold', 22::smallint, 3, null, null, array['bad'], '[]');
    raise exception 'FAIL: bad HUID accepted';
  exception when check_violation then null;
  end;
  if exists (select 1 from public.items where title = 'Bad ring') then raise exception 'FAIL: partial item left behind'; end if;
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

-- Jeweller B is made a platform admin, sees the pending shop and approves it.
reset role;
insert into private.platform_admins (user_id) values ('bbbbbbbb-0000-0000-0000-000000000002');
select pg_temp.as_user('bbbbbbbb-0000-0000-0000-000000000002');
do $$ begin
  if not public.am_platform_admin() then raise exception 'FAIL: admin not recognised'; end if;
  if not exists (select 1 from public.shops where id = '11111111-0000-0000-0000-000000000001') then
    raise exception 'FAIL: admin cannot see pending shop'; end if;
end $$;
update public.shops set status = 'approved' where id = '11111111-0000-0000-0000-000000000001';
-- Admins read every shop's data from their dashboard, without joining the shop.
do $$
declare r record;
begin
  if (select count(*) from public.items) <> 2 or not exists (select 1 from public.item_huids)
     or not exists (select 1 from public.grading_reports) or not exists (select 1 from public.shop_members) then
    raise exception 'FAIL: admin cannot read shop data'; end if;
  select * into r from public.admin_shop_stats() where shop_id = '11111111-0000-0000-0000-000000000001';
  if r.items <> 2 or r.members <> 1 or r.passports_issued <> 0 then
    raise exception 'FAIL: admin_shop_stats wrong: %', row_to_json(r); end if;
  if (select count(*) from public.admin_shop_members('11111111-0000-0000-0000-000000000001')) <> 1 then
    raise exception 'FAIL: admin_shop_members wrong'; end if;
  if (select count(*) from public.admin_weekly_passports(12)) <> 12 then
    raise exception 'FAIL: admin_weekly_passports wrong'; end if;
end $$;
-- ...but reading is all: an admin cannot add stock or issue passports for a shop.
do $$ begin
  begin
    insert into public.items (shop_id, title, metal, karat, gross_weight_g)
    values ('11111111-0000-0000-0000-000000000001', 'Admin ring', 'gold', 22, 5);
    raise exception 'FAIL: admin wrote an item';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.passports (item_id, shop_id, public_id)
    values ('22222222-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'BBBBBBBBBBBBBBBBBBBBBB');
    raise exception 'FAIL: admin issued a passport';
  exception when insufficient_privilege then null;
  end;
  if exists (select 1 from public.items where title = 'Admin ring') then raise exception 'FAIL: admin item left'; end if;
end $$;
reset role;
delete from private.platform_admins;

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

-- Non-admins cannot use the admin statistics.
do $$ begin
  begin
    perform public.admin_shop_stats();
    raise exception 'FAIL: non-admin read platform stats';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.admin_shop_members('11111111-0000-0000-0000-000000000001');
    raise exception 'FAIL: non-admin read shop members';
  exception when insufficient_privilege then null;
  end;
end $$;

do $$ begin
  begin
    perform public.create_item('11111111-0000-0000-0000-000000000001', 'Sneaky', null, 'silver', null, 5, null, null, '{}', '[]');
    raise exception 'FAIL: outsider used create_item on another shop';
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
