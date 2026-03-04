-- Migration: Formalize voice_command_aliases table in version control
-- This table already exists in production; using CREATE TABLE IF NOT EXISTS
-- to ensure idempotent application.

-- ============================================
-- TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.voice_command_aliases (
  id              uuid        NOT NULL DEFAULT gen_random_uuid(),
  facility_id     uuid        REFERENCES public.facilities(id),
  milestone_type_id uuid      REFERENCES public.milestone_types(id),
  facility_milestone_id uuid  REFERENCES public.facility_milestones(id),
  alias_phrase    text        NOT NULL,
  source_alias_id uuid        REFERENCES public.voice_command_aliases(id),
  is_active       boolean     NOT NULL DEFAULT true,
  deleted_at      timestamptz,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  action_type     text        NOT NULL DEFAULT 'record',
  auto_learned    boolean     NOT NULL DEFAULT false,
  CONSTRAINT voice_command_aliases_pkey PRIMARY KEY (id)
);

-- ============================================
-- RLS
-- ============================================

ALTER TABLE public.voice_command_aliases ENABLE ROW LEVEL SECURITY;

-- SELECT: Users can see global templates + their own facility aliases
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polname = 'Users can view global and own facility voice aliases'
  ) THEN
    CREATE POLICY "Users can view global and own facility voice aliases"
      ON public.voice_command_aliases FOR SELECT
      USING (
        facility_id IS NULL
        OR facility_id = public.get_my_facility_id()
        OR public.get_my_access_level() = 'global_admin'
      );
  END IF;
END $$;

-- INSERT: Global admins can insert global templates; facility admins can insert for their facility
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polname = 'Global admins can insert global voice alias templates'
  ) THEN
    CREATE POLICY "Global admins can insert global voice alias templates"
      ON public.voice_command_aliases FOR INSERT
      WITH CHECK (
        (public.get_my_access_level() = 'global_admin' AND facility_id IS NULL)
        OR (public.get_my_access_level() IN ('global_admin', 'facility_admin') AND facility_id IS NOT NULL AND facility_id = public.get_my_facility_id())
      );
  END IF;
END $$;

-- UPDATE: Admins can update aliases in their scope
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polname = 'Admins can update voice aliases in their scope'
  ) THEN
    CREATE POLICY "Admins can update voice aliases in their scope"
      ON public.voice_command_aliases FOR UPDATE
      USING (
        (public.get_my_access_level() = 'global_admin' AND facility_id IS NULL)
        OR (public.get_my_access_level() IN ('global_admin', 'facility_admin') AND facility_id IS NOT NULL AND facility_id = public.get_my_facility_id())
      )
      WITH CHECK (
        (public.get_my_access_level() = 'global_admin' AND facility_id IS NULL)
        OR (public.get_my_access_level() IN ('global_admin', 'facility_admin') AND facility_id IS NOT NULL AND facility_id = public.get_my_facility_id())
      );
  END IF;
END $$;

-- DELETE: Admins can hard-delete aliases in their scope
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polname = 'Admins can delete voice aliases in their scope'
  ) THEN
    CREATE POLICY "Admins can delete voice aliases in their scope"
      ON public.voice_command_aliases FOR DELETE
      USING (
        (public.get_my_access_level() = 'global_admin' AND facility_id IS NULL)
        OR (public.get_my_access_level() IN ('global_admin', 'facility_admin') AND facility_id IS NOT NULL AND facility_id = public.get_my_facility_id())
      );
  END IF;
END $$;

-- ============================================
-- INDEXES (idempotent with IF NOT EXISTS)
-- ============================================

CREATE INDEX IF NOT EXISTS idx_voice_aliases_facility
  ON public.voice_command_aliases (facility_id)
  WHERE facility_id IS NOT NULL AND is_active = true;

CREATE INDEX IF NOT EXISTS idx_voice_aliases_facility_milestone
  ON public.voice_command_aliases (facility_milestone_id)
  WHERE facility_milestone_id IS NOT NULL AND is_active = true;

CREATE INDEX IF NOT EXISTS idx_voice_aliases_milestone_type
  ON public.voice_command_aliases (milestone_type_id)
  WHERE milestone_type_id IS NOT NULL AND is_active = true;

-- Unique constraint: no duplicate phrase per facility+action_type
CREATE UNIQUE INDEX IF NOT EXISTS idx_voice_command_aliases_unique_phrase
  ON public.voice_command_aliases (facility_id, lower(alias_phrase), action_type)
  WHERE is_active = true;

-- Global template uniqueness per milestone
CREATE UNIQUE INDEX IF NOT EXISTS uq_voice_alias_global
  ON public.voice_command_aliases (milestone_type_id, lower(alias_phrase))
  WHERE facility_id IS NULL AND is_active = true;

-- Facility alias uniqueness per facility_milestone
CREATE UNIQUE INDEX IF NOT EXISTS uq_voice_alias_facility
  ON public.voice_command_aliases (facility_id, facility_milestone_id, lower(alias_phrase))
  WHERE facility_id IS NOT NULL AND is_active = true;

-- Per-action-type unique indexes for utility actions (global)
CREATE UNIQUE INDEX IF NOT EXISTS uq_voice_alias_global_next_patient
  ON public.voice_command_aliases (lower(alias_phrase))
  WHERE facility_id IS NULL AND action_type = 'next_patient' AND is_active = true;

CREATE UNIQUE INDEX IF NOT EXISTS uq_voice_alias_global_surgeon_left
  ON public.voice_command_aliases (lower(alias_phrase))
  WHERE facility_id IS NULL AND action_type = 'surgeon_left' AND is_active = true;

CREATE UNIQUE INDEX IF NOT EXISTS uq_voice_alias_global_undo_last
  ON public.voice_command_aliases (lower(alias_phrase))
  WHERE facility_id IS NULL AND action_type = 'undo_last' AND is_active = true;

CREATE UNIQUE INDEX IF NOT EXISTS uq_voice_alias_global_confirm_pending
  ON public.voice_command_aliases (lower(alias_phrase))
  WHERE facility_id IS NULL AND action_type = 'confirm_pending' AND is_active = true;

CREATE UNIQUE INDEX IF NOT EXISTS uq_voice_alias_global_cancel_pending
  ON public.voice_command_aliases (lower(alias_phrase))
  WHERE facility_id IS NULL AND action_type = 'cancel_pending' AND is_active = true;

-- Per-action-type unique indexes for utility actions (facility)
CREATE UNIQUE INDEX IF NOT EXISTS uq_voice_alias_facility_next_patient
  ON public.voice_command_aliases (facility_id, lower(alias_phrase))
  WHERE facility_id IS NOT NULL AND action_type = 'next_patient' AND is_active = true;

CREATE UNIQUE INDEX IF NOT EXISTS uq_voice_alias_facility_surgeon_left
  ON public.voice_command_aliases (facility_id, lower(alias_phrase))
  WHERE facility_id IS NOT NULL AND action_type = 'surgeon_left' AND is_active = true;

CREATE UNIQUE INDEX IF NOT EXISTS uq_voice_alias_facility_undo_last
  ON public.voice_command_aliases (facility_id, lower(alias_phrase))
  WHERE facility_id IS NOT NULL AND action_type = 'undo_last' AND is_active = true;

CREATE UNIQUE INDEX IF NOT EXISTS uq_voice_alias_facility_confirm_pending
  ON public.voice_command_aliases (facility_id, lower(alias_phrase))
  WHERE facility_id IS NOT NULL AND action_type = 'confirm_pending' AND is_active = true;

CREATE UNIQUE INDEX IF NOT EXISTS uq_voice_alias_facility_cancel_pending
  ON public.voice_command_aliases (facility_id, lower(alias_phrase))
  WHERE facility_id IS NOT NULL AND action_type = 'cancel_pending' AND is_active = true;
