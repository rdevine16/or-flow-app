create extension if not exists "pg_cron" with schema "pg_catalog";

drop extension if exists "pg_net";

create extension if not exists "pg_net" with schema "public";

drop policy "Users can view own facility block_schedules" on "public"."block_schedules";

drop policy "block_schedules_all_public_policy" on "public"."block_schedules";

drop policy "Users can view own facility case complexities" on "public"."case_complexities";

drop policy "case_complexities_all_public_policy" on "public"."case_complexities";

drop policy "Users can view templates and own facility complexities" on "public"."complexities";

drop policy "complexities_all_public_policy" on "public"."complexities";

drop policy "Global admins can manage complexity templates" on "public"."complexity_templates";

drop policy "cost_categories_all_public_policy" on "public"."cost_categories";

drop policy "cost_categories_select_public_policy" on "public"."cost_categories";

drop policy "Global admins can manage cost category templates" on "public"."cost_category_templates";

drop policy "delay_types_select_public_policy" on "public"."delay_types";

drop policy "Global admins can manage facility access" on "public"."device_rep_facility_access";

drop policy "Users can view own facility access" on "public"."device_rep_facility_access";

drop policy "device_rep_invites_select_public_policy" on "public"."device_rep_invites";

drop policy "Admins can manage own facility escort links" on "public"."escort_status_links";

drop policy "facilities_select_public_policy" on "public"."facilities";

drop policy "Admins can manage their facility settings" on "public"."facility_analytics_settings";

drop policy "Users can view their facility settings" on "public"."facility_analytics_settings";

drop policy "Users can view own facility closures" on "public"."facility_closures";

drop policy "facility_closures_all_public_policy" on "public"."facility_closures";

drop policy "Global admins can manage facility features" on "public"."facility_features";

drop policy "facility_features_select_public_policy" on "public"."facility_features";

drop policy "Users can view own facility holidays" on "public"."facility_holidays";

drop policy "facility_holidays_all_public_policy" on "public"."facility_holidays";

drop policy "facility_milestones_all_public_policy" on "public"."facility_milestones";

drop policy "facility_milestones_select_public_policy" on "public"."facility_milestones";

drop policy "Facility admins can delete own facility notification settings" on "public"."facility_notification_settings";

drop policy "Facility admins can insert own facility notification settings" on "public"."facility_notification_settings";

drop policy "Facility admins can update own facility notification settings" on "public"."facility_notification_settings";

drop policy "Global admins can manage all facility notification settings" on "public"."facility_notification_settings";

drop policy "Users can view own facility notification settings" on "public"."facility_notification_settings";

drop policy "Users can view own facility permissions" on "public"."facility_permissions";

drop policy "facility_permissions_all_public_policy" on "public"."facility_permissions";

drop policy "Global admins can manage features" on "public"."features";

drop policy "Admins can manage their facility targets" on "public"."financial_targets";

drop policy "Users can view their facility targets" on "public"."financial_targets";

drop policy "Admins can manage their facility flag rules" on "public"."flag_rules";

drop policy "Users can view their facility flag rules" on "public"."flag_rules";

drop policy "metric_issues_insert_public_policy" on "public"."metric_issues";

drop policy "Facility admins can manage review notes" on "public"."outlier_review_notes";

drop policy "Users can view own facility review notes" on "public"."outlier_review_notes";

drop policy "Facility admins can manage reviews" on "public"."outlier_reviews";

drop policy "Users can view own facility reviews" on "public"."outlier_reviews";

drop policy "patient_checkins_all_public_policy" on "public"."patient_checkins";

drop policy "patient_checkins_select_public_policy" on "public"."patient_checkins";

drop policy "Global admins can manage patient statuses" on "public"."patient_statuses";

drop policy "Facility admins can view permission templates" on "public"."permission_templates";

drop policy "Global admins can manage permission templates" on "public"."permission_templates";

drop policy "Authenticated users can view permissions" on "public"."permissions";

drop policy "Global admins can manage permissions" on "public"."permissions";

drop policy "Global admins can manage checklist templates" on "public"."preop_checklist_field_templates";

drop policy "Admins can manage own facility checklist fields" on "public"."preop_checklist_fields";

drop policy "preop_checklist_fields_select_public_policy" on "public"."preop_checklist_fields";

drop policy "procedure_cost_items_all_public_policy" on "public"."procedure_cost_items";

drop policy "procedure_cost_items_select_public_policy" on "public"."procedure_cost_items";

drop policy "procedure_reimbursements_all_public_policy" on "public"."procedure_reimbursements";

drop policy "procedure_reimbursements_select_public_policy" on "public"."procedure_reimbursements";

drop policy "Global admins can manage procedure type templates" on "public"."procedure_type_templates";

drop policy "Admins can manage their facility room schedules" on "public"."room_schedules";

drop policy "Users can view their facility room schedules" on "public"."room_schedules";

drop policy "Users can delete surgeon colors for their facility" on "public"."surgeon_colors";

drop policy "Users can manage surgeon colors for their facility" on "public"."surgeon_colors";

drop policy "Users can update surgeon colors for their facility" on "public"."surgeon_colors";

drop policy "surgeon_colors_all_public_policy" on "public"."surgeon_colors";

drop policy "surgeon_colors_select_public_policy" on "public"."surgeon_colors";

drop policy "surgeon_cost_items_all_public_policy" on "public"."surgeon_cost_items";

drop policy "surgeon_cost_items_select_public_policy" on "public"."surgeon_cost_items";

drop policy "surgeon_procedure_duration_all_public_policy" on "public"."surgeon_procedure_duration";

drop policy "surgeon_procedure_duration_select_public_policy" on "public"."surgeon_procedure_duration";

drop policy "Facility admins can create invites for own facility" on "public"."user_invites";

drop policy "Facility admins can delete own facility invites" on "public"."user_invites";

drop policy "Facility admins can update own facility invites" on "public"."user_invites";

drop policy "Global admins can manage all user invites" on "public"."user_invites";

drop policy "user_invites_select_public_policy" on "public"."user_invites";

CREATE INDEX idx_audit_log_created_at ON public.audit_log USING btree (created_at DESC);

CREATE INDEX idx_audit_log_facility_action_created ON public.audit_log USING btree (facility_id, action, created_at DESC);

CREATE INDEX idx_audit_log_facility_created ON public.audit_log USING btree (facility_id, created_at DESC);

CREATE INDEX idx_block_schedules_day ON public.block_schedules USING btree (day_of_week) WHERE (deleted_at IS NULL);

CREATE INDEX idx_block_schedules_facility ON public.block_schedules USING btree (facility_id) WHERE (deleted_at IS NULL);

CREATE INDEX idx_block_schedules_surgeon ON public.block_schedules USING btree (surgeon_id) WHERE (deleted_at IS NULL);

CREATE INDEX idx_cancellation_reason_templates_active ON public.cancellation_reason_templates USING btree (is_active) WHERE ((is_active = true) AND (deleted_at IS NULL));

CREATE INDEX idx_cancellation_reasons_active ON public.cancellation_reasons USING btree (facility_id, is_active) WHERE ((is_active = true) AND (deleted_at IS NULL));

CREATE INDEX idx_case_delays_case ON public.case_delays USING btree (case_id);

CREATE INDEX idx_case_device_activity_case ON public.case_device_activity USING btree (case_id);

CREATE INDEX idx_case_device_activity_company ON public.case_device_activity USING btree (implant_company_id) WHERE (implant_company_id IS NOT NULL);

CREATE INDEX idx_case_device_companies_pending ON public.case_device_companies USING btree (tray_status) WHERE (tray_status = 'pending'::text);

CREATE INDEX idx_case_device_companies_status ON public.case_device_companies USING btree (tray_status);

CREATE INDEX idx_case_flags_case_id ON public.case_flags USING btree (case_id);

CREATE INDEX idx_case_flags_created_at ON public.case_flags USING btree (created_at DESC);

CREATE INDEX idx_case_flags_delay_type_id ON public.case_flags USING btree (delay_type_id);

CREATE INDEX idx_case_flags_facility_severity ON public.case_flags USING btree (facility_id, severity, created_at DESC);

CREATE INDEX idx_case_flags_flag_rule_id ON public.case_flags USING btree (flag_rule_id);

CREATE INDEX idx_case_flags_flag_type ON public.case_flags USING btree (flag_type);

CREATE INDEX idx_case_implant_companies_company ON public.case_implant_companies USING btree (implant_company_id);

CREATE INDEX idx_case_milestones_recorded ON public.case_milestones USING btree (recorded_at);

CREATE INDEX idx_cases_called_back ON public.cases USING btree (called_back_at) WHERE (called_back_at IS NOT NULL);

CREATE INDEX idx_cases_data_validated ON public.cases USING btree (data_validated) WHERE (data_validated = true);

CREATE INDEX idx_cases_facility_date ON public.cases USING btree (facility_id, scheduled_date);

CREATE INDEX idx_cases_facility_status_date ON public.cases USING btree (facility_id, status_id, scheduled_date);

CREATE INDEX idx_cases_procedure_type_id ON public.cases USING btree (procedure_type_id);

CREATE INDEX idx_cases_scheduled_date ON public.cases USING btree (scheduled_date);

CREATE INDEX idx_cases_status ON public.cases USING btree (status_id);

CREATE INDEX idx_cases_surgeon_date ON public.cases USING btree (surgeon_id, scheduled_date) WHERE (surgeon_id IS NOT NULL);

CREATE INDEX idx_cases_validation_status ON public.cases USING btree (data_validated, is_excluded_from_metrics);

CREATE INDEX idx_ccs_case_date ON public.case_completion_stats USING btree (case_date);

CREATE INDEX idx_ccs_facility_procedure ON public.case_completion_stats USING btree (facility_id, procedure_type_id);

CREATE INDEX idx_ccs_facility_surgeon_procedure ON public.case_completion_stats USING btree (facility_id, surgeon_id, procedure_type_id);

CREATE INDEX idx_ccs_not_excluded ON public.case_completion_stats USING btree (facility_id, case_date) WHERE ((is_excluded = false) OR (is_excluded IS NULL));

CREATE INDEX idx_ccs_surgeon ON public.case_completion_stats USING btree (surgeon_id) WHERE (surgeon_id IS NOT NULL);

CREATE INDEX idx_cms_facility_procedure_milestone ON public.case_milestone_stats USING btree (facility_id, procedure_type_id, milestone_type_id);

CREATE INDEX idx_cms_surgeon_procedure_milestone ON public.case_milestone_stats USING btree (surgeon_id, procedure_type_id, milestone_type_id);

CREATE INDEX idx_dq_notifications_user ON public.data_quality_notifications USING btree (user_id, is_read, created_at DESC);

CREATE INDEX idx_error_logs_category ON public.error_logs USING btree (category);

CREATE INDEX idx_error_logs_created_at ON public.error_logs USING btree (created_at DESC);

CREATE INDEX idx_error_logs_facility_created ON public.error_logs USING btree (facility_id, created_at DESC);

CREATE INDEX idx_escort_status_links_checkin ON public.escort_status_links USING btree (checkin_id);

CREATE INDEX idx_facility_closures_date ON public.facility_closures USING btree (closure_date);

CREATE INDEX idx_facility_device_reps_status ON public.facility_device_reps USING btree (status);

CREATE INDEX idx_facility_device_reps_user ON public.facility_device_reps USING btree (user_id);

CREATE INDEX idx_flag_rules_facility_id ON public.flag_rules USING btree (facility_id);

CREATE INDEX idx_flag_rules_metric ON public.flag_rules USING btree (metric);

CREATE INDEX idx_metric_issues_expires ON public.metric_issues USING btree (expires_at) WHERE (resolved_at IS NULL);

CREATE INDEX idx_metric_issues_facility ON public.metric_issues USING btree (facility_id);

CREATE INDEX idx_metric_issues_unresolved ON public.metric_issues USING btree (facility_id, resolved_at) WHERE (resolved_at IS NULL);

CREATE INDEX idx_notification_reads_user ON public.notification_reads USING btree (user_id);

CREATE INDEX idx_notifications_created ON public.notifications USING btree (created_at DESC);

CREATE INDEX idx_notifications_expires ON public.notifications USING btree (expires_at);

CREATE INDEX idx_notifications_facility ON public.notifications USING btree (facility_id);

CREATE INDEX idx_or_rooms_display_order ON public.or_rooms USING btree (facility_id, display_order);

CREATE INDEX idx_or_rooms_facility_active ON public.or_rooms USING btree (facility_id, is_active) WHERE (deleted_at IS NULL);

CREATE INDEX idx_patient_checkins_date ON public.patient_checkins USING btree (facility_id, expected_arrival_time);

CREATE INDEX idx_payers_facility_active ON public.payers USING btree (facility_id, is_active) WHERE (deleted_at IS NULL);

CREATE INDEX idx_pci_effective_range ON public.procedure_cost_items USING btree (procedure_type_id, facility_id, effective_from, effective_to);

CREATE INDEX idx_preop_checklist_fields_active ON public.preop_checklist_fields USING btree (facility_id, is_active) WHERE ((is_active = true) AND (deleted_at IS NULL));

CREATE INDEX idx_procedure_categories_order ON public.procedure_categories USING btree (display_order);

CREATE INDEX idx_procedure_cost_items_active ON public.procedure_cost_items USING btree (facility_id, procedure_type_id, cost_category_id) WHERE (effective_to IS NULL);

CREATE INDEX idx_procedure_cost_items_facility ON public.procedure_cost_items USING btree (facility_id);

CREATE INDEX idx_procedure_reimbursements_facility ON public.procedure_reimbursements USING btree (facility_id);

CREATE INDEX idx_procedure_reimbursements_payer ON public.procedure_reimbursements USING btree (payer_id);

CREATE INDEX idx_procedure_reimbursements_procedure ON public.procedure_reimbursements USING btree (procedure_type_id);

CREATE INDEX idx_procedure_types_facility_active ON public.procedure_types USING btree (facility_id, is_active) WHERE (deleted_at IS NULL);

CREATE INDEX idx_room_schedules_effective ON public.room_schedules USING btree (or_room_id, day_of_week, effective_start, effective_end);

CREATE INDEX idx_room_schedules_facility ON public.room_schedules USING btree (facility_id);

CREATE INDEX idx_surgeon_preferences_facility ON public.surgeon_preferences USING btree (facility_id);

CREATE INDEX idx_surgeon_preferences_surgeon ON public.surgeon_preferences USING btree (surgeon_id);

CREATE INDEX idx_surgeon_procedure_duration_facility_procedure ON public.surgeon_procedure_duration USING btree (facility_id, procedure_type_id);

CREATE INDEX idx_surgeon_scorecards_lookup ON public.surgeon_scorecards USING btree (facility_id, surgeon_id, created_at DESC);

CREATE INDEX idx_user_invites_facility ON public.user_invites USING btree (facility_id);

CREATE INDEX idx_user_invites_pending ON public.user_invites USING btree (email, facility_id) WHERE (accepted_at IS NULL);

CREATE INDEX idx_user_sessions_expires_at ON public.user_sessions USING btree (expires_at);

CREATE INDEX idx_user_sessions_user_id ON public.user_sessions USING btree (user_id);

CREATE INDEX idx_users_facility ON public.users USING btree (facility_id);

CREATE INDEX idx_users_implant_company ON public.users USING btree (implant_company_id);


  create policy "block_schedules_delete"
  on "public"."block_schedules"
  as permissive
  for delete
  to public
using ((((( SELECT public.get_my_access_level() AS get_my_access_level) = 'facility_admin'::text) AND (facility_id = ( SELECT public.get_my_facility_id() AS get_my_facility_id))) OR (( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text)));



  create policy "block_schedules_insert"
  on "public"."block_schedules"
  as permissive
  for insert
  to public
with check ((((( SELECT public.get_my_access_level() AS get_my_access_level) = 'facility_admin'::text) AND (facility_id = ( SELECT public.get_my_facility_id() AS get_my_facility_id))) OR (( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text)));



  create policy "block_schedules_select"
  on "public"."block_schedules"
  as permissive
  for select
  to public
using (((facility_id = ( SELECT public.get_my_facility_id() AS get_my_facility_id)) OR (( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text)));



  create policy "block_schedules_update"
  on "public"."block_schedules"
  as permissive
  for update
  to public
using ((((( SELECT public.get_my_access_level() AS get_my_access_level) = 'facility_admin'::text) AND (facility_id = ( SELECT public.get_my_facility_id() AS get_my_facility_id))) OR (( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text)));



  create policy "case_complexities_delete"
  on "public"."case_complexities"
  as permissive
  for delete
  to public
using ((((( SELECT public.get_my_access_level() AS get_my_access_level) = ANY (ARRAY['facility_admin'::text, 'user'::text])) AND (case_id IN ( SELECT cases.id
   FROM public.cases
  WHERE (cases.facility_id = ( SELECT public.get_my_facility_id() AS get_my_facility_id))))) OR (( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text)));



  create policy "case_complexities_insert"
  on "public"."case_complexities"
  as permissive
  for insert
  to public
with check ((((( SELECT public.get_my_access_level() AS get_my_access_level) = ANY (ARRAY['facility_admin'::text, 'user'::text])) AND (case_id IN ( SELECT cases.id
   FROM public.cases
  WHERE (cases.facility_id = ( SELECT public.get_my_facility_id() AS get_my_facility_id))))) OR (( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text)));



  create policy "case_complexities_select"
  on "public"."case_complexities"
  as permissive
  for select
  to public
using (((case_id IN ( SELECT cases.id
   FROM public.cases
  WHERE (cases.facility_id = ( SELECT public.get_my_facility_id() AS get_my_facility_id)))) OR (( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text)));



  create policy "case_complexities_update"
  on "public"."case_complexities"
  as permissive
  for update
  to public
using ((((( SELECT public.get_my_access_level() AS get_my_access_level) = ANY (ARRAY['facility_admin'::text, 'user'::text])) AND (case_id IN ( SELECT cases.id
   FROM public.cases
  WHERE (cases.facility_id = ( SELECT public.get_my_facility_id() AS get_my_facility_id))))) OR (( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text)));



  create policy "complexities_delete"
  on "public"."complexities"
  as permissive
  for delete
  to public
using ((((( SELECT public.get_my_access_level() AS get_my_access_level) = 'facility_admin'::text) AND (facility_id = ( SELECT public.get_my_facility_id() AS get_my_facility_id))) OR (( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text)));



  create policy "complexities_insert"
  on "public"."complexities"
  as permissive
  for insert
  to public
with check ((((( SELECT public.get_my_access_level() AS get_my_access_level) = 'facility_admin'::text) AND (facility_id = ( SELECT public.get_my_facility_id() AS get_my_facility_id))) OR (( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text)));



  create policy "complexities_select"
  on "public"."complexities"
  as permissive
  for select
  to public
using (((facility_id IS NULL) OR (facility_id = ( SELECT public.get_my_facility_id() AS get_my_facility_id)) OR (( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text)));



  create policy "complexities_update"
  on "public"."complexities"
  as permissive
  for update
  to public
using ((((( SELECT public.get_my_access_level() AS get_my_access_level) = 'facility_admin'::text) AND (facility_id = ( SELECT public.get_my_facility_id() AS get_my_facility_id))) OR (( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text)));



  create policy "complexity_templates_delete"
  on "public"."complexity_templates"
  as permissive
  for delete
  to public
using ((( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text));



  create policy "complexity_templates_insert"
  on "public"."complexity_templates"
  as permissive
  for insert
  to public
with check ((( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text));



  create policy "complexity_templates_select"
  on "public"."complexity_templates"
  as permissive
  for select
  to public
using ((( SELECT auth.role() AS role) = 'authenticated'::text));



  create policy "complexity_templates_update"
  on "public"."complexity_templates"
  as permissive
  for update
  to public
using ((( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text));



  create policy "cost_categories_delete"
  on "public"."cost_categories"
  as permissive
  for delete
  to public
using ((((( SELECT public.get_my_access_level() AS get_my_access_level) = 'facility_admin'::text) AND (facility_id = ( SELECT public.get_my_facility_id() AS get_my_facility_id))) OR (( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text)));



  create policy "cost_categories_insert"
  on "public"."cost_categories"
  as permissive
  for insert
  to public
with check ((((( SELECT public.get_my_access_level() AS get_my_access_level) = 'facility_admin'::text) AND (facility_id = ( SELECT public.get_my_facility_id() AS get_my_facility_id))) OR (( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text)));



  create policy "cost_categories_select"
  on "public"."cost_categories"
  as permissive
  for select
  to public
using (((( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text) OR ((facility_id = ( SELECT public.get_my_facility_id() AS get_my_facility_id)) AND ((deleted_at IS NULL) OR (deleted_at > (now() - '30 days'::interval))))));



  create policy "cost_categories_update"
  on "public"."cost_categories"
  as permissive
  for update
  to public
using ((((( SELECT public.get_my_access_level() AS get_my_access_level) = 'facility_admin'::text) AND (facility_id = ( SELECT public.get_my_facility_id() AS get_my_facility_id))) OR (( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text)));



  create policy "cost_category_templates_delete"
  on "public"."cost_category_templates"
  as permissive
  for delete
  to public
using ((( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text));



  create policy "cost_category_templates_insert"
  on "public"."cost_category_templates"
  as permissive
  for insert
  to public
with check ((( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text));



  create policy "cost_category_templates_select"
  on "public"."cost_category_templates"
  as permissive
  for select
  to public
using ((( SELECT auth.role() AS role) = 'authenticated'::text));



  create policy "cost_category_templates_update"
  on "public"."cost_category_templates"
  as permissive
  for update
  to public
using ((( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text));



  create policy "delay_types_select_policy"
  on "public"."delay_types"
  as permissive
  for select
  to public
using (((( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text) OR (facility_id IS NULL) OR (facility_id = ( SELECT public.get_my_facility_id() AS get_my_facility_id))));



  create policy "device_rep_facility_access_delete"
  on "public"."device_rep_facility_access"
  as permissive
  for delete
  to public
using ((( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text));



  create policy "device_rep_facility_access_insert"
  on "public"."device_rep_facility_access"
  as permissive
  for insert
  to public
with check ((( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text));



  create policy "device_rep_facility_access_select"
  on "public"."device_rep_facility_access"
  as permissive
  for select
  to public
using (((user_id = ( SELECT auth.uid() AS uid)) OR (( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text)));



  create policy "device_rep_facility_access_update"
  on "public"."device_rep_facility_access"
  as permissive
  for update
  to public
using ((( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text));



  create policy "device_rep_invites_select_policy"
  on "public"."device_rep_invites"
  as permissive
  for select
  to public
using (((( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text) OR ((( SELECT public.get_my_access_level() AS get_my_access_level) = 'facility_admin'::text) AND (facility_id = ( SELECT public.get_my_facility_id() AS get_my_facility_id)))));



  create policy "escort_status_links_delete"
  on "public"."escort_status_links"
  as permissive
  for delete
  to public
using (((( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text) OR ((( SELECT public.get_my_access_level() AS get_my_access_level) = 'facility_admin'::text) AND (facility_id = ( SELECT public.get_my_facility_id() AS get_my_facility_id))) OR (facility_id = ( SELECT public.get_my_facility_id() AS get_my_facility_id))));



  create policy "escort_status_links_insert"
  on "public"."escort_status_links"
  as permissive
  for insert
  to public
with check (((( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text) OR ((( SELECT public.get_my_access_level() AS get_my_access_level) = 'facility_admin'::text) AND (facility_id = ( SELECT public.get_my_facility_id() AS get_my_facility_id))) OR (facility_id = ( SELECT public.get_my_facility_id() AS get_my_facility_id))));



  create policy "escort_status_links_select"
  on "public"."escort_status_links"
  as permissive
  for select
  to public
using ((((is_active = true) AND (expires_at > now())) OR ((( SELECT auth.uid() AS uid) IS NOT NULL) AND ((( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text) OR (facility_id = ( SELECT public.get_my_facility_id() AS get_my_facility_id))))));



  create policy "escort_status_links_update"
  on "public"."escort_status_links"
  as permissive
  for update
  to public
using (((( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text) OR ((( SELECT public.get_my_access_level() AS get_my_access_level) = 'facility_admin'::text) AND (facility_id = ( SELECT public.get_my_facility_id() AS get_my_facility_id))) OR (facility_id = ( SELECT public.get_my_facility_id() AS get_my_facility_id))));



  create policy "facilities_select_policy"
  on "public"."facilities"
  as permissive
  for select
  to public
using (((( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text) OR (id = ( SELECT public.get_my_facility_id() AS get_my_facility_id))));



  create policy "facility_analytics_settings_delete"
  on "public"."facility_analytics_settings"
  as permissive
  for delete
  to public
using ((facility_id IN ( SELECT u.facility_id
   FROM (public.users u
     JOIN public.user_roles ur ON ((u.role_id = ur.id)))
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND (ur.name = ANY (ARRAY['admin'::text, 'facility_admin'::text]))))));



  create policy "facility_analytics_settings_insert"
  on "public"."facility_analytics_settings"
  as permissive
  for insert
  to public
with check ((facility_id IN ( SELECT u.facility_id
   FROM (public.users u
     JOIN public.user_roles ur ON ((u.role_id = ur.id)))
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND (ur.name = ANY (ARRAY['admin'::text, 'facility_admin'::text]))))));



  create policy "facility_analytics_settings_select"
  on "public"."facility_analytics_settings"
  as permissive
  for select
  to public
using ((facility_id IN ( SELECT users.facility_id
   FROM public.users
  WHERE (users.id = ( SELECT auth.uid() AS uid)))));



  create policy "facility_analytics_settings_update"
  on "public"."facility_analytics_settings"
  as permissive
  for update
  to public
using ((facility_id IN ( SELECT u.facility_id
   FROM (public.users u
     JOIN public.user_roles ur ON ((u.role_id = ur.id)))
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND (ur.name = ANY (ARRAY['admin'::text, 'facility_admin'::text]))))));



  create policy "facility_closures_delete"
  on "public"."facility_closures"
  as permissive
  for delete
  to public
using ((((( SELECT public.get_my_access_level() AS get_my_access_level) = 'facility_admin'::text) AND (facility_id = ( SELECT public.get_my_facility_id() AS get_my_facility_id))) OR (( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text)));



  create policy "facility_closures_insert"
  on "public"."facility_closures"
  as permissive
  for insert
  to public
with check ((((( SELECT public.get_my_access_level() AS get_my_access_level) = 'facility_admin'::text) AND (facility_id = ( SELECT public.get_my_facility_id() AS get_my_facility_id))) OR (( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text)));



  create policy "facility_closures_select"
  on "public"."facility_closures"
  as permissive
  for select
  to public
using (((facility_id = ( SELECT public.get_my_facility_id() AS get_my_facility_id)) OR (( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text)));



  create policy "facility_closures_update"
  on "public"."facility_closures"
  as permissive
  for update
  to public
using ((((( SELECT public.get_my_access_level() AS get_my_access_level) = 'facility_admin'::text) AND (facility_id = ( SELECT public.get_my_facility_id() AS get_my_facility_id))) OR (( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text)));



  create policy "facility_features_delete"
  on "public"."facility_features"
  as permissive
  for delete
  to public
using ((( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text));



  create policy "facility_features_insert"
  on "public"."facility_features"
  as permissive
  for insert
  to public
with check ((( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text));



  create policy "facility_features_select"
  on "public"."facility_features"
  as permissive
  for select
  to public
using (((( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text) OR (facility_id = ( SELECT public.get_my_facility_id() AS get_my_facility_id))));



  create policy "facility_features_update"
  on "public"."facility_features"
  as permissive
  for update
  to public
using ((( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text));



  create policy "facility_holidays_delete"
  on "public"."facility_holidays"
  as permissive
  for delete
  to public
using ((((( SELECT public.get_my_access_level() AS get_my_access_level) = 'facility_admin'::text) AND (facility_id = ( SELECT public.get_my_facility_id() AS get_my_facility_id))) OR (( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text)));



  create policy "facility_holidays_insert"
  on "public"."facility_holidays"
  as permissive
  for insert
  to public
with check ((((( SELECT public.get_my_access_level() AS get_my_access_level) = 'facility_admin'::text) AND (facility_id = ( SELECT public.get_my_facility_id() AS get_my_facility_id))) OR (( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text)));



  create policy "facility_holidays_select"
  on "public"."facility_holidays"
  as permissive
  for select
  to public
using (((facility_id = ( SELECT public.get_my_facility_id() AS get_my_facility_id)) OR (( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text)));



  create policy "facility_holidays_update"
  on "public"."facility_holidays"
  as permissive
  for update
  to public
using ((((( SELECT public.get_my_access_level() AS get_my_access_level) = 'facility_admin'::text) AND (facility_id = ( SELECT public.get_my_facility_id() AS get_my_facility_id))) OR (( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text)));



  create policy "facility_milestones_delete"
  on "public"."facility_milestones"
  as permissive
  for delete
  to public
using ((((( SELECT public.get_my_access_level() AS get_my_access_level) = 'facility_admin'::text) AND (facility_id = ( SELECT public.get_my_facility_id() AS get_my_facility_id))) OR (( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text)));



  create policy "facility_milestones_insert"
  on "public"."facility_milestones"
  as permissive
  for insert
  to public
with check ((((( SELECT public.get_my_access_level() AS get_my_access_level) = 'facility_admin'::text) AND (facility_id = ( SELECT public.get_my_facility_id() AS get_my_facility_id))) OR (( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text)));



  create policy "facility_milestones_select"
  on "public"."facility_milestones"
  as permissive
  for select
  to public
using (((facility_id = ( SELECT public.get_my_facility_id() AS get_my_facility_id)) OR (( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text)));



  create policy "facility_milestones_update"
  on "public"."facility_milestones"
  as permissive
  for update
  to public
using ((((( SELECT public.get_my_access_level() AS get_my_access_level) = 'facility_admin'::text) AND (facility_id = ( SELECT public.get_my_facility_id() AS get_my_facility_id))) OR (( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text)));



  create policy "facility_notification_settings_delete"
  on "public"."facility_notification_settings"
  as permissive
  for delete
  to public
using (((( SELECT public.get_my_access_level() AS get_my_access_level) = ANY (ARRAY['global_admin'::text, 'facility_admin'::text])) AND ((facility_id = ( SELECT public.get_my_facility_id() AS get_my_facility_id)) OR (( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text))));



  create policy "facility_notification_settings_insert"
  on "public"."facility_notification_settings"
  as permissive
  for insert
  to public
with check (((( SELECT public.get_my_access_level() AS get_my_access_level) = ANY (ARRAY['global_admin'::text, 'facility_admin'::text])) AND ((facility_id = ( SELECT public.get_my_facility_id() AS get_my_facility_id)) OR (( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text))));



  create policy "facility_notification_settings_select"
  on "public"."facility_notification_settings"
  as permissive
  for select
  to public
using (((facility_id = ( SELECT public.get_my_facility_id() AS get_my_facility_id)) OR (( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text)));



  create policy "facility_notification_settings_update"
  on "public"."facility_notification_settings"
  as permissive
  for update
  to public
using (((( SELECT public.get_my_access_level() AS get_my_access_level) = ANY (ARRAY['global_admin'::text, 'facility_admin'::text])) AND ((facility_id = ( SELECT public.get_my_facility_id() AS get_my_facility_id)) OR (( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text))));



  create policy "facility_permissions_delete"
  on "public"."facility_permissions"
  as permissive
  for delete
  to public
using ((((( SELECT public.get_my_access_level() AS get_my_access_level) = 'facility_admin'::text) AND (facility_id = ( SELECT public.get_my_facility_id() AS get_my_facility_id))) OR (( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text)));



  create policy "facility_permissions_insert"
  on "public"."facility_permissions"
  as permissive
  for insert
  to public
with check ((((( SELECT public.get_my_access_level() AS get_my_access_level) = 'facility_admin'::text) AND (facility_id = ( SELECT public.get_my_facility_id() AS get_my_facility_id))) OR (( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text)));



  create policy "facility_permissions_select"
  on "public"."facility_permissions"
  as permissive
  for select
  to public
using (((facility_id = ( SELECT public.get_my_facility_id() AS get_my_facility_id)) OR (( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text)));



  create policy "facility_permissions_update"
  on "public"."facility_permissions"
  as permissive
  for update
  to public
using ((((( SELECT public.get_my_access_level() AS get_my_access_level) = 'facility_admin'::text) AND (facility_id = ( SELECT public.get_my_facility_id() AS get_my_facility_id))) OR (( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text)));



  create policy "features_delete"
  on "public"."features"
  as permissive
  for delete
  to public
using ((( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text));



  create policy "features_insert"
  on "public"."features"
  as permissive
  for insert
  to public
with check ((( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text));



  create policy "features_select"
  on "public"."features"
  as permissive
  for select
  to public
using ((( SELECT auth.role() AS role) = 'authenticated'::text));



  create policy "features_update"
  on "public"."features"
  as permissive
  for update
  to public
using ((( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text));



  create policy "financial_targets_delete"
  on "public"."financial_targets"
  as permissive
  for delete
  to public
using ((facility_id IN ( SELECT users.facility_id
   FROM public.users
  WHERE (users.id = ( SELECT auth.uid() AS uid)))));



  create policy "financial_targets_insert"
  on "public"."financial_targets"
  as permissive
  for insert
  to public
with check ((facility_id IN ( SELECT users.facility_id
   FROM public.users
  WHERE (users.id = ( SELECT auth.uid() AS uid)))));



  create policy "financial_targets_select"
  on "public"."financial_targets"
  as permissive
  for select
  to public
using ((facility_id IN ( SELECT users.facility_id
   FROM public.users
  WHERE (users.id = ( SELECT auth.uid() AS uid)))));



  create policy "financial_targets_update"
  on "public"."financial_targets"
  as permissive
  for update
  to public
using ((facility_id IN ( SELECT users.facility_id
   FROM public.users
  WHERE (users.id = ( SELECT auth.uid() AS uid)))));



  create policy "flag_rules_delete"
  on "public"."flag_rules"
  as permissive
  for delete
  to public
using ((facility_id IN ( SELECT u.facility_id
   FROM public.users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND (u.access_level = ANY (ARRAY['facility_admin'::text, 'global_admin'::text]))))));



  create policy "flag_rules_insert"
  on "public"."flag_rules"
  as permissive
  for insert
  to public
with check ((facility_id IN ( SELECT u.facility_id
   FROM public.users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND (u.access_level = ANY (ARRAY['facility_admin'::text, 'global_admin'::text]))))));



  create policy "flag_rules_select"
  on "public"."flag_rules"
  as permissive
  for select
  to public
using (((facility_id IS NULL) OR (facility_id IN ( SELECT users.facility_id
   FROM public.users
  WHERE (users.id = ( SELECT auth.uid() AS uid)))) OR (( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text)));



  create policy "flag_rules_update"
  on "public"."flag_rules"
  as permissive
  for update
  to public
using ((facility_id IN ( SELECT u.facility_id
   FROM public.users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND (u.access_level = ANY (ARRAY['facility_admin'::text, 'global_admin'::text]))))));



  create policy "metric_issues_insert_policy"
  on "public"."metric_issues"
  as permissive
  for insert
  to public
with check ((( SELECT auth.role() AS role) = 'authenticated'::text));



  create policy "outlier_review_notes_delete"
  on "public"."outlier_review_notes"
  as permissive
  for delete
  to public
using (((EXISTS ( SELECT 1
   FROM public.outlier_reviews
  WHERE ((outlier_reviews.id = outlier_review_notes.outlier_review_id) AND (outlier_reviews.facility_id = ( SELECT public.get_my_facility_id() AS get_my_facility_id)) AND (( SELECT public.get_my_access_level() AS get_my_access_level) = ANY (ARRAY['facility_admin'::text, 'global_admin'::text]))))) OR (( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text)));



  create policy "outlier_review_notes_insert"
  on "public"."outlier_review_notes"
  as permissive
  for insert
  to public
with check (((EXISTS ( SELECT 1
   FROM public.outlier_reviews
  WHERE ((outlier_reviews.id = outlier_review_notes.outlier_review_id) AND (outlier_reviews.facility_id = ( SELECT public.get_my_facility_id() AS get_my_facility_id)) AND (( SELECT public.get_my_access_level() AS get_my_access_level) = ANY (ARRAY['facility_admin'::text, 'global_admin'::text]))))) OR (( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text)));



  create policy "outlier_review_notes_select"
  on "public"."outlier_review_notes"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM public.outlier_reviews
  WHERE ((outlier_reviews.id = outlier_review_notes.outlier_review_id) AND ((outlier_reviews.facility_id = ( SELECT public.get_my_facility_id() AS get_my_facility_id)) OR (( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text))))));



  create policy "outlier_review_notes_update"
  on "public"."outlier_review_notes"
  as permissive
  for update
  to public
using (((EXISTS ( SELECT 1
   FROM public.outlier_reviews
  WHERE ((outlier_reviews.id = outlier_review_notes.outlier_review_id) AND (outlier_reviews.facility_id = ( SELECT public.get_my_facility_id() AS get_my_facility_id)) AND (( SELECT public.get_my_access_level() AS get_my_access_level) = ANY (ARRAY['facility_admin'::text, 'global_admin'::text]))))) OR (( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text)));



  create policy "outlier_reviews_delete"
  on "public"."outlier_reviews"
  as permissive
  for delete
  to public
using ((((facility_id = ( SELECT public.get_my_facility_id() AS get_my_facility_id)) AND (( SELECT public.get_my_access_level() AS get_my_access_level) = ANY (ARRAY['facility_admin'::text, 'global_admin'::text]))) OR (( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text)));



  create policy "outlier_reviews_insert"
  on "public"."outlier_reviews"
  as permissive
  for insert
  to public
with check ((((facility_id = ( SELECT public.get_my_facility_id() AS get_my_facility_id)) AND (( SELECT public.get_my_access_level() AS get_my_access_level) = ANY (ARRAY['facility_admin'::text, 'global_admin'::text]))) OR (( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text)));



  create policy "outlier_reviews_select"
  on "public"."outlier_reviews"
  as permissive
  for select
  to public
using (((facility_id = ( SELECT public.get_my_facility_id() AS get_my_facility_id)) OR (( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text)));



  create policy "outlier_reviews_update"
  on "public"."outlier_reviews"
  as permissive
  for update
  to public
using ((((facility_id = ( SELECT public.get_my_facility_id() AS get_my_facility_id)) AND (( SELECT public.get_my_access_level() AS get_my_access_level) = ANY (ARRAY['facility_admin'::text, 'global_admin'::text]))) OR (( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text)));



  create policy "patient_checkins_delete"
  on "public"."patient_checkins"
  as permissive
  for delete
  to public
using (((( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text) OR (facility_id = ( SELECT public.get_my_facility_id() AS get_my_facility_id))));



  create policy "patient_checkins_insert"
  on "public"."patient_checkins"
  as permissive
  for insert
  to public
with check (((( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text) OR (facility_id = ( SELECT public.get_my_facility_id() AS get_my_facility_id))));



  create policy "patient_checkins_select"
  on "public"."patient_checkins"
  as permissive
  for select
  to public
using (((( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text) OR (facility_id = ( SELECT public.get_my_facility_id() AS get_my_facility_id))));



  create policy "patient_checkins_update"
  on "public"."patient_checkins"
  as permissive
  for update
  to public
using (((( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text) OR (facility_id = ( SELECT public.get_my_facility_id() AS get_my_facility_id))));



  create policy "patient_statuses_delete"
  on "public"."patient_statuses"
  as permissive
  for delete
  to public
using ((( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text));



  create policy "patient_statuses_insert"
  on "public"."patient_statuses"
  as permissive
  for insert
  to public
with check ((( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text));



  create policy "patient_statuses_select"
  on "public"."patient_statuses"
  as permissive
  for select
  to public
using ((( SELECT auth.role() AS role) = 'authenticated'::text));



  create policy "patient_statuses_update"
  on "public"."patient_statuses"
  as permissive
  for update
  to public
using ((( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text));



  create policy "permission_templates_delete"
  on "public"."permission_templates"
  as permissive
  for delete
  to public
using ((( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text));



  create policy "permission_templates_insert"
  on "public"."permission_templates"
  as permissive
  for insert
  to public
with check ((( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text));



  create policy "permission_templates_select"
  on "public"."permission_templates"
  as permissive
  for select
  to public
using ((( SELECT public.get_my_access_level() AS get_my_access_level) = ANY (ARRAY['global_admin'::text, 'facility_admin'::text])));



  create policy "permission_templates_update"
  on "public"."permission_templates"
  as permissive
  for update
  to public
using ((( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text));



  create policy "permissions_delete"
  on "public"."permissions"
  as permissive
  for delete
  to public
using ((( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text));



  create policy "permissions_insert"
  on "public"."permissions"
  as permissive
  for insert
  to public
with check ((( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text));



  create policy "permissions_select"
  on "public"."permissions"
  as permissive
  for select
  to public
using ((( SELECT auth.uid() AS uid) IS NOT NULL));



  create policy "permissions_update"
  on "public"."permissions"
  as permissive
  for update
  to public
using ((( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text));



  create policy "preop_checklist_field_templates_delete"
  on "public"."preop_checklist_field_templates"
  as permissive
  for delete
  to public
using ((( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text));



  create policy "preop_checklist_field_templates_insert"
  on "public"."preop_checklist_field_templates"
  as permissive
  for insert
  to public
with check ((( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text));



  create policy "preop_checklist_field_templates_select"
  on "public"."preop_checklist_field_templates"
  as permissive
  for select
  to public
using ((( SELECT auth.role() AS role) = 'authenticated'::text));



  create policy "preop_checklist_field_templates_update"
  on "public"."preop_checklist_field_templates"
  as permissive
  for update
  to public
using ((( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text));



  create policy "preop_checklist_fields_delete"
  on "public"."preop_checklist_fields"
  as permissive
  for delete
  to public
using (((( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text) OR ((( SELECT public.get_my_access_level() AS get_my_access_level) = 'facility_admin'::text) AND (facility_id = ( SELECT public.get_my_facility_id() AS get_my_facility_id)))));



  create policy "preop_checklist_fields_insert"
  on "public"."preop_checklist_fields"
  as permissive
  for insert
  to public
with check (((( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text) OR ((( SELECT public.get_my_access_level() AS get_my_access_level) = 'facility_admin'::text) AND (facility_id = ( SELECT public.get_my_facility_id() AS get_my_facility_id)))));



  create policy "preop_checklist_fields_select"
  on "public"."preop_checklist_fields"
  as permissive
  for select
  to public
using (((( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text) OR (facility_id = ( SELECT public.get_my_facility_id() AS get_my_facility_id))));



  create policy "preop_checklist_fields_update"
  on "public"."preop_checklist_fields"
  as permissive
  for update
  to public
using (((( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text) OR ((( SELECT public.get_my_access_level() AS get_my_access_level) = 'facility_admin'::text) AND (facility_id = ( SELECT public.get_my_facility_id() AS get_my_facility_id)))));



  create policy "procedure_cost_items_delete"
  on "public"."procedure_cost_items"
  as permissive
  for delete
  to public
using ((((( SELECT public.get_my_access_level() AS get_my_access_level) = 'facility_admin'::text) AND (facility_id = ( SELECT public.get_my_facility_id() AS get_my_facility_id))) OR (( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text)));



  create policy "procedure_cost_items_insert"
  on "public"."procedure_cost_items"
  as permissive
  for insert
  to public
with check ((((( SELECT public.get_my_access_level() AS get_my_access_level) = 'facility_admin'::text) AND (facility_id = ( SELECT public.get_my_facility_id() AS get_my_facility_id))) OR (( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text)));



  create policy "procedure_cost_items_select"
  on "public"."procedure_cost_items"
  as permissive
  for select
  to public
using (((facility_id = ( SELECT public.get_my_facility_id() AS get_my_facility_id)) OR (( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text)));



  create policy "procedure_cost_items_update"
  on "public"."procedure_cost_items"
  as permissive
  for update
  to public
using ((((( SELECT public.get_my_access_level() AS get_my_access_level) = 'facility_admin'::text) AND (facility_id = ( SELECT public.get_my_facility_id() AS get_my_facility_id))) OR (( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text)));



  create policy "procedure_reimbursements_delete"
  on "public"."procedure_reimbursements"
  as permissive
  for delete
  to public
using ((((( SELECT public.get_my_access_level() AS get_my_access_level) = 'facility_admin'::text) AND (facility_id = ( SELECT public.get_my_facility_id() AS get_my_facility_id))) OR (( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text)));



  create policy "procedure_reimbursements_insert"
  on "public"."procedure_reimbursements"
  as permissive
  for insert
  to public
with check ((((( SELECT public.get_my_access_level() AS get_my_access_level) = 'facility_admin'::text) AND (facility_id = ( SELECT public.get_my_facility_id() AS get_my_facility_id))) OR (( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text)));



  create policy "procedure_reimbursements_select"
  on "public"."procedure_reimbursements"
  as permissive
  for select
  to public
using (((facility_id = ( SELECT public.get_my_facility_id() AS get_my_facility_id)) OR (( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text)));



  create policy "procedure_reimbursements_update"
  on "public"."procedure_reimbursements"
  as permissive
  for update
  to public
using ((((( SELECT public.get_my_access_level() AS get_my_access_level) = 'facility_admin'::text) AND (facility_id = ( SELECT public.get_my_facility_id() AS get_my_facility_id))) OR (( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text)));



  create policy "procedure_type_templates_delete"
  on "public"."procedure_type_templates"
  as permissive
  for delete
  to public
using ((( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text));



  create policy "procedure_type_templates_insert"
  on "public"."procedure_type_templates"
  as permissive
  for insert
  to public
with check ((( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text));



  create policy "procedure_type_templates_select"
  on "public"."procedure_type_templates"
  as permissive
  for select
  to public
using ((( SELECT auth.role() AS role) = 'authenticated'::text));



  create policy "procedure_type_templates_update"
  on "public"."procedure_type_templates"
  as permissive
  for update
  to public
using ((( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text));



  create policy "room_schedules_delete"
  on "public"."room_schedules"
  as permissive
  for delete
  to public
using ((facility_id IN ( SELECT users.facility_id
   FROM public.users
  WHERE (users.id = ( SELECT auth.uid() AS uid)))));



  create policy "room_schedules_insert"
  on "public"."room_schedules"
  as permissive
  for insert
  to public
with check ((facility_id IN ( SELECT users.facility_id
   FROM public.users
  WHERE (users.id = ( SELECT auth.uid() AS uid)))));



  create policy "room_schedules_select"
  on "public"."room_schedules"
  as permissive
  for select
  to public
using ((facility_id IN ( SELECT users.facility_id
   FROM public.users
  WHERE (users.id = ( SELECT auth.uid() AS uid)))));



  create policy "room_schedules_update"
  on "public"."room_schedules"
  as permissive
  for update
  to public
using ((facility_id IN ( SELECT users.facility_id
   FROM public.users
  WHERE (users.id = ( SELECT auth.uid() AS uid)))));



  create policy "surgeon_colors_delete"
  on "public"."surgeon_colors"
  as permissive
  for delete
  to public
using ((facility_id IN ( SELECT users.facility_id
   FROM public.users
  WHERE (users.id = ( SELECT auth.uid() AS uid)))));



  create policy "surgeon_colors_insert"
  on "public"."surgeon_colors"
  as permissive
  for insert
  to public
with check ((facility_id IN ( SELECT users.facility_id
   FROM public.users
  WHERE (users.id = ( SELECT auth.uid() AS uid)))));



  create policy "surgeon_colors_select"
  on "public"."surgeon_colors"
  as permissive
  for select
  to public
using (((facility_id = ( SELECT public.get_my_facility_id() AS get_my_facility_id)) OR (( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text)));



  create policy "surgeon_colors_update"
  on "public"."surgeon_colors"
  as permissive
  for update
  to public
using ((facility_id IN ( SELECT users.facility_id
   FROM public.users
  WHERE (users.id = ( SELECT auth.uid() AS uid)))));



  create policy "surgeon_cost_items_delete"
  on "public"."surgeon_cost_items"
  as permissive
  for delete
  to public
using ((((( SELECT public.get_my_access_level() AS get_my_access_level) = 'facility_admin'::text) AND (facility_id = ( SELECT public.get_my_facility_id() AS get_my_facility_id))) OR (( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text)));



  create policy "surgeon_cost_items_insert"
  on "public"."surgeon_cost_items"
  as permissive
  for insert
  to public
with check ((((( SELECT public.get_my_access_level() AS get_my_access_level) = 'facility_admin'::text) AND (facility_id = ( SELECT public.get_my_facility_id() AS get_my_facility_id))) OR (( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text)));



  create policy "surgeon_cost_items_select"
  on "public"."surgeon_cost_items"
  as permissive
  for select
  to public
using (((facility_id = ( SELECT public.get_my_facility_id() AS get_my_facility_id)) OR (( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text)));



  create policy "surgeon_cost_items_update"
  on "public"."surgeon_cost_items"
  as permissive
  for update
  to public
using ((((( SELECT public.get_my_access_level() AS get_my_access_level) = 'facility_admin'::text) AND (facility_id = ( SELECT public.get_my_facility_id() AS get_my_facility_id))) OR (( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text)));



  create policy "surgeon_procedure_duration_delete"
  on "public"."surgeon_procedure_duration"
  as permissive
  for delete
  to public
using ((((( SELECT public.get_my_access_level() AS get_my_access_level) = 'facility_admin'::text) AND (facility_id = ( SELECT public.get_my_facility_id() AS get_my_facility_id))) OR (( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text)));



  create policy "surgeon_procedure_duration_insert"
  on "public"."surgeon_procedure_duration"
  as permissive
  for insert
  to public
with check ((((( SELECT public.get_my_access_level() AS get_my_access_level) = 'facility_admin'::text) AND (facility_id = ( SELECT public.get_my_facility_id() AS get_my_facility_id))) OR (( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text)));



  create policy "surgeon_procedure_duration_select"
  on "public"."surgeon_procedure_duration"
  as permissive
  for select
  to public
using (((facility_id = ( SELECT public.get_my_facility_id() AS get_my_facility_id)) OR (( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text)));



  create policy "surgeon_procedure_duration_update"
  on "public"."surgeon_procedure_duration"
  as permissive
  for update
  to public
using ((((( SELECT public.get_my_access_level() AS get_my_access_level) = 'facility_admin'::text) AND (facility_id = ( SELECT public.get_my_facility_id() AS get_my_facility_id))) OR (( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text)));



  create policy "user_invites_delete"
  on "public"."user_invites"
  as permissive
  for delete
  to public
using (((( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text) OR ((( SELECT public.get_my_access_level() AS get_my_access_level) = 'facility_admin'::text) AND (facility_id = ( SELECT public.get_my_facility_id() AS get_my_facility_id)))));



  create policy "user_invites_insert"
  on "public"."user_invites"
  as permissive
  for insert
  to public
with check (((( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text) OR ((( SELECT public.get_my_access_level() AS get_my_access_level) = 'facility_admin'::text) AND (facility_id = ( SELECT public.get_my_facility_id() AS get_my_facility_id)))));



  create policy "user_invites_select"
  on "public"."user_invites"
  as permissive
  for select
  to public
using (((( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text) OR ((( SELECT public.get_my_access_level() AS get_my_access_level) = 'facility_admin'::text) AND (facility_id = ( SELECT public.get_my_facility_id() AS get_my_facility_id)))));



  create policy "user_invites_update"
  on "public"."user_invites"
  as permissive
  for update
  to public
using (((( SELECT public.get_my_access_level() AS get_my_access_level) = 'global_admin'::text) OR ((( SELECT public.get_my_access_level() AS get_my_access_level) = 'facility_admin'::text) AND (facility_id = ( SELECT public.get_my_facility_id() AS get_my_facility_id)))));



  create policy "Authenticated users can delete logos"
  on "storage"."objects"
  as permissive
  for delete
  to authenticated
using ((bucket_id = 'facility-logos'::text));



  create policy "Authenticated users can update logos"
  on "storage"."objects"
  as permissive
  for update
  to authenticated
using ((bucket_id = 'facility-logos'::text));



  create policy "Authenticated users can upload logos"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check ((bucket_id = 'facility-logos'::text));



  create policy "Public read access for logos"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = 'facility-logos'::text));



