-- Fix: audit_case_device_companies_changes() fails with NOT NULL violation on
-- audit_log.user_id when called from service role (e.g. demo data purge).
-- The sibling function audit_case_implants_changes() already has this guard.

CREATE OR REPLACE FUNCTION public.audit_case_device_companies_changes() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_facility_id UUID;
  v_case_number TEXT;
  v_company_name TEXT;
  v_user_id UUID;
  v_user_email TEXT;
  v_platform TEXT;
  v_action TEXT;
  v_target_label TEXT;
  v_old_values JSONB;
  v_new_values JSONB;
BEGIN
  -- Skip audit logging if no user session (service role / demo data generation)
  IF auth.uid() IS NULL THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    ELSE
      RETURN NEW;
    END IF;
  END IF;

  -- Get facility_id and case_number from the case
  SELECT c.facility_id, c.case_number
  INTO v_facility_id, v_case_number
  FROM cases c
  WHERE c.id = COALESCE(NEW.case_id, OLD.case_id);

  -- Get company name
  SELECT name INTO v_company_name
  FROM implant_companies
  WHERE id = COALESCE(NEW.implant_company_id, OLD.implant_company_id);

  -- Determine the user who made the change
  IF TG_OP = 'DELETE' THEN
    v_user_id := auth.uid();
  ELSE
    v_user_id := COALESCE(
      CASE WHEN NEW.delivered_by IS NOT NULL THEN NEW.delivered_by END,
      CASE WHEN NEW.confirmed_by IS NOT NULL THEN NEW.confirmed_by END,
      auth.uid()
    );
  END IF;

  -- Get user email (handle case where user_id might be null)
  IF v_user_id IS NOT NULL THEN
    SELECT email INTO v_user_email
    FROM auth.users
    WHERE id = v_user_id;
  END IF;

  -- Get platform (default to 'web' if not set)
  v_platform := COALESCE(NEW.last_modified_platform, OLD.last_modified_platform, 'web');

  -- Determine action and build old/new values based on what changed
  IF TG_OP = 'INSERT' THEN
    v_action := 'case.implant_company_added';
    v_target_label := format('%s - Case #%s', v_company_name, v_case_number);
    v_new_values := jsonb_build_object(
      'implant_company', v_company_name,
      'case_number', v_case_number,
      'tray_status', NEW.tray_status
    );

  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.tray_status IS DISTINCT FROM NEW.tray_status THEN
      CASE NEW.tray_status
        WHEN 'consignment' THEN
          v_action := 'device_rep.tray_consignment_confirmed';
          v_target_label := format('%s - Case #%s', v_company_name, v_case_number);
          v_old_values := jsonb_build_object('tray_status', OLD.tray_status);
          v_new_values := jsonb_build_object(
            'tray_status', 'consignment',
            'notes', NEW.rep_notes
          );

        WHEN 'loaners_confirmed' THEN
          v_action := 'device_rep.tray_loaners_confirmed';
          v_target_label := format('%s loaner trays - %s - Case #%s', NEW.loaner_tray_count, v_company_name, v_case_number);
          v_old_values := jsonb_build_object('tray_status', OLD.tray_status);
          v_new_values := jsonb_build_object(
            'tray_status', 'loaners_confirmed',
            'loaner_tray_count', NEW.loaner_tray_count,
            'notes', NEW.rep_notes
          );

        WHEN 'delivered' THEN
          v_action := 'device_rep.trays_delivered';
          v_target_label := format('%s trays delivered - %s - Case #%s', COALESCE(NEW.delivered_tray_count, NEW.loaner_tray_count, 0), v_company_name, v_case_number);
          v_old_values := jsonb_build_object(
            'tray_status', OLD.tray_status,
            'loaner_tray_count', OLD.loaner_tray_count
          );
          v_new_values := jsonb_build_object(
            'tray_status', 'delivered',
            'delivered_tray_count', NEW.delivered_tray_count
          );

        WHEN 'pending' THEN
          v_action := 'device_rep.tray_status_reset';
          v_target_label := format('%s - Case #%s', v_company_name, v_case_number);
          v_old_values := jsonb_build_object(
            'tray_status', OLD.tray_status,
            'loaner_tray_count', OLD.loaner_tray_count,
            'delivered_tray_count', OLD.delivered_tray_count
          );
          v_new_values := jsonb_build_object('tray_status', 'pending');

        ELSE
          v_action := 'device_rep.tray_status_changed';
          v_target_label := format('%s - Case #%s', v_company_name, v_case_number);
          v_old_values := jsonb_build_object('tray_status', OLD.tray_status);
          v_new_values := jsonb_build_object('tray_status', NEW.tray_status);
      END CASE;

    ELSIF OLD.rep_notes IS DISTINCT FROM NEW.rep_notes THEN
      v_action := 'device_rep.notes_updated';
      v_target_label := format('%s - Case #%s', v_company_name, v_case_number);
      v_old_values := jsonb_build_object('notes', OLD.rep_notes);
      v_new_values := jsonb_build_object('notes', NEW.rep_notes);

    ELSE
      v_action := 'device_rep.tray_updated';
      v_target_label := format('%s - Case #%s', v_company_name, v_case_number);
      v_old_values := to_jsonb(OLD);
      v_new_values := to_jsonb(NEW);
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'case.implant_company_removed';
    v_target_label := format('%s - Case #%s', v_company_name, v_case_number);
    v_old_values := jsonb_build_object(
      'implant_company', v_company_name,
      'case_number', v_case_number,
      'tray_status', OLD.tray_status
    );
  END IF;

  -- Insert into audit_log
  INSERT INTO audit_log (
    user_id,
    user_email,
    facility_id,
    action,
    target_type,
    target_id,
    target_label,
    old_values,
    new_values,
    metadata,
    success
  ) VALUES (
    v_user_id,
    v_user_email,
    v_facility_id,
    v_action,
    'case_device_company',
    COALESCE(NEW.id, OLD.id),
    v_target_label,
    v_old_values,
    v_new_values,
    jsonb_build_object(
      'platform', v_platform,
      'case_id', COALESCE(NEW.case_id, OLD.case_id),
      'implant_company_id', COALESCE(NEW.implant_company_id, OLD.implant_company_id)
    ),
    true
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;
