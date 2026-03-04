-- Step 1: Update check_action_type to include cement timer action types
ALTER TABLE voice_command_aliases DROP CONSTRAINT IF EXISTS check_action_type;
ALTER TABLE voice_command_aliases ADD CONSTRAINT check_action_type CHECK (
  action_type IN (
    'record', 'cancel', 'undo_last', 'next_patient', 'surgeon_left',
    'confirm_pending', 'cancel_pending',
    'start_cement_timer', 'stop_cement_timer'
  )
);

-- Step 2: Update check_milestone_ref to allow cement timer as general commands (no milestone ref)
ALTER TABLE voice_command_aliases DROP CONSTRAINT IF EXISTS check_milestone_ref;
ALTER TABLE voice_command_aliases ADD CONSTRAINT check_milestone_ref CHECK (
  -- Global milestone template: facility_id NULL, milestone_type_id required, action = record/cancel
  (facility_id IS NULL AND milestone_type_id IS NOT NULL AND facility_milestone_id IS NULL
    AND action_type IN ('record', 'cancel'))
  OR
  -- Facility milestone alias: facility_id + facility_milestone_id required, action = record/cancel
  (facility_id IS NOT NULL AND facility_milestone_id IS NOT NULL AND milestone_type_id IS NULL
    AND action_type IN ('record', 'cancel'))
  OR
  -- General command (no milestone ref): includes original types + cement timer
  (milestone_type_id IS NULL AND facility_milestone_id IS NULL
    AND action_type IN (
      'undo_last', 'next_patient', 'surgeon_left', 'confirm_pending', 'cancel_pending',
      'start_cement_timer', 'stop_cement_timer'
    ))
);

-- Step 3: Add unique indexes for cement timer action types
CREATE UNIQUE INDEX IF NOT EXISTS uq_voice_alias_global_start_cement_timer
  ON voice_command_aliases (alias_phrase, action_type)
  WHERE facility_id IS NULL AND action_type = 'start_cement_timer';

CREATE UNIQUE INDEX IF NOT EXISTS uq_voice_alias_global_stop_cement_timer
  ON voice_command_aliases (alias_phrase, action_type)
  WHERE facility_id IS NULL AND action_type = 'stop_cement_timer';

CREATE UNIQUE INDEX IF NOT EXISTS uq_voice_alias_facility_start_cement_timer
  ON voice_command_aliases (facility_id, alias_phrase, action_type)
  WHERE facility_id IS NOT NULL AND action_type = 'start_cement_timer';

CREATE UNIQUE INDEX IF NOT EXISTS uq_voice_alias_facility_stop_cement_timer
  ON voice_command_aliases (facility_id, alias_phrase, action_type)
  WHERE facility_id IS NOT NULL AND action_type = 'stop_cement_timer';

-- Step 4: Seed cement timer voice command aliases as global templates (facility_id = NULL)
INSERT INTO voice_command_aliases (facility_id, facility_milestone_id, action_type, alias_phrase, is_active, auto_learned)
VALUES
  (NULL, NULL, 'start_cement_timer', 'start a cement timer', true, false),
  (NULL, NULL, 'start_cement_timer', 'start the cement timer', true, false),
  (NULL, NULL, 'start_cement_timer', 'start cement timer', true, false),
  (NULL, NULL, 'start_cement_timer', 'begin cement timer', true, false),
  (NULL, NULL, 'start_cement_timer', 'begin the cement timer', true, false),
  (NULL, NULL, 'start_cement_timer', 'can you start a cement timer', true, false),
  (NULL, NULL, 'stop_cement_timer', 'stop the cement timer', true, false),
  (NULL, NULL, 'stop_cement_timer', 'stop cement timer', true, false),
  (NULL, NULL, 'stop_cement_timer', 'end the cement timer', true, false),
  (NULL, NULL, 'stop_cement_timer', 'dismiss the cement timer', true, false),
  (NULL, NULL, 'stop_cement_timer', 'close the cement timer', true, false);
