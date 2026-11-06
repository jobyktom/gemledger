-- Staff management checks: inviting, offboarding, changing logins, and the
-- abuse cases that must fail. Runs in a transaction and rolls back.
-- Run against a database with the migrations applied (see supabase/README.md):
--   psql "$DATABASE_URL" -f supabase/tests/staff_test.sql
\set ON_ERROR_STOP 1
begin;

-- A: shop admin. B: becomes staff. C: admin of another shop. D: B's new phone.
-- F: has B's number but never verified it. P: GemLedger platform admin.
insert into auth.users (id, phone, phone_confirmed_at, email, email_confirmed_at) values
  ('a0000000-0000-0000-0000-00000000000a', '919800000001', now(), null, null),
  ('b0000000-0000-0000-0000-00000000000b', '919800000002', now(), null, null),
  ('c0000000-0000-0000-0000-00000000000c', '919800000003', now(), null, null),
  ('d0000000-0000-0000-0000-00000000000d', '919800000004', now(), null, null),
  ('e0000000-0000-0000-0000-00000000000e', null, null, 'ravi@example.com', now()),
  ('f0000000-0000-0000-0000-00000000000f', '919800000002', null, null, null),
  ('90000000-0000-0000-0000-000000000009', null, null, 'ops@gemledger.test', now());
insert into private.platform_admins (user_id) values ('90000000-0000-0000-0000-000000000009');

-- Signs in as u. fresh = entered a sign-in code just now (else 2 hours ago).
create function pg_temp.as_user(u text, fresh boolean default false) returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', json_build_object(
    'sub', u, 'role', 'authenticated',
    'amr', json_build_array(json_build_object('method', 'otp',
      'timestamp', extract(epoch from now())::bigint - case when fresh then 5 else 7200 end)))::text, true);
  execute 'set local role authenticated';
end $$;

-- Back to the database owner, with no signed-in user.
create function pg_temp.as_owner() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
end $$;

-- Runs sql and fails the test unless it raises an error matching pattern.
create function pg_temp.must_fail(label text, sql text, pattern text default '%') returns void language plpgsql as $$
begin
  begin
    execute sql;
  exception when others then
    if sqlerrm not like pattern then
      raise exception 'FAIL: % raised "%" (expected %)', label, sqlerrm, pattern;
    end if;
    return;
  end;
  raise exception 'FAIL: % was allowed', label;
end $$;

create function pg_temp.check(label text, ok boolean) returns void language plpgsql as $$
begin
  if ok is not true then raise exception 'FAIL: %', label; end if;
end $$;

-- Two shops, both approved.
select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
insert into public.shops (id, name, city, state) values ('51000000-0000-0000-0000-000000000001', 'Asha Jewellers', 'Kochi', 'Kerala');
insert into public.items (id, shop_id, title, metal, karat, gross_weight_g)
values ('17000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001', 'Temple necklace', 'gold', 22, 32.5);
select pg_temp.as_user('c0000000-0000-0000-0000-00000000000c');
insert into public.shops (id, name, city, state) values ('52000000-0000-0000-0000-000000000002', 'Other Gold', 'Thrissur', 'Kerala');
select pg_temp.as_owner();
update public.shops set status = 'approved';

-- ------------------------------------------------ inviting
select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
select pg_temp.check('owner can list staff', (select count(*) from public.staff_list('51000000-0000-0000-0000-000000000001')) = 1);
select pg_temp.must_fail('inviting an admin without a fresh code',
  $$select public.staff_invite('51000000-0000-0000-0000-000000000001', 'Partner', 'owner', '9800000009', null)$$, 'reauth_required');
select pg_temp.must_fail('invite with no contact',
  $$select public.staff_invite('51000000-0000-0000-0000-000000000001', 'Ravi', 'staff', null, null)$$, 'Give either%');
select pg_temp.must_fail('invite with a bad number',
  $$select public.staff_invite('51000000-0000-0000-0000-000000000001', 'Ravi', 'staff', '12345', null)$$, 'Enter a 10-digit%');
select pg_temp.must_fail('inviting yourself',
  $$select public.staff_invite('51000000-0000-0000-0000-000000000001', 'Me', 'staff', '98000 00001', null)$$, '%already works%');
select public.staff_invite('51000000-0000-0000-0000-000000000001', 'Bindu', 'staff', '+91 98000-00002', null);
select pg_temp.check('invite stored normalised',
  (select phone from public.shop_invites where display_name = 'Bindu') = '919800000002');
select pg_temp.check('owner sees invites', (select count(*) from public.shop_invites) = 1);

-- Another shop's admin cannot touch this shop.
select pg_temp.as_user('c0000000-0000-0000-0000-00000000000c', true);
select pg_temp.must_fail('other shop invites here',
  $$select public.staff_invite('51000000-0000-0000-0000-000000000001', 'Spy', 'staff', '9800000007', null)$$, 'only this shop%');
select pg_temp.must_fail('other shop lists staff',
  $$select * from public.staff_list('51000000-0000-0000-0000-000000000001')$$, 'not a member%');
select pg_temp.check('other shop sees no invites', (select count(*) from public.shop_invites) = 0);
select pg_temp.check('other shop sees no activity', (select count(*) from public.staff_activity_log) = 0);
select pg_temp.must_fail('other shop removes A',
  $$select public.staff_set_status('51000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a', 'removed')$$, 'only this shop%');

-- Someone holding the number but who never verified it gets nothing.
select pg_temp.as_user('f0000000-0000-0000-0000-00000000000f');
select pg_temp.check('unverified phone not accepted', (select count(*) from public.accept_staff_invites()) = 0);

-- B signs in with the invited number and joins.
select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b');
select pg_temp.check('B joins on sign-in', (select role from public.accept_staff_invites()) = 'staff');
select pg_temp.check('B reads items', (select count(*) from public.items) = 1);
select pg_temp.check('staff see no contact details',
  (select bool_and(contact is null and last_sign_in_at is null) from public.staff_list('51000000-0000-0000-0000-000000000001')));
select pg_temp.check('staff see no invites', (select count(*) from public.shop_invites) = 0);
select pg_temp.check('staff see no activity log', (select count(*) from public.staff_activity_log) = 0);

-- ------------------------------------------------ staff cannot escalate
select pg_temp.must_fail('staff invites',
  $$select public.staff_invite('51000000-0000-0000-0000-000000000001', 'X', 'staff', '9800000007', null)$$, 'only this shop%');
select pg_temp.must_fail('staff promotes self via table',
  $$update public.shop_members set role = 'owner' where user_id = 'b0000000-0000-0000-0000-00000000000b'$$, 'permission denied%');
select pg_temp.must_fail('staff inserts membership',
  $$insert into public.shop_members (shop_id, user_id, role) values ('52000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-00000000000b', 'owner')$$, 'permission denied%');
select pg_temp.must_fail('staff deletes admin via table',
  $$delete from public.shop_members where user_id = 'a0000000-0000-0000-0000-00000000000a'$$, 'permission denied%');
select pg_temp.must_fail('staff removes admin',
  $$select public.staff_set_status('51000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a', 'removed')$$, 'only this shop%');
select pg_temp.must_fail('staff writes an invite directly',
  $$insert into public.shop_invites (shop_id, display_name, role, for_user_id) values ('51000000-0000-0000-0000-000000000001', 'B', 'owner', 'b0000000-0000-0000-0000-00000000000b')$$, 'permission denied%');
select pg_temp.must_fail('staff writes the log',
  $$insert into public.staff_activity_log (shop_id, action) values ('51000000-0000-0000-0000-000000000001', 'joined')$$, 'permission denied%');

-- ------------------------------------------------ roles and admin hand-over
select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
select public.staff_change_role('51000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b', 'manager');
select public.staff_rename('51000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b', 'Bindu Menon');
select pg_temp.must_fail('making an admin by role change',
  $$select public.staff_change_role('51000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b', 'owner')$$, '%Make shop admin%');
select pg_temp.must_fail('changing own role',
  $$select public.staff_change_role('51000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a', 'staff')$$, 'You cannot change your own%');
select pg_temp.must_fail('removing yourself (the last admin)',
  $$select public.staff_set_status('51000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a', 'removed')$$, 'You cannot suspend or remove yourself%');
select pg_temp.must_fail('offering admin without a fresh code',
  $$select public.staff_offer_admin('51000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b')$$, 'reauth_required');
select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a', true);
select public.staff_offer_admin('51000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b');

-- The offer is never accepted automatically, and needs B's own fresh code.
select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b');
select pg_temp.check('admin offer not auto-accepted', (select role from public.accept_staff_invites()) = 'manager');
select pg_temp.check('B sees the offer', (select count(*) from public.my_pending_invites()) = 1);
select pg_temp.must_fail('accepting admin without a fresh code',
  $$select public.accept_staff_invite((select id from public.my_pending_invites()))$$, 'reauth_required');
do $$ declare v uuid; begin
  perform pg_temp.as_owner();
  select id into v from public.shop_invites where for_user_id = 'b0000000-0000-0000-0000-00000000000b';
  perform pg_temp.as_user('d0000000-0000-0000-0000-00000000000d', true);
  perform pg_temp.must_fail('someone else accepting B''s offer by id',
    format('select public.accept_staff_invite(%L)', v), '%someone else');
end $$;
select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b', true);
select public.accept_staff_invite((select id from public.my_pending_invites()));
select pg_temp.check('B is now an admin',
  (select role from public.shop_members where user_id = 'b0000000-0000-0000-0000-00000000000b') = 'owner');

-- Demoting an admin needs a fresh code; afterwards A can't manage staff.
select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b');
select pg_temp.must_fail('demoting an admin without a fresh code',
  $$select public.staff_change_role('51000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a', 'manager')$$, 'reauth_required');
select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b', true);
select public.staff_change_role('51000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a', 'manager');
select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a', true);
select pg_temp.must_fail('a manager inviting',
  $$select public.staff_invite('51000000-0000-0000-0000-000000000001', 'X', 'staff', '9800000007', null)$$, 'only this shop%');

-- ------------------------------------------------ suspend, change login, remove
select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b');
select public.staff_set_status('51000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a', 'suspended');
select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
select pg_temp.check('suspended person reads no items', (select count(*) from public.items) = 0);
select pg_temp.check('suspended person sees no shop', (select count(*) from public.shops) = 0);
select pg_temp.check('suspended person sees own membership',
  (select status from public.shop_members where user_id = 'a0000000-0000-0000-0000-00000000000a') = 'suspended');
select pg_temp.must_fail('suspended person adds an item',
  $$insert into public.items (shop_id, title, metal, karat, gross_weight_g) values ('51000000-0000-0000-0000-000000000001', 'Ring', 'gold', 22, 3)$$, '%row-level security%');

-- A lost their phone: B moves A's login to number D.
select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b');
select pg_temp.must_fail('changing a login without a fresh code',
  $$select public.staff_change_login('51000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a', '9800000004', null)$$, 'reauth_required');
select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b', true);
select pg_temp.must_fail('moving a login onto a colleague',
  $$select public.staff_change_login('51000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a', '9800000002', null)$$, '%someone else at your shop');
select public.staff_change_login('51000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a', '9800000004', null);
select pg_temp.as_user('d0000000-0000-0000-0000-00000000000d');
select pg_temp.check('new number joins with A''s role', (select role from public.accept_staff_invites()) = 'manager');
select pg_temp.check('new login keeps the name',
  (select display_name is not distinct from (select display_name from public.shop_members where user_id = 'a0000000-0000-0000-0000-00000000000a')
     from public.shop_members where user_id = 'd0000000-0000-0000-0000-00000000000d'));
select pg_temp.check('new login reads items', (select count(*) from public.items) = 1);
select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
select pg_temp.check('old login is removed',
  (select status from public.shop_members where user_id = 'a0000000-0000-0000-0000-00000000000a') = 'removed');
select pg_temp.check('old login reads nothing', (select count(*) from public.items) = 0);

-- Removal is final and its work stays.
select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b');
select public.staff_set_status('51000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-00000000000d', 'removed');
select pg_temp.must_fail('acting on a removed person',
  $$select public.staff_set_status('51000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-00000000000d', 'active')$$, '%does not work at your shop');
select pg_temp.check('items survive removals', (select count(*) from public.items) = 1);
select pg_temp.check('removed people hidden by default',
  (select count(*) from public.staff_list('51000000-0000-0000-0000-000000000001')) = 1);
select pg_temp.check('removed people listed on request',
  (select count(*) from public.staff_list('51000000-0000-0000-0000-000000000001', true)) = 3);

-- ------------------------------------------------ invite limits
select public.staff_invite('51000000-0000-0000-0000-000000000001', 'Ravi', 'staff', null, ' Ravi@Example.com ');
select pg_temp.as_owner();
update public.shop_invites set expires_at = now() - interval '1 minute' where email = 'ravi@example.com';
select pg_temp.as_user('e0000000-0000-0000-0000-00000000000e');
select pg_temp.check('expired invite not accepted', (select count(*) from public.accept_staff_invites()) = 0);
select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b');
select public.staff_invite('51000000-0000-0000-0000-000000000001', 'Ravi', 'staff', null, 'ravi@example.com');
select pg_temp.check('resending cancels the old invite',
  (select count(*) from public.shop_invites where email = 'ravi@example.com' and cancelled_at is null) = 1);
do $$ begin
  for i in 1..30 loop
    perform public.staff_invite('51000000-0000-0000-0000-000000000001', 'Spam ' || i, 'staff', '98000' || lpad(i::text, 5, '1'), null);
  end loop;
  raise exception 'FAIL: invite rate limit not enforced';
exception when others then
  if sqlerrm not like '%20 invitations%' then raise; end if;
end $$;

-- ------------------------------------------------ activity log
select pg_temp.check('activity log records the journey',
  (select count(distinct action) from public.staff_activity_log) >= 10);
select pg_temp.check('log hides full numbers',
  not exists (select 1 from public.staff_activity_log where details::text like '%9800000004%'));
select pg_temp.must_fail('admin edits the log',
  $$update public.staff_activity_log set action = 'joined'$$, 'permission denied%');
select pg_temp.must_fail('admin deletes the log',
  $$delete from public.staff_activity_log$$, 'permission denied%');
select pg_temp.as_owner();
select pg_temp.must_fail('even the database owner deletes the log',
  $$delete from public.staff_activity_log$$, '%cannot be changed');

-- ------------------------------------------------ suspended shop, platform admin
update public.shops set status = 'suspended' where id = '51000000-0000-0000-0000-000000000001';
select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b', true);
select pg_temp.check('suspended shop reads no items', (select count(*) from public.items) = 0);
select pg_temp.check('suspended shop still sees itself', (select count(*) from public.shops) = 1);
select pg_temp.must_fail('suspended shop invites',
  $$select public.staff_invite('51000000-0000-0000-0000-000000000001', 'New', 'staff', '9800000077', null)$$, '%suspended%');

select pg_temp.as_user('90000000-0000-0000-0000-000000000009');
select pg_temp.check('platform admin sees statuses',
  (select count(*) from public.admin_shop_members('51000000-0000-0000-0000-000000000001') where status = 'removed') = 2);
select pg_temp.check('platform admin reads the log', (select count(*) from public.staff_activity_log) > 0);
select pg_temp.must_fail('recovery without a fresh code',
  $$select public.admin_invite_shop_admin('51000000-0000-0000-0000-000000000001', 'New owner', '9800000088', null)$$, 'reauth_required');
select pg_temp.as_user('90000000-0000-0000-0000-000000000009', true);
select public.admin_invite_shop_admin('52000000-0000-0000-0000-000000000002', 'New owner', '9800000004', null);
select public.admin_set_member_status('52000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-00000000000c', 'suspended');
select pg_temp.as_user('c0000000-0000-0000-0000-00000000000c', true);
select pg_temp.check('suspended by support reads nothing', (select count(*) from public.items) = 0);
select pg_temp.as_user('d0000000-0000-0000-0000-00000000000d', true);
select pg_temp.check('recovery invite waits for Accept', (select count(*) from public.accept_staff_invites()) = 0);
select public.accept_staff_invite((select id from public.my_pending_invites()));
select pg_temp.check('recovered admin manages staff',
  (select count(*) from public.staff_list('52000000-0000-0000-0000-000000000002')) = 2);
select pg_temp.as_user('b0000000-0000-0000-0000-00000000000b', true);
select pg_temp.must_fail('shop admin calls platform recovery',
  $$select public.admin_invite_shop_admin('51000000-0000-0000-0000-000000000001', 'X', '9800000099', null)$$, 'only GemLedger%');

select pg_temp.as_owner();
rollback;
select 'ALL STAFF TESTS PASSED' as result;
