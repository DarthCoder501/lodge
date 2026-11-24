alter table lodge.applications
  add column if not exists cycle text not null default '';
