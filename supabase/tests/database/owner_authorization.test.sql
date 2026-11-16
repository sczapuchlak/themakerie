-- pgTAP: owner authorization boundary. Run with `npm run db:test`.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

-- Independent of local state; everything here is rolled back.
delete from private.authorized_accounts;

-- Two accounts carrying the SAME email (the second an SSO/provider account,
-- which auth.users permits alongside an ordinary one): authorization must
-- follow the account id, not the email.
insert into auth.users (id, email, aud, role, is_sso_user)
values
  ('00000000-0000-4000-8000-000000000001', 'pgtap-owner@makerie.test', 'authenticated', 'authenticated', false),
  ('00000000-0000-4000-8000-000000000002', 'pgtap-owner@makerie.test', 'authenticated', 'authenticated', true);

select private.authorize_account('00000000-0000-4000-8000-000000000001', 'test owner');

select throws_ok(
  $$ select private.authorize_account('00000000-0000-4000-8000-000000000002') $$,
  '23505',
  null,
  'only one authorized owner can exist'
);

select throws_ok(
  $$ select private.authorize_account('00000000-0000-4000-8000-0000000000ff') $$,
  'P0001',
  null,
  'cannot authorize an account that does not exist'
);

-- Signed in as the authorized owner
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}';
select ok(public.is_authorized_account(), 'owner account is authorized');

-- Signed in as a different account sharing the owner's email
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}';
select ok(not public.is_authorized_account(), 'same email, different account: not authorized');

-- API roles cannot read or call into the private schema
select throws_ok(
  $$ select * from private.authorized_accounts $$,
  '42501',
  null,
  'authenticated cannot read the allowlist'
);
select throws_ok(
  $$ select private.authorize_account('00000000-0000-4000-8000-000000000002') $$,
  '42501',
  null,
  'authenticated cannot authorize accounts'
);

reset role;
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select throws_ok(
  $$ select public.is_authorized_account() $$,
  '42501',
  null,
  'anon cannot call is_authorized_account'
);
select throws_ok(
  $$ select * from private.authorized_accounts $$,
  '42501',
  null,
  'anon cannot read the allowlist'
);

reset role;
-- Deleting the auth account removes its authorization
delete from auth.users where id = '00000000-0000-4000-8000-000000000001';
select is(
  (select count(*) from private.authorized_accounts)::int,
  0,
  'authorization is removed with the account'
);

select * from finish();
rollback;
