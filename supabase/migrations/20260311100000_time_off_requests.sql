-- Migration: time_off_requests table
-- Phase 1 of Staff Schedule Home + Time-Off Management

-- ============================================================
-- 1. Create table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.time_off_requests (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id     UUID        NOT NULL REFERENCES public.facilities(id),
  user_id         UUID        NOT NULL REFERENCES public.users(id),
  request_type    TEXT        NOT NULL CHECK (request_type IN ('pto', 'sick', 'personal')),
  start_date      DATE        NOT NULL,
  end_date        DATE        NOT NULL,
  partial_day_type TEXT       CHECK (partial_day_type IN ('am', 'pm')),
  reason          TEXT,
  status          TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  reviewed_by     UUID        REFERENCES public.users(id),
  reviewed_at     TIMESTAMPTZ,
  review_notes    TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active       BOOLEAN     NOT NULL DEFAULT true,
  deleted_at      TIMESTAMPTZ,

  CONSTRAINT valid_date_range CHECK (end_date >= start_date),
  CONSTRAINT partial_day_single_day CHECK (
    partial_day_type IS NULL OR start_date = end_date
  )
);

-- ============================================================
-- 2. Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_tor_facility_user
  ON public.time_off_requests (facility_id, user_id, status)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_tor_facility_dates
  ON public.time_off_requests (facility_id, start_date, end_date)
  WHERE is_active = true;

-- ============================================================
-- 3. Enable RLS
-- ============================================================
ALTER TABLE public.time_off_requests ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 4. RLS Policies
-- ============================================================

-- Global admins: full access to all requests
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polname = 'Global admins can do anything with time_off_requests'
  ) THEN
    CREATE POLICY "Global admins can do anything with time_off_requests"
      ON public.time_off_requests
      USING (public.get_my_access_level() = 'global_admin'::text);
  END IF;
END $$;

-- Facility admins: full access to their facility's requests
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polname = 'Facility admins can manage own facility time_off_requests'
  ) THEN
    CREATE POLICY "Facility admins can manage own facility time_off_requests"
      ON public.time_off_requests
      USING (
        public.get_my_access_level() = 'facility_admin'::text
        AND facility_id = public.get_my_facility_id()
      );
  END IF;
END $$;

-- Staff (user role): SELECT own requests only
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polname = 'Staff can view own time_off_requests'
  ) THEN
    CREATE POLICY "Staff can view own time_off_requests"
      ON public.time_off_requests
      FOR SELECT
      USING (
        user_id = auth.uid()
        AND facility_id = public.get_my_facility_id()
      );
  END IF;
END $$;

-- Staff (user role): INSERT own requests only
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polname = 'Staff can insert own time_off_requests'
  ) THEN
    CREATE POLICY "Staff can insert own time_off_requests"
      ON public.time_off_requests
      FOR INSERT
      WITH CHECK (
        user_id = auth.uid()
        AND facility_id = public.get_my_facility_id()
      );
  END IF;
END $$;

-- Staff (user role): UPDATE own requests (e.g. cancel pending requests)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polname = 'Staff can update own time_off_requests'
  ) THEN
    CREATE POLICY "Staff can update own time_off_requests"
      ON public.time_off_requests
      FOR UPDATE
      USING (
        user_id = auth.uid()
        AND facility_id = public.get_my_facility_id()
      );
  END IF;
END $$;

-- ============================================================
-- 5. Triggers
-- ============================================================

-- Soft delete sync trigger
CREATE TRIGGER sync_soft_delete_time_off_requests
  BEFORE UPDATE ON public.time_off_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_soft_delete_columns();

-- Auto-update updated_at on modification
CREATE TRIGGER set_updated_at_time_off_requests
  BEFORE UPDATE ON public.time_off_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
