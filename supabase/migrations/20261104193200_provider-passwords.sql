-- Provider accounts have no password hash. Password accounts still require one.
-- The existing not-blank check allows null and rejects an empty string.

alter table identity.accounts alter column password_hash drop not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'accounts_password_requires_hash'
      and conrelid = 'identity.accounts'::regclass
  ) then
    alter table identity.accounts
      add constraint accounts_password_requires_hash
      check (login_provider <> 'password' or password_hash is not null);
  end if;
end $$;
