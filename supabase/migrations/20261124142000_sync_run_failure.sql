-- The console link for a Gmail API that is still off. Other failures stay null.

alter table lodge.sync_runs
  add column if not exists failure text;

alter table lodge.sync_runs
  drop constraint if exists sync_runs_failure_check;

alter table lodge.sync_runs
  add constraint sync_runs_failure_check check (
    failure is null
    or failure ~ '^https://console\.developers\.google\.com/apis/api/gmail\.googleapis\.com/overview\?project=[0-9]{1,20}$'
  );
