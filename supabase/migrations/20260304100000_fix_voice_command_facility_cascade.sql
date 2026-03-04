-- Fix voice_command_logs and voice_command_aliases FK constraints
-- Both were missing ON DELETE CASCADE, causing 409 errors when deleting facilities

-- voice_command_logs: drop and re-add with CASCADE
ALTER TABLE public.voice_command_logs
  DROP CONSTRAINT IF EXISTS voice_command_logs_facility_id_fkey;

ALTER TABLE public.voice_command_logs
  ADD CONSTRAINT voice_command_logs_facility_id_fkey
  FOREIGN KEY (facility_id) REFERENCES public.facilities(id) ON DELETE CASCADE;

-- voice_command_aliases: drop and re-add with CASCADE
ALTER TABLE public.voice_command_aliases
  DROP CONSTRAINT IF EXISTS voice_command_aliases_facility_id_fkey;

ALTER TABLE public.voice_command_aliases
  ADD CONSTRAINT voice_command_aliases_facility_id_fkey
  FOREIGN KEY (facility_id) REFERENCES public.facilities(id) ON DELETE CASCADE;
