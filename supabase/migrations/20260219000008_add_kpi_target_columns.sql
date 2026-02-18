-- Migration: Add KPI target columns to facility_analytics_settings
-- Adds new configurable target columns for all KPIs that were previously hard-coded.
-- Fixes wrong defaults on existing turnover and utilization columns.
-- Backfills existing rows that have the old incorrect defaults.

-- ============================================
-- 1. Add new columns
-- ============================================

ALTER TABLE public.facility_analytics_settings
  ADD COLUMN IF NOT EXISTS turnover_threshold_minutes numeric DEFAULT 30 NOT NULL
    CONSTRAINT facility_analytics_settings_turnover_threshold_check
      CHECK (turnover_threshold_minutes >= 5 AND turnover_threshold_minutes <= 120),
  ADD COLUMN IF NOT EXISTS turnover_compliance_target_percent numeric DEFAULT 80 NOT NULL
    CONSTRAINT facility_analytics_settings_turnover_compliance_check
      CHECK (turnover_compliance_target_percent >= 0 AND turnover_compliance_target_percent <= 100),
  ADD COLUMN IF NOT EXISTS tardiness_target_minutes numeric DEFAULT 45 NOT NULL
    CONSTRAINT facility_analytics_settings_tardiness_target_check
      CHECK (tardiness_target_minutes >= 5 AND tardiness_target_minutes <= 120),
  ADD COLUMN IF NOT EXISTS idle_combined_target_minutes numeric DEFAULT 10 NOT NULL
    CONSTRAINT facility_analytics_settings_idle_combined_check
      CHECK (idle_combined_target_minutes >= 1 AND idle_combined_target_minutes <= 60),
  ADD COLUMN IF NOT EXISTS idle_flip_target_minutes numeric DEFAULT 5 NOT NULL
    CONSTRAINT facility_analytics_settings_idle_flip_check
      CHECK (idle_flip_target_minutes >= 1 AND idle_flip_target_minutes <= 60),
  ADD COLUMN IF NOT EXISTS idle_same_room_target_minutes numeric DEFAULT 10 NOT NULL
    CONSTRAINT facility_analytics_settings_idle_same_room_check
      CHECK (idle_same_room_target_minutes >= 1 AND idle_same_room_target_minutes <= 60),
  ADD COLUMN IF NOT EXISTS non_op_warn_minutes numeric DEFAULT 20 NOT NULL
    CONSTRAINT facility_analytics_settings_non_op_warn_check
      CHECK (non_op_warn_minutes >= 5 AND non_op_warn_minutes <= 120),
  ADD COLUMN IF NOT EXISTS non_op_bad_minutes numeric DEFAULT 30 NOT NULL
    CONSTRAINT facility_analytics_settings_non_op_bad_check
      CHECK (non_op_bad_minutes >= 5 AND non_op_bad_minutes <= 120),
  ADD COLUMN IF NOT EXISTS operating_days_per_year integer DEFAULT 250 NOT NULL
    CONSTRAINT facility_analytics_settings_operating_days_check
      CHECK (operating_days_per_year >= 1 AND operating_days_per_year <= 365);

-- ============================================
-- 2. Fix existing column defaults
-- ============================================

-- turnover_target_same_surgeon: was 30, should be 45
ALTER TABLE public.facility_analytics_settings
  ALTER COLUMN turnover_target_same_surgeon SET DEFAULT 45;

-- turnover_target_flip_room: was 45, should be 15
ALTER TABLE public.facility_analytics_settings
  ALTER COLUMN turnover_target_flip_room SET DEFAULT 15;

-- utilization_target_percent: was 80, should be 75
ALTER TABLE public.facility_analytics_settings
  ALTER COLUMN utilization_target_percent SET DEFAULT 75;

-- ============================================
-- 3. Backfill existing rows with wrong defaults
-- ============================================

-- Only update rows that still have the old incorrect default values.
-- Rows where admins explicitly set a value won't match these conditions.

UPDATE public.facility_analytics_settings
  SET turnover_target_same_surgeon = 45
  WHERE turnover_target_same_surgeon = 30;

UPDATE public.facility_analytics_settings
  SET turnover_target_flip_room = 15
  WHERE turnover_target_flip_room = 45;

UPDATE public.facility_analytics_settings
  SET utilization_target_percent = 75
  WHERE utilization_target_percent = 80;
