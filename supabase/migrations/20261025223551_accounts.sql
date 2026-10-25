-- Accounts live in a private schema. It is not granted to the Data API roles.
-- RLS is on with no policies, so those roles see nothing. The server connects
-- as the table owner, which bypasses RLS.

create schema if not exists identity;

revoke all on schema identity from public;

create table if not exists identity.accounts (
  id bigint generated always as identity primary key,
  email text not null,
  password_hash text not null,
  email_verified boolean not null default false,
  login_provider text not null default 'password',
  constraint accounts_email_unique unique (email),
  constraint accounts_login_provider_check check (
    login_provider in ('google', 'microsoft', 'password')
  ),
  constraint accounts_email_not_blank check (char_length(email) > 0),
  constraint accounts_password_hash_not_blank check (char_length(password_hash) > 0)
);

alter table identity.accounts enable row level security;

revoke all on identity.accounts from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on schema identity from anon, authenticated, service_role;
    revoke all on identity.accounts from anon, authenticated, service_role;
  end if;
end
$$;
