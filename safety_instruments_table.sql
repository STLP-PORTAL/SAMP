-- ============================================================
-- SAFETY INSTRUMENTS MODULE — NEW TABLE ONLY
-- Calibration tracking for: Multi Gas Detector, H2 Gas Detector,
-- O2 Gas Detector, Digital Lux Meter, Sound Meter.
--
-- Run this ONCE in Supabase SQL Editor.
-- Does NOT touch hoist_records, pressure_vessel_records,
-- ppe_employees, or ppe_records.
-- ============================================================

create table if not exists safety_instrument_records (
  id                     bigint generated always as identity primary key,
  s_no                   text,
  owner                  text,
  instrument_type        text not null,
  product_no             text,
  serial_no              text not null unique,
  certification_no       text,
  calibration_date       text,
  calibration_due_date   text,
  status                 text default 'Working',
  handover_to            text,
  remarks                text,
  created_at             timestamptz default now()
);

create index if not exists idx_safety_instruments_type on safety_instrument_records (instrument_type);
create index if not exists idx_safety_instruments_due on safety_instrument_records (calibration_due_date);

-- Enable RLS + open policies to match the anon-key access pattern
-- already used by hoist_records / pressure_vessel_records / ppe_records
-- in this project.
alter table safety_instrument_records enable row level security;

drop policy if exists "safety_instrument_records_all" on safety_instrument_records;
create policy "safety_instrument_records_all" on safety_instrument_records
  for all using (true) with check (true);
