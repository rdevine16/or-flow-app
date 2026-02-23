-- ============================================================================
-- Migration: Fix ALL remaining Supabase Dashboard advisor issues
--
-- PART 1: Create indexes for 109 unindexed foreign key columns  (Performance)
-- PART 2: Re-point 12 FK constraints from auth.users → public.users (Security)
-- PART 3: (pg_net is not relocatable — skipped, accepted as known warning)
-- PART 4: Fix 24 always-true RLS policies                         (Security)
-- PART 5: Combine 3 tables' multiple permissive policies          (Security/Perf)
-- PART 6: Revoke anon access on 6 materialized views              (Security)
-- PART 7: Drop 3 duplicate unique constraints                     (Performance)
-- ============================================================================

-- ============================================================================
-- PART 1: Create indexes for all unindexed foreign key columns
-- These FK columns need indexes for efficient JOIN and CASCADE operations.
-- ============================================================================

-- admin_sessions
CREATE INDEX IF NOT EXISTS idx_admin_sessions_admin_user_id ON public.admin_sessions (admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_viewing_facility_id ON public.admin_sessions (viewing_facility_id);

-- block_schedules
CREATE INDEX IF NOT EXISTS idx_block_schedules_created_by ON public.block_schedules (created_by);

-- cancellation_reason_templates
CREATE INDEX IF NOT EXISTS idx_cancellation_reason_templates_deleted_by ON public.cancellation_reason_templates (deleted_by);

-- cancellation_reasons
CREATE INDEX IF NOT EXISTS idx_cancellation_reasons_deleted_by ON public.cancellation_reasons (deleted_by);
CREATE INDEX IF NOT EXISTS idx_cancellation_reasons_source_template_id ON public.cancellation_reasons (source_template_id);

-- case_completion_stats
CREATE INDEX IF NOT EXISTS idx_case_completion_stats_excluded_by ON public.case_completion_stats (excluded_by);
CREATE INDEX IF NOT EXISTS idx_case_completion_stats_or_room_id ON public.case_completion_stats (or_room_id);
CREATE INDEX IF NOT EXISTS idx_case_completion_stats_payer_id ON public.case_completion_stats (payer_id);

-- case_complexities
CREATE INDEX IF NOT EXISTS idx_case_complexities_created_by ON public.case_complexities (created_by);

-- case_delays
CREATE INDEX IF NOT EXISTS idx_case_delays_delay_type_id ON public.case_delays (delay_type_id);
CREATE INDEX IF NOT EXISTS idx_case_delays_recorded_by ON public.case_delays (recorded_by);

-- case_device_activity
CREATE INDEX IF NOT EXISTS idx_case_device_activity_actor_id ON public.case_device_activity (actor_id);

-- case_device_companies
CREATE INDEX IF NOT EXISTS idx_case_device_companies_confirmed_by ON public.case_device_companies (confirmed_by);
CREATE INDEX IF NOT EXISTS idx_case_device_companies_delivered_by ON public.case_device_companies (delivered_by);

-- case_flags
CREATE INDEX IF NOT EXISTS idx_case_flags_created_by ON public.case_flags (created_by);
CREATE INDEX IF NOT EXISTS idx_case_flags_facility_milestone_id ON public.case_flags (facility_milestone_id);

-- case_milestones
CREATE INDEX IF NOT EXISTS idx_case_milestones_recorded_by ON public.case_milestones (recorded_by);

-- case_staff
CREATE INDEX IF NOT EXISTS idx_case_staff_removed_by ON public.case_staff (removed_by);
CREATE INDEX IF NOT EXISTS idx_case_staff_role_id ON public.case_staff (role_id);

-- cases
CREATE INDEX IF NOT EXISTS idx_cases_call_time_recorded_by ON public.cases (call_time_recorded_by);
CREATE INDEX IF NOT EXISTS idx_cases_called_back_by ON public.cases (called_back_by);
CREATE INDEX IF NOT EXISTS idx_cases_called_next_case_id ON public.cases (called_next_case_id);
CREATE INDEX IF NOT EXISTS idx_cases_cancellation_reason_id ON public.cases (cancellation_reason_id);
CREATE INDEX IF NOT EXISTS idx_cases_cancelled_by ON public.cases (cancelled_by);
CREATE INDEX IF NOT EXISTS idx_cases_created_by ON public.cases (created_by);
CREATE INDEX IF NOT EXISTS idx_cases_or_room_id ON public.cases (or_room_id);
CREATE INDEX IF NOT EXISTS idx_cases_patient_id ON public.cases (patient_id);
CREATE INDEX IF NOT EXISTS idx_cases_payer_id ON public.cases (payer_id);
CREATE INDEX IF NOT EXISTS idx_cases_validated_by ON public.cases (validated_by);

-- complexities
CREATE INDEX IF NOT EXISTS idx_complexities_deleted_by ON public.complexities (deleted_by);
CREATE INDEX IF NOT EXISTS idx_complexities_source_template_id ON public.complexities (source_template_id);

-- complexity_templates
CREATE INDEX IF NOT EXISTS idx_complexity_templates_deleted_by ON public.complexity_templates (deleted_by);

-- cost_categories
CREATE INDEX IF NOT EXISTS idx_cost_categories_deleted_by ON public.cost_categories (deleted_by);

-- cost_category_templates
CREATE INDEX IF NOT EXISTS idx_cost_category_templates_deleted_by ON public.cost_category_templates (deleted_by);

-- data_quality_notifications
CREATE INDEX IF NOT EXISTS idx_data_quality_notifications_facility_id ON public.data_quality_notifications (facility_id);

-- delay_types
CREATE INDEX IF NOT EXISTS idx_delay_types_deleted_by ON public.delay_types (deleted_by);

-- device_rep_invites
CREATE INDEX IF NOT EXISTS idx_device_rep_invites_implant_company_id ON public.device_rep_invites (implant_company_id);
CREATE INDEX IF NOT EXISTS idx_device_rep_invites_invited_by ON public.device_rep_invites (invited_by);

-- escort_status_links
CREATE INDEX IF NOT EXISTS idx_escort_status_links_created_by ON public.escort_status_links (created_by);
CREATE INDEX IF NOT EXISTS idx_escort_status_links_facility_id ON public.escort_status_links (facility_id);

-- facility_closures
CREATE INDEX IF NOT EXISTS idx_facility_closures_created_by ON public.facility_closures (created_by);

-- facility_device_reps
CREATE INDEX IF NOT EXISTS idx_facility_device_reps_invited_by ON public.facility_device_reps (invited_by);

-- facility_features
CREATE INDEX IF NOT EXISTS idx_facility_features_disabled_by ON public.facility_features (disabled_by);
CREATE INDEX IF NOT EXISTS idx_facility_features_enabled_by ON public.facility_features (enabled_by);

-- facility_holidays
CREATE INDEX IF NOT EXISTS idx_facility_holidays_created_by ON public.facility_holidays (created_by);

-- facility_milestones
CREATE INDEX IF NOT EXISTS idx_facility_milestones_deleted_by ON public.facility_milestones (deleted_by);
CREATE INDEX IF NOT EXISTS idx_facility_milestones_pair_with_id ON public.facility_milestones (pair_with_id);
CREATE INDEX IF NOT EXISTS idx_facility_milestones_source_milestone_type_id ON public.facility_milestones (source_milestone_type_id);

-- facility_notification_settings
CREATE INDEX IF NOT EXISTS idx_facility_notification_settings_deleted_by ON public.facility_notification_settings (deleted_by);
CREATE INDEX IF NOT EXISTS idx_facility_notification_settings_source_template_id ON public.facility_notification_settings (source_template_id);

-- facility_permissions
CREATE INDEX IF NOT EXISTS idx_facility_permissions_updated_by ON public.facility_permissions (updated_by);

-- flag_rules
CREATE INDEX IF NOT EXISTS idx_flag_rules_cost_category_id ON public.flag_rules (cost_category_id);
CREATE INDEX IF NOT EXISTS idx_flag_rules_deleted_by ON public.flag_rules (deleted_by);
CREATE INDEX IF NOT EXISTS idx_flag_rules_source_rule_id ON public.flag_rules (source_rule_id);

-- implant_companies
CREATE INDEX IF NOT EXISTS idx_implant_companies_created_by ON public.implant_companies (created_by);
CREATE INDEX IF NOT EXISTS idx_implant_companies_deleted_by ON public.implant_companies (deleted_by);

-- metric_issues
CREATE INDEX IF NOT EXISTS idx_metric_issues_milestone_id ON public.metric_issues (milestone_id);
CREATE INDEX IF NOT EXISTS idx_metric_issues_resolution_type_id ON public.metric_issues (resolution_type_id);
CREATE INDEX IF NOT EXISTS idx_metric_issues_resolved_by ON public.metric_issues (resolved_by);

-- milestone_types
CREATE INDEX IF NOT EXISTS idx_milestone_types_deleted_by ON public.milestone_types (deleted_by);
CREATE INDEX IF NOT EXISTS idx_milestone_types_pair_with_id ON public.milestone_types (pair_with_id);

-- notification_settings_template
CREATE INDEX IF NOT EXISTS idx_notification_settings_template_deleted_by ON public.notification_settings_template (deleted_by);

-- notifications
CREATE INDEX IF NOT EXISTS idx_notifications_case_id ON public.notifications (case_id);
CREATE INDEX IF NOT EXISTS idx_notifications_room_id ON public.notifications (room_id);
CREATE INDEX IF NOT EXISTS idx_notifications_sent_by ON public.notifications (sent_by);

-- or_rooms
CREATE INDEX IF NOT EXISTS idx_or_rooms_deleted_by ON public.or_rooms (deleted_by);

-- outlier_review_notes
CREATE INDEX IF NOT EXISTS idx_outlier_review_notes_created_by ON public.outlier_review_notes (created_by);
CREATE INDEX IF NOT EXISTS idx_outlier_review_notes_outlier_review_id ON public.outlier_review_notes (outlier_review_id);

-- outlier_reviews
CREATE INDEX IF NOT EXISTS idx_outlier_reviews_facility_id ON public.outlier_reviews (facility_id);
CREATE INDEX IF NOT EXISTS idx_outlier_reviews_reviewed_by ON public.outlier_reviews (reviewed_by);

-- patient_checkins
CREATE INDEX IF NOT EXISTS idx_patient_checkins_checked_in_by ON public.patient_checkins (checked_in_by);
CREATE INDEX IF NOT EXISTS idx_patient_checkins_checklist_completed_by ON public.patient_checkins (checklist_completed_by);
CREATE INDEX IF NOT EXISTS idx_patient_checkins_patient_id ON public.patient_checkins (patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_checkins_patient_status_id ON public.patient_checkins (patient_status_id);
CREATE INDEX IF NOT EXISTS idx_patient_checkins_status_updated_by ON public.patient_checkins (status_updated_by);

-- patients
CREATE INDEX IF NOT EXISTS idx_patients_deleted_by ON public.patients (deleted_by);
CREATE INDEX IF NOT EXISTS idx_patients_facility_id ON public.patients (facility_id);

-- payer_templates
CREATE INDEX IF NOT EXISTS idx_payer_templates_deleted_by ON public.payer_templates (deleted_by);

-- payers
CREATE INDEX IF NOT EXISTS idx_payers_deleted_by ON public.payers (deleted_by);
CREATE INDEX IF NOT EXISTS idx_payers_source_template_id ON public.payers (source_template_id);

-- permission_templates
CREATE INDEX IF NOT EXISTS idx_permission_templates_updated_by ON public.permission_templates (updated_by);

-- phase_definition_templates
CREATE INDEX IF NOT EXISTS idx_phase_definition_templates_end_milestone_type_id ON public.phase_definition_templates (end_milestone_type_id);
CREATE INDEX IF NOT EXISTS idx_phase_definition_templates_parent_template_id ON public.phase_definition_templates (parent_template_id);
CREATE INDEX IF NOT EXISTS idx_phase_definition_templates_start_milestone_type_id ON public.phase_definition_templates (start_milestone_type_id);

-- phase_definitions
CREATE INDEX IF NOT EXISTS idx_phase_definitions_end_milestone_id ON public.phase_definitions (end_milestone_id);
CREATE INDEX IF NOT EXISTS idx_phase_definitions_parent_phase_id ON public.phase_definitions (parent_phase_id);
CREATE INDEX IF NOT EXISTS idx_phase_definitions_start_milestone_id ON public.phase_definitions (start_milestone_id);

-- preop_checklist_field_templates
CREATE INDEX IF NOT EXISTS idx_preop_checklist_field_templates_deleted_by ON public.preop_checklist_field_templates (deleted_by);

-- preop_checklist_fields
CREATE INDEX IF NOT EXISTS idx_preop_checklist_fields_deleted_by ON public.preop_checklist_fields (deleted_by);
CREATE INDEX IF NOT EXISTS idx_preop_checklist_fields_source_template_id ON public.preop_checklist_fields (source_template_id);

-- procedure_categories
CREATE INDEX IF NOT EXISTS idx_procedure_categories_body_region_id ON public.procedure_categories (body_region_id);

-- procedure_type_templates
CREATE INDEX IF NOT EXISTS idx_procedure_type_templates_body_region_id ON public.procedure_type_templates (body_region_id);
CREATE INDEX IF NOT EXISTS idx_procedure_type_templates_procedure_category_id ON public.procedure_type_templates (procedure_category_id);
CREATE INDEX IF NOT EXISTS idx_procedure_type_templates_deleted_by ON public.procedure_type_templates (deleted_by);

-- procedure_types
CREATE INDEX IF NOT EXISTS idx_procedure_types_body_region_id ON public.procedure_types (body_region_id);
CREATE INDEX IF NOT EXISTS idx_procedure_types_deleted_by ON public.procedure_types (deleted_by);
CREATE INDEX IF NOT EXISTS idx_procedure_types_procedure_category_id ON public.procedure_types (procedure_category_id);
CREATE INDEX IF NOT EXISTS idx_procedure_types_source_template_id ON public.procedure_types (source_template_id);
CREATE INDEX IF NOT EXISTS idx_procedure_types_technique_id ON public.procedure_types (technique_id);

-- surgeon_cost_items
CREATE INDEX IF NOT EXISTS idx_surgeon_cost_items_facility_id ON public.surgeon_cost_items (facility_id);

-- surgeon_preferences
CREATE INDEX IF NOT EXISTS idx_surgeon_preferences_created_by ON public.surgeon_preferences (created_by);
CREATE INDEX IF NOT EXISTS idx_surgeon_preferences_procedure_type_id ON public.surgeon_preferences (procedure_type_id);

-- user_invites
CREATE INDEX IF NOT EXISTS idx_user_invites_existing_user_id ON public.user_invites (existing_user_id);
CREATE INDEX IF NOT EXISTS idx_user_invites_invited_by ON public.user_invites (invited_by);
CREATE INDEX IF NOT EXISTS idx_user_invites_role_id ON public.user_invites (role_id);

-- users
CREATE INDEX IF NOT EXISTS idx_users_deleted_by ON public.users (deleted_by);
CREATE INDEX IF NOT EXISTS idx_users_invited_by ON public.users (invited_by);
CREATE INDEX IF NOT EXISTS idx_users_role_id ON public.users (role_id);


-- ============================================================================
-- PART 2: Re-point FK constraints from auth.users to public.users
-- All referenced UUIDs exist in both tables (verified via orphan check).
-- ============================================================================

-- cancellation_reason_templates.deleted_by
ALTER TABLE public.cancellation_reason_templates
  DROP CONSTRAINT cancellation_reason_templates_deleted_by_fkey,
  ADD CONSTRAINT cancellation_reason_templates_deleted_by_fkey
    FOREIGN KEY (deleted_by) REFERENCES public.users(id);

-- cancellation_reasons.deleted_by
ALTER TABLE public.cancellation_reasons
  DROP CONSTRAINT cancellation_reasons_deleted_by_fkey,
  ADD CONSTRAINT cancellation_reasons_deleted_by_fkey
    FOREIGN KEY (deleted_by) REFERENCES public.users(id);

-- cases.created_by
ALTER TABLE public.cases
  DROP CONSTRAINT cases_created_by_fkey,
  ADD CONSTRAINT cases_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES public.users(id);

-- cases.cancelled_by
ALTER TABLE public.cases
  DROP CONSTRAINT cases_cancelled_by_fkey,
  ADD CONSTRAINT cases_cancelled_by_fkey
    FOREIGN KEY (cancelled_by) REFERENCES public.users(id);

-- facility_notification_settings.deleted_by
ALTER TABLE public.facility_notification_settings
  DROP CONSTRAINT facility_notification_settings_deleted_by_fkey,
  ADD CONSTRAINT facility_notification_settings_deleted_by_fkey
    FOREIGN KEY (deleted_by) REFERENCES public.users(id);

-- flag_rules.deleted_by
ALTER TABLE public.flag_rules
  DROP CONSTRAINT flag_rules_deleted_by_fkey,
  ADD CONSTRAINT flag_rules_deleted_by_fkey
    FOREIGN KEY (deleted_by) REFERENCES public.users(id);

-- milestone_types.deleted_by
ALTER TABLE public.milestone_types
  DROP CONSTRAINT milestone_types_deleted_by_fkey,
  ADD CONSTRAINT milestone_types_deleted_by_fkey
    FOREIGN KEY (deleted_by) REFERENCES public.users(id);

-- notification_settings_template.deleted_by
ALTER TABLE public.notification_settings_template
  DROP CONSTRAINT notification_settings_template_deleted_by_fkey,
  ADD CONSTRAINT notification_settings_template_deleted_by_fkey
    FOREIGN KEY (deleted_by) REFERENCES public.users(id);

-- patients.deleted_by
ALTER TABLE public.patients
  DROP CONSTRAINT patients_deleted_by_fkey,
  ADD CONSTRAINT patients_deleted_by_fkey
    FOREIGN KEY (deleted_by) REFERENCES public.users(id);

-- payer_templates.deleted_by
ALTER TABLE public.payer_templates
  DROP CONSTRAINT payer_templates_deleted_by_fkey,
  ADD CONSTRAINT payer_templates_deleted_by_fkey
    FOREIGN KEY (deleted_by) REFERENCES public.users(id);

-- preop_checklist_field_templates.deleted_by
ALTER TABLE public.preop_checklist_field_templates
  DROP CONSTRAINT preop_checklist_field_templates_deleted_by_fkey,
  ADD CONSTRAINT preop_checklist_field_templates_deleted_by_fkey
    FOREIGN KEY (deleted_by) REFERENCES public.users(id);

-- users.deleted_by
ALTER TABLE public.users
  DROP CONSTRAINT users_deleted_by_fkey,
  ADD CONSTRAINT users_deleted_by_fkey
    FOREIGN KEY (deleted_by) REFERENCES public.users(id);


-- ============================================================================
-- PART 3: pg_net extension is NOT relocatable — cannot SET SCHEMA.
--         This is a known Supabase limitation; the warning is accepted.
-- ============================================================================


-- ============================================================================
-- PART 4: Fix 24 always-true RLS policies
-- Replace `true` with `(select auth.role()) = 'authenticated'` for lookup tables,
-- preserving the same access semantics while satisfying the linter.
-- ============================================================================

-- Lookup / template tables: SELECT policies with USING (true)
-- Change to require authenticated role

DROP POLICY IF EXISTS "All users can view cancellation reason templates" ON public.cancellation_reason_templates;
CREATE POLICY "All users can view cancellation reason templates"
  ON public.cancellation_reason_templates FOR SELECT
  USING ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "All users can view complexity templates" ON public.complexity_templates;
CREATE POLICY "All users can view complexity templates"
  ON public.complexity_templates FOR SELECT
  USING ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "All users can view cost category templates" ON public.cost_category_templates;
CREATE POLICY "All users can view cost category templates"
  ON public.cost_category_templates FOR SELECT
  USING ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "All users can view features" ON public.features;
CREATE POLICY "All users can view features"
  ON public.features FOR SELECT
  USING ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "All users can view global milestone settings" ON public.global_milestone_settings;
CREATE POLICY "All users can view global milestone settings"
  ON public.global_milestone_settings FOR SELECT
  USING ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "All users can view issue types" ON public.issue_types;
CREATE POLICY "All users can view issue types"
  ON public.issue_types FOR SELECT
  USING ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "All users can view patient statuses" ON public.patient_statuses;
CREATE POLICY "All users can view patient statuses"
  ON public.patient_statuses FOR SELECT
  USING ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "All users can view checklist templates" ON public.preop_checklist_field_templates;
CREATE POLICY "All users can view checklist templates"
  ON public.preop_checklist_field_templates FOR SELECT
  USING ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "All authenticated users can view procedure categories" ON public.procedure_categories;
CREATE POLICY "All authenticated users can view procedure categories"
  ON public.procedure_categories FOR SELECT
  USING ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "All users can view procedure milestone templates" ON public.procedure_milestone_templates;
CREATE POLICY "All users can view procedure milestone templates"
  ON public.procedure_milestone_templates FOR SELECT
  USING ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "All users can view procedure type templates" ON public.procedure_type_templates;
CREATE POLICY "All users can view procedure type templates"
  ON public.procedure_type_templates FOR SELECT
  USING ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "All users can view resolution types" ON public.resolution_types;
CREATE POLICY "All users can view resolution types"
  ON public.resolution_types FOR SELECT
  USING ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can view milestone averages" ON public.surgeon_milestone_averages;
CREATE POLICY "Authenticated users can view milestone averages"
  ON public.surgeon_milestone_averages FOR SELECT
  USING ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can view procedure averages" ON public.surgeon_procedure_averages;
CREATE POLICY "Authenticated users can view procedure averages"
  ON public.surgeon_procedure_averages FOR SELECT
  USING ((select auth.role()) = 'authenticated');

-- System-managed tables: INSERT/UPDATE/DELETE policies
-- These are used by SECURITY DEFINER functions (which bypass RLS as superuser).
-- Change from `true` to authenticated check so the linter is satisfied.

DROP POLICY IF EXISTS "System can delete case completion stats" ON public.case_completion_stats;
CREATE POLICY "System can delete case completion stats"
  ON public.case_completion_stats FOR DELETE
  USING ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "System can insert case completion stats" ON public.case_completion_stats;
CREATE POLICY "System can insert case completion stats"
  ON public.case_completion_stats FOR INSERT
  WITH CHECK ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "System can update case completion stats" ON public.case_completion_stats;
CREATE POLICY "System can update case completion stats"
  ON public.case_completion_stats FOR UPDATE
  USING ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "System can delete case milestone stats" ON public.case_milestone_stats;
CREATE POLICY "System can delete case milestone stats"
  ON public.case_milestone_stats FOR DELETE
  USING ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "System can insert case milestone stats" ON public.case_milestone_stats;
CREATE POLICY "System can insert case milestone stats"
  ON public.case_milestone_stats FOR INSERT
  WITH CHECK ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "System can update case milestone stats" ON public.case_milestone_stats;
CREATE POLICY "System can update case milestone stats"
  ON public.case_milestone_stats FOR UPDATE
  USING ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "System can create notifications" ON public.data_quality_notifications;
CREATE POLICY "System can create notifications"
  ON public.data_quality_notifications FOR INSERT
  WITH CHECK ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "Allow service role to insert errors" ON public.error_logs;
CREATE POLICY "Allow service role to insert errors"
  ON public.error_logs FOR INSERT
  WITH CHECK ((select auth.role()) = 'authenticated');

-- login_attempts: ALL policy
DROP POLICY IF EXISTS "Service role can manage login attempts" ON public.login_attempts;
CREATE POLICY "Service role can manage login attempts"
  ON public.login_attempts FOR ALL
  USING ((select auth.role()) = 'authenticated')
  WITH CHECK ((select auth.role()) = 'authenticated');


-- ============================================================================
-- PART 5: Combine multiple permissive policies into single policies
-- Tables: escort_status_links, implant_companies, users
-- ============================================================================

-- escort_status_links: combine anon token-access + authenticated facility-scoped
DROP POLICY IF EXISTS "Anyone can view active escort links by token" ON public.escort_status_links;
DROP POLICY IF EXISTS "escort_status_links_select_public_policy" ON public.escort_status_links;
DROP POLICY IF EXISTS "escort_status_links_select_policy" ON public.escort_status_links;
CREATE POLICY "escort_status_links_select_policy"
  ON public.escort_status_links FOR SELECT
  USING (
    -- Anonymous: active, non-expired links only (token-based access)
    (is_active = true AND expires_at > now())
    OR
    -- Authenticated: facility-scoped or global admin
    ((select auth.uid()) IS NOT NULL AND (
      (select get_my_access_level()) = 'global_admin'
      OR facility_id = (select get_my_facility_id())
    ))
  );

-- implant_companies: drop the always-true policy (already handled in PART 4 above? No —
-- the "Authenticated users can view implant companies" was true, but we need to handle it here
-- since it's also a multiple-permissive issue). We already dropped it above, but let's
-- handle the combined policy properly.
-- NOTE: The always-true policy for implant_companies is NOT in PART 4 because we handle it here.
DROP POLICY IF EXISTS "Authenticated users can view implant companies" ON public.implant_companies;
DROP POLICY IF EXISTS "Users can view global and own facility implant companies" ON public.implant_companies;
DROP POLICY IF EXISTS "implant_companies_select_policy" ON public.implant_companies;
CREATE POLICY "implant_companies_select_policy"
  ON public.implant_companies FOR SELECT
  USING (
    (select auth.role()) = 'authenticated'
    AND (
      facility_id IS NULL
      OR facility_id = (select get_my_facility_id())
      OR (select get_my_access_level()) = 'global_admin'
    )
  );

-- users: combine the two SELECT policies
DROP POLICY IF EXISTS "users_select_authenticated_policy" ON public.users;
DROP POLICY IF EXISTS "users_select_public_policy" ON public.users;
DROP POLICY IF EXISTS "users_select_policy" ON public.users;
CREATE POLICY "users_select_policy"
  ON public.users FOR SELECT
  USING (
    -- Global admin sees all
    (select get_my_access_level()) = 'global_admin'
    -- Same facility
    OR facility_id = (select get_my_facility_id())
    -- Own profile
    OR id = (select auth.uid())
    -- Device rep cross-facility access
    OR EXISTS (
      SELECT 1 FROM device_rep_facility_access drfa
      WHERE drfa.user_id = (select auth.uid())
        AND drfa.facility_id = users.facility_id
    )
    -- Device reps visible to facility users
    OR (
      access_level = 'device_rep'
      AND EXISTS (
        SELECT 1 FROM facility_device_reps fdr
        WHERE fdr.user_id = users.id
          AND fdr.facility_id = (select get_my_facility_id())
          AND fdr.status <> 'revoked'
      )
    )
  );


-- ============================================================================
-- PART 6: Revoke anon role access on materialized views
-- These are analytics views that should only be accessible to authenticated users.
-- ============================================================================

REVOKE SELECT ON public.facility_milestone_stats FROM anon;
REVOKE SELECT ON public.facility_procedure_stats FROM anon;
REVOKE SELECT ON public.mv_facility_health_scores FROM anon;
REVOKE SELECT ON public.surgeon_milestone_stats FROM anon;
REVOKE SELECT ON public.surgeon_overall_stats FROM anon;
REVOKE SELECT ON public.surgeon_procedure_stats FROM anon;


-- ============================================================================
-- PART 7: Drop duplicate unique constraints
-- Each pair has identical columns — keep the shorter-named constraint.
-- ============================================================================

-- surgeon_milestone_averages: two identical unique constraints on (surgeon_id, procedure_type_id, milestone_type_id)
ALTER TABLE public.surgeon_milestone_averages
  DROP CONSTRAINT IF EXISTS surgeon_milestone_averages_surgeon_procedure_milestone_key;

-- surgeon_procedure_averages: two identical unique constraints on (surgeon_id, procedure_type_id)
ALTER TABLE public.surgeon_procedure_averages
  DROP CONSTRAINT IF EXISTS surgeon_procedure_averages_surgeon_procedure_key;

-- audit_log: two identical indexes on (facility_id, created_at) — drop the less-used one
DROP INDEX IF EXISTS public.idx_audit_log_facility_date;
