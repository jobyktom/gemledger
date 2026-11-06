-- Wallet pass checks. Run against a database with the migrations applied
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
create function pg_temp.as_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', 'anon', true);
  execute 'set local role anon';
end $$;

-- Setup as the database owner: an approved shop owned by A, with one passport.
insert into public.shops (id, name, city, state, created_by)
values ('11111111-0000-0000-0000-000000000001', 'Asha Jewellers', 'Kochi', 'Kerala', 'aaaaaaaa-0000-0000-0000-000000000001');
do $$ begin
  perform set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', true);
  perform set_config('request.jwt.claim.role', 'service_role', true);
end $$;
update public.shops set status = 'approved' where id = '11111111-0000-0000-0000-000000000001';
insert into public.items (id, shop_id, title, metal, karat, gross_weight_g)
values ('22222222-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'Temple necklace', 'gold', 22, 32.5);
insert into public.passports (item_id, shop_id, public_id, issued_by)
values ('22222222-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'WalletPass000000000001', 'aaaaaaaa-0000-0000-0000-000000000001');

-- A customer's phone (anonymous) fetches the pass and registers for updates.
select pg_temp.as_anon();
do $$
declare v_token text; v_again text;
begin
  select token into v_token from public.wallet_pass_meta('WalletPass000000000001');
  if v_token is null or length(v_token) < 16 then raise exception 'FAIL: no wallet token'; end if;
  select token into v_again from public.wallet_pass_meta('WalletPass000000000001');
  if v_again <> v_token then raise exception 'FAIL: wallet token changed between calls'; end if;
  if exists (select 1 from public.wallet_pass_meta('NoSuchPass000000000001')) then
    raise exception 'FAIL: meta for unknown passport'; end if;

  if public.wallet_apple_register('WalletPass000000000001', 'wrong-token', 'device1', 'push1') <> 'unauthorized' then
    raise exception 'FAIL: registered with a wrong token'; end if;
  if public.wallet_apple_register('WalletPass000000000001', v_token, 'device1', 'push1') <> 'created' then
    raise exception 'FAIL: first registration not created'; end if;
  if public.wallet_apple_register('WalletPass000000000001', v_token, 'device1', 'push2') <> 'exists' then
    raise exception 'FAIL: repeat registration not reported as existing'; end if;

  if (select count(*) from public.wallet_apple_device_passes('device1')) <> 1 then
    raise exception 'FAIL: device does not list its pass'; end if;
  if exists (select 1 from public.wallet_apple_device_passes('device1', now() + interval '1 minute')) then
    raise exception 'FAIL: unchanged pass listed as updated'; end if;
  if exists (select 1 from public.wallet_apple_device_passes('device2')) then
    raise exception 'FAIL: another device sees the pass'; end if;
end $$;

-- Anonymous visitors cannot read the tables or the push tokens.
do $$ begin
  begin
    perform * from private.wallet_apple_registrations;
    raise exception 'FAIL: anon read registrations';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.wallet_apple_push_tokens('WalletPass000000000001');
    raise exception 'FAIL: anon read push tokens';
  exception when insufficient_privilege then null;
  end;
end $$;

-- The shop's owner can read the push tokens (to notify phones); another user cannot.
reset role;
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
do $$ begin
  if (select array_agg(t.push_token) from public.wallet_apple_push_tokens('WalletPass000000000001') t) <> array['push2'] then
    raise exception 'FAIL: owner cannot read the latest push token'; end if;
end $$;
reset role;
select pg_temp.as_user('bbbbbbbb-0000-0000-0000-000000000002');
do $$ begin
  if exists (select 1 from public.wallet_apple_push_tokens('WalletPass000000000001')) then
    raise exception 'FAIL: outsider read push tokens'; end if;
end $$;

-- A changed grading report or shop name also marks the pass as updated.
reset role;
update public.items set updated_at = now() - interval '1 hour' where id = '22222222-0000-0000-0000-000000000001';
insert into public.grading_reports (item_id, shop_id, lab, report_number)
values ('22222222-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'IGI', 'LG12345678');
do $$ begin
  if (select updated_at from public.items where id = '22222222-0000-0000-0000-000000000001') < now() then
    raise exception 'FAIL: new grading report did not mark the pass updated'; end if;
end $$;
update public.items set updated_at = now() - interval '1 hour' where id = '22222222-0000-0000-0000-000000000001';
update public.shops set name = 'Asha Gold' where id = '11111111-0000-0000-0000-000000000001';
do $$ begin
  if (select updated_at from public.items where id = '22222222-0000-0000-0000-000000000001') < now() then
    raise exception 'FAIL: shop rename did not mark the pass updated'; end if;
end $$;

-- Revoking the passport marks it as updated for the device; unregistering removes it.
reset role;
update public.passports set status = 'revoked', revoked_at = now() + interval '2 minutes'
where public_id = 'WalletPass000000000001';
select pg_temp.as_anon();
do $$
declare v_token text;
begin
  if not exists (select 1 from public.wallet_apple_device_passes('device1', now() + interval '1 minute')) then
    raise exception 'FAIL: revoked pass not listed as updated'; end if;
  select token into v_token from public.wallet_pass_meta('WalletPass000000000001');
  if public.wallet_apple_unregister('WalletPass000000000001', 'wrong-token', 'device1') then
    raise exception 'FAIL: unregistered with a wrong token'; end if;
  if not public.wallet_apple_unregister('WalletPass000000000001', v_token, 'device1') then
    raise exception 'FAIL: unregister refused'; end if;
  if exists (select 1 from public.wallet_apple_device_passes('device1')) then
    raise exception 'FAIL: pass still registered after unregister'; end if;
end $$;

select 'ALL WALLET TESTS PASSED';
rollback;
