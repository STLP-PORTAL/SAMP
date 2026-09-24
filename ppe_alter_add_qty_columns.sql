-- ============================================================
-- PPE MODULE — ROUND 3 ADDITIVE CHANGE
-- Adds ONE nullable "quantity" column per PPE item to ppe_records,
-- so every issued item can also record how many units (nos) were
-- given, not just size/colour/type.
--
-- Run this ONCE in Supabase SQL Editor, AFTER ppe_tables.sql and
-- ppe_alter_electrical_shoe.sql have already been run.
--
-- Does NOT touch: hoist_records, pressure_vessel_records,
-- ppe_employees, or any EXISTING column of ppe_records.
-- Existing rows simply get these new columns as NULL.
-- ============================================================

alter table ppe_records add column if not exists jacket_qty integer;
alter table ppe_records add column if not exists helmet_qty integer;
alter table ppe_records add column if not exists goggle_qty integer;
alter table ppe_records add column if not exists shoe_qty integer;
alter table ppe_records add column if not exists electrical_shoe_qty integer;
alter table ppe_records add column if not exists earplug_qty integer;
alter table ppe_records add column if not exists nosemask_qty integer;
alter table ppe_records add column if not exists gloves_qty integer;
