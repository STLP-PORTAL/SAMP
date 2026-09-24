-- ============================================================
-- J&FC TRACKER MODULE — NEW TABLE ONLY
-- Red / Green / Yellow / White notices (Excel columns A to S).
--
-- Run this ONCE in Supabase SQL Editor.
-- Does NOT touch hoist_records, pressure_vessel_records,
-- ppe_employees, ppe_records or safety_instrument_records.
-- ============================================================

create table if not exists jfc_tracker_records (
  id                    bigint generated always as identity primary key,
  sr_no                 integer not null unique,
  notice_date           text,
  area                  text,
  location              text,
  observee_name         text,
  observee_dept         text,
  observee_sub_dept     text,
  observee_gp_id        text,
  observee_designation  text,
  observee_company      text,
  description           text,
  deviation_category    text,
  notice_type           text not null,
  observer_name         text,
  observer_gp_id        text,
  observer_designation  text,
  observer_company      text,
  action_taken          text,
  remarks               text,
  created_at            timestamptz default now(),
  constraint jfc_notice_type_chk check (notice_type in ('Red','Green','Yellow','White'))
);

create index if not exists idx_jfc_notice_type on jfc_tracker_records (notice_type);
create index if not exists idx_jfc_area on jfc_tracker_records (area);

-- Enable RLS + open policies to match the anon-key access pattern
-- already used by the other tables in this project.
alter table jfc_tracker_records enable row level security;

drop policy if exists "jfc_tracker_records_all" on jfc_tracker_records;
create policy "jfc_tracker_records_all" on jfc_tracker_records
  for all using (true) with check (true);
