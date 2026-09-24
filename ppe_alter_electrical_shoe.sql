-- ============================================================
-- PPE MODULE — ROUND 2 ADDITIVE CHANGE
-- Adds ONE new column to ppe_records for the new
-- "Electrical Safety Shoe" item (sizes 3–11).
--
-- Run this ONCE in Supabase SQL Editor, AFTER the original
-- ppe_tables.sql has already been run successfully.
--
-- Does NOT touch: hoist_records, pressure_vessel_records,
-- ppe_employees, or any existing column of ppe_records.
-- Existing rows simply get this new column as NULL/blank.
-- ============================================================

alter table ppe_records
  add column if not exists electrical_shoe_size text;
