-- ============================================================
-- PPE ISSUE MANAGEMENT + EMPLOYEE MASTER — NEW TABLES ONLY
-- Run this once in Supabase SQL Editor.
-- Does NOT touch hoist_records or pressure_vessel_records.
-- ============================================================

create table if not exists ppe_employees (
  id             bigint generated always as identity primary key,
  gate_pass_no   text not null unique,
  employee_name  text not null,
  department     text,
  designation    text,
  joining_date   text,
  contractor     text default 'Power Mech Projects Limited',
  created_at     timestamptz default now()
);

create table if not exists ppe_records (
  id               bigint generated always as identity primary key,
  gate_pass_no     text not null,
  employee_name    text,
  issue_date       text not null,
  jacket_size      text,
  helmet_colour    text,
  goggle_type      text,
  shoe_size        text,
  ear_plug         text,
  nose_mask        text,
  gloves_category  text,
  remarks          text,
  created_at       timestamptz default now()
);

create index if not exists idx_ppe_records_gate_pass on ppe_records (gate_pass_no);

-- Enable RLS + open policies to match the anon-key access pattern
-- already used by hoist_records / pressure_vessel_records in this project.
-- (Skip / adjust this block if your existing tables use different policies.)
alter table ppe_employees enable row level security;
alter table ppe_records enable row level security;

drop policy if exists "ppe_employees_all" on ppe_employees;
create policy "ppe_employees_all" on ppe_employees
  for all using (true) with check (true);

drop policy if exists "ppe_records_all" on ppe_records;
create policy "ppe_records_all" on ppe_records
  for all using (true) with check (true);
