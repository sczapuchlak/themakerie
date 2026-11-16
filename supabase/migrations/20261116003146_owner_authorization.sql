-- The Makerie — owner authorization boundary
--
-- The Makerie is a private, single-user application. Being *signed in* is not
-- enough: an account must be explicitly authorized, and authorization is keyed
-- to the immutable account id (auth.users.id) — never inferred from an email
-- address, so a matching email on some other identity grants nothing.
--
-- Future tables restrict rows with policies like:
--   using (owner_id = (select auth.uid()) and (select public.is_authorized_account()))

-- A schema the Data API does not expose.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.authorized_accounts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'owner' check (role = 'owner'),
  note text,
  authorized_at timestamptz not null default now()
);

comment on table private.authorized_accounts is
  'Accounts allowed into The Makerie. Single-user: at most one owner row.';

-- Single-user application: at most one authorized account.
create unique index authorized_accounts_single_owner
  on private.authorized_accounts ((true));

-- Defence in depth: RLS on with no policies, and no grants to API roles.
alter table private.authorized_accounts enable row level security;
revoke all on private.authorized_accounts from public, anon, authenticated;

-- Answers only for the caller; usable from RLS policies and via RPC.
create or replace function public.is_authorized_account()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.authorized_accounts a
    where a.user_id = (select auth.uid())
  );
$$;

revoke execute on function public.is_authorized_account() from public, anon;
grant execute on function public.is_authorized_account() to authenticated;

-- Administrative bootstrap. Run as the database owner (SQL editor / psql):
--   select private.authorize_account('<auth user id>', 'owner — Google');
-- Not callable through the Data API.
create or replace function private.authorize_account(target_user_id uuid, note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from auth.users u where u.id = target_user_id) then
    raise exception 'No auth user with id %', target_user_id;
  end if;

  insert into private.authorized_accounts (user_id, note)
  values (target_user_id, note);
end;
$$;

revoke all on function private.authorize_account(uuid, text) from public, anon, authenticated;
