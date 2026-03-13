-- Migration: Add partial holiday support to facility_holidays
-- Phase 16: Allows holidays to be marked as partial-day closures with a specific close time.

ALTER TABLE facility_holidays ADD COLUMN is_partial BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE facility_holidays ADD COLUMN partial_close_time TIME;

-- Constraint: if partial, close time is required; if not partial, close time must be null
ALTER TABLE facility_holidays ADD CONSTRAINT partial_requires_time CHECK (
  (is_partial = false AND partial_close_time IS NULL) OR
  (is_partial = true AND partial_close_time IS NOT NULL)
);
