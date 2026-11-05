-- Verification tokens live in the private identity schema. RLS is on with no
-- policies. The server connects as the table owner, which bypasses RLS.
-- The table stores a hash of the token, not the token.

create table if not exists identity.email_verifications (
  id bigint generated always as identity primary key,
  account_id bigint not null references identity.accounts (id) on delete cascade,
  token_hash text not null,
  sent_at timestamptz not null default now(),
  constraint email_verifications_token_hash_unique unique (token_hash),
  constraint email_verifications_token_hash_not_blank check (char_length(token_hash) > 0)
);

create index if not exists email_verifications_account_id_idx
  on identity.email_verifications (account_id);

alter table identity.email_verifications enable row level security;

revoke all on identity.email_verifications from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on identity.email_verifications from anon, authenticated, service_role;
  end if;
end
$$;
