-- Migration: room_date_assignments + room_date_staff
-- Phase 1 of Room Schedule feature
-- Creates tables for assigning surgeons and staff to rooms on specific dates

-- =============================================================================
-- Table: room_date_assignments
-- One row per surgeon per room per date
-- =============================================================================

CREATE TABLE public.room_date_assignments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id uuid NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
    or_room_id uuid NOT NULL REFERENCES public.or_rooms(id) ON DELETE CASCADE,
    assignment_date date NOT NULL,
    surgeon_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    notes text,
    created_by uuid REFERENCES public.users(id),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Unique: one surgeon can only be in one room per date (within a facility)
CREATE UNIQUE INDEX idx_rda_surgeon_date
    ON public.room_date_assignments(facility_id, surgeon_id, assignment_date);

-- Lookup: all assignments for a room on a date
CREATE INDEX idx_rda_room_date
    ON public.room_date_assignments(facility_id, or_room_id, assignment_date);

-- =============================================================================
-- Table: room_date_staff
-- Staff assigned to a room-date slot, optionally linked to a surgeon assignment
-- =============================================================================

CREATE TABLE public.room_date_staff (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    room_date_assignment_id uuid REFERENCES public.room_date_assignments(id) ON DELETE CASCADE,
    facility_id uuid NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
    or_room_id uuid NOT NULL REFERENCES public.or_rooms(id) ON DELETE CASCADE,
    assignment_date date NOT NULL,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    role_id uuid NOT NULL REFERENCES public.user_roles(id),
    created_at timestamptz DEFAULT now()
);

-- One staff member per room per date (within a facility)
CREATE UNIQUE INDEX idx_rds_staff_room_date
    ON public.room_date_staff(facility_id, user_id, assignment_date);

-- Lookup by room + date
CREATE INDEX idx_rds_room_date
    ON public.room_date_staff(facility_id, or_room_id, assignment_date);

-- =============================================================================
-- updated_at trigger for room_date_assignments
-- =============================================================================

CREATE TRIGGER set_updated_at_room_date_assignments
    BEFORE UPDATE ON public.room_date_assignments
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================================
-- RLS: room_date_assignments
-- Follows block_schedules three-tier pattern
-- =============================================================================

ALTER TABLE public.room_date_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Global admins can do anything with room_date_assignments"
    ON public.room_date_assignments
    USING ((public.get_my_access_level() = 'global_admin'::text));

CREATE POLICY "Facility admins can manage own facility room_date_assignments"
    ON public.room_date_assignments
    USING (((public.get_my_access_level() = 'facility_admin'::text)
        AND (facility_id = public.get_my_facility_id())));

CREATE POLICY "Users can view own facility room_date_assignments"
    ON public.room_date_assignments
    FOR SELECT
    USING ((facility_id = public.get_my_facility_id()));

-- =============================================================================
-- RLS: room_date_staff
-- Same three-tier pattern
-- =============================================================================

ALTER TABLE public.room_date_staff ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Global admins can do anything with room_date_staff"
    ON public.room_date_staff
    USING ((public.get_my_access_level() = 'global_admin'::text));

CREATE POLICY "Facility admins can manage own facility room_date_staff"
    ON public.room_date_staff
    USING (((public.get_my_access_level() = 'facility_admin'::text)
        AND (facility_id = public.get_my_facility_id())));

CREATE POLICY "Users can view own facility room_date_staff"
    ON public.room_date_staff
    FOR SELECT
    USING ((facility_id = public.get_my_facility_id()));
