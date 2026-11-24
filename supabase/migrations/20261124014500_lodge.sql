-- Mailboxes, sync, and applications live in a private schema.
-- It is not granted to the Data API roles. RLS is on with no policies.
-- The server connects as the table owner, which bypasses RLS.

create schema if not exists lodge;

revoke all on schema lodge from public;

create table if not exists lodge.mailboxes (
  id bigint generated always as identity primary key,
  account_id bigint not null references identity.accounts (id) on delete cascade,
  address text not null,
  provider text not null,
  refresh_token text,
  disconnected_at timestamptz,
  created_at timestamptz not null default now(),
  constraint mailboxes_provider_check check (provider in ('gmail', 'outlook')),
  constraint mailboxes_address_not_blank check (char_length(address) > 0),
  constraint mailboxes_token_check check (
    refresh_token is null or char_length(refresh_token) > 0
  ),
  constraint mailboxes_account_address_unique unique (account_id, address)
);

create index if not exists mailboxes_account_id_idx
  on lodge.mailboxes (account_id);

create table if not exists lodge.sync_runs (
  id bigint generated always as identity primary key,
  mailbox_id bigint not null references lodge.mailboxes (id) on delete cascade,
  status text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  constraint sync_runs_status_check check (
    status in ('running', 'reading', 'finished', 'failed')
  )
);

create index if not exists sync_runs_mailbox_id_idx
  on lodge.sync_runs (mailbox_id, started_at desc);

create unique index if not exists sync_runs_one_open_idx
  on lodge.sync_runs (mailbox_id)
  where status in ('running', 'reading');

create table if not exists lodge.applications (
  id bigint generated always as identity primary key,
  account_id bigint not null references identity.accounts (id) on delete cascade,
  mailbox_id bigint not null references lodge.mailboxes (id) on delete cascade,
  company text not null,
  role text not null,
  dedupe text not null,
  stage text not null,
  event text not null,
  source_url text not null,
  excerpt text not null default '',
  message_id text not null,
  pinned boolean not null default false,
  needs_review boolean not null default false,
  dismissed boolean not null default false,
  occurred_at timestamptz not null default now(),
  found_at timestamptz not null default now(),
  notified_at timestamptz,
  constraint applications_stage_check check (
    stage in (
      'applied',
      'oa-not-done',
      'interview-not-done',
      'in-progress',
      'offer',
      'rejected'
    )
  ),
  constraint applications_company_not_blank check (char_length(company) > 0),
  constraint applications_role_not_blank check (char_length(role) > 0),
  constraint applications_message_unique unique (mailbox_id, message_id),
  constraint applications_role_unique unique (account_id, dedupe)
);

create index if not exists applications_account_id_idx
  on lodge.applications (account_id);

create index if not exists applications_mailbox_id_idx
  on lodge.applications (mailbox_id);

create table if not exists lodge.alert_choices (
  account_id bigint primary key references identity.accounts (id) on delete cascade,
  choice text not null default 'off',
  constraint alert_choices_check check (choice in ('off', 'on', 'denied'))
);

create table if not exists lodge.visits (
  account_id bigint primary key references identity.accounts (id) on delete cascade,
  seen_at timestamptz not null
);

alter table lodge.mailboxes enable row level security;
alter table lodge.sync_runs enable row level security;
alter table lodge.applications enable row level security;
alter table lodge.alert_choices enable row level security;
alter table lodge.visits enable row level security;

revoke all on lodge.mailboxes from public;
revoke all on lodge.sync_runs from public;
revoke all on lodge.applications from public;
revoke all on lodge.alert_choices from public;
revoke all on lodge.visits from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on schema lodge from anon, authenticated, service_role;
    revoke all on lodge.mailboxes from anon, authenticated, service_role;
    revoke all on lodge.sync_runs from anon, authenticated, service_role;
    revoke all on lodge.applications from anon, authenticated, service_role;
    revoke all on lodge.alert_choices from anon, authenticated, service_role;
    revoke all on lodge.visits from anon, authenticated, service_role;
  end if;
end
$$;
