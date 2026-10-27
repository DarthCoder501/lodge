-- Sessions live in the private identity schema. RLS is on with no policies.
-- The server connects as the table owner, which bypasses RLS.

create table if not exists identity.sessions (
  id text primary key,
  account_id bigint not null references identity.accounts (id) on delete cascade,
  constraint sessions_id_not_blank check (char_length(id) > 0)
);

create index if not exists sessions_account_id_idx on identity.sessions (account_id);

alter table identity.sessions enable row level security;

revoke all on identity.sessions from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on identity.sessions from anon, authenticated, service_role;
  end if;
end
$$;
