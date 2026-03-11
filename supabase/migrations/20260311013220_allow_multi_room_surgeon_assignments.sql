-- Migration: Allow surgeons to be assigned to multiple rooms on the same date
-- Supports "flip room" scheduling where a surgeon operates in 2+ rooms per day

-- Drop old constraint: one surgeon per date (across all rooms)
DROP INDEX IF EXISTS public.idx_rda_surgeon_date;

-- New constraint: one surgeon per room per date (allows same surgeon in different rooms)
CREATE UNIQUE INDEX idx_rda_room_surgeon_date
    ON public.room_date_assignments(facility_id, or_room_id, surgeon_id, assignment_date);
