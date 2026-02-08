# Code Duplication Report

Generated: 2/8/2026, 1:31:12 PM

## Summary

- Total duplications found: 9
- High severity: 7
- Medium severity: 2

## Duplications by Priority

### loadingState (HIGH)

Found in 76 files:

- `app/admin/audit-log/page.tsx`
- `app/admin/cancellation-reasons/page.tsx`
- `app/admin/checklist-templates/page.tsx`
- `app/admin/complexities/page.tsx`
- `app/admin/demo/page.tsx`
- `app/admin/facilities/[id]/page.tsx`
- `app/admin/facilities/page.tsx`
- `app/admin/page.tsx`
- `app/admin/settings/body-regions/page.tsx`
- `app/admin/settings/cost-categories/page.tsx`
- `app/admin/settings/delay-types/page.tsx`
- `app/admin/settings/implant-companies/page.tsx`
- `app/admin/settings/milestones/page.tsx`
- `app/admin/settings/procedure-categories/page.tsx`
- `app/admin/settings/procedure-milestones/page.tsx`
- `app/admin/settings/procedures/page.tsx`
- `app/analytics/block-utilization/page.tsx`
- `app/analytics/financials/outliers/[caseId]/page.tsx`
- `app/analytics/financials/page.tsx`
- `app/analytics/flags/page.tsx`
- `app/analytics/kpi/page.tsx`
- `app/analytics/page.tsx`
- `app/analytics/surgeons/page.tsx`
- `app/auth/change-password/page.tsx`
- `app/auth/rep-signup/page.tsx`
- `app/auth/reset-password/page.tsx`
- `app/auth/set-password/page.tsx`
- `app/block-schedule/page.tsx`
- `app/cases/[id]/cancel/page.tsx`
- `app/cases/[id]/page.tsx`
- `app/cases/page.tsx`
- `app/checkin/page.tsx`
- `app/dashboard/data-quality/page.tsx`
- `app/dashboard/page.tsx`
- `app/invite/accept/[token]/page.tsx`
- `app/invite/user/[token]/page.tsx`
- `app/login/page.tsx`
- `app/profile/page.tsx`
- `app/settings/analytics/page.tsx`
- `app/settings/audit-log/page.tsx`
- `app/settings/cancellation-reasons/page.tsx`
- `app/settings/checkin/page.tsx`
- `app/settings/checklist-builder/page.tsx`
- `app/settings/complexities/page.tsx`
- `app/settings/delay-types/page.tsx`
- `app/settings/device-reps/page.tsx`
- `app/settings/facilities/page.tsx`
- `app/settings/financials/cost-categories/page.tsx`
- `app/settings/financials/page.tsx`
- `app/settings/financials/payers/page.tsx`
- `app/settings/financials/procedure-pricing/page.tsx`
- `app/settings/financials/surgeon-variance/page.tsx`
- `app/settings/flags/page.tsx`
- `app/settings/general/page.tsx`
- `app/settings/implant-companies/page.tsx`
- `app/settings/milestones/page.tsx`
- `app/settings/procedure-milestones/page.tsx`
- `app/settings/procedures/page.tsx`
- `app/settings/rooms/page.tsx`
- `app/settings/subscription/page.tsx`
- `app/settings/users/page.tsx`
- `app/spd/page.tsx`
- `app/status/[token]/page.tsx`
- `components/InviteUserModal.tsx`
- `components/analytics/FlagsSummaryCard.tsx`
- `components/block-schedule/BlockDialog.tsx`
- `components/cases/CaseComplexitySelector.tsx`
- `components/cases/CaseFlagsSection.tsx`
- `components/cases/CaseForm.tsx`
- `components/cases/DeviceRepSection.tsx`
- `components/cases/ImplantCompanySelect.tsx`
- `components/cases/ImplantSection.tsx`
- `components/cases/SurgeonPreferenceSelect.tsx`
- `components/pip/PiPMilestonePanel.tsx`
- `components/settings/EditableList.tsx`
- `components/settings/SettingsLayout.tsx`

**Action:** Extract to shared utility/component

### inlineApiCalls (HIGH)

Found in 89 files:

- `app/admin/audit-log/page.tsx`
- `app/admin/cancellation-reasons/page.tsx`
- `app/admin/checklist-templates/page.tsx`
- `app/admin/complexities/page.tsx`
- `app/admin/docs/page.tsx`
- `app/admin/facilities/[id]/page.tsx`
- `app/admin/facilities/new/page.tsx`
- `app/admin/facilities/page.tsx`
- `app/admin/page.tsx`
- `app/admin/settings/body-regions/page.tsx`
- `app/admin/settings/cost-categories/page.tsx`
- `app/admin/settings/delay-types/page.tsx`
- `app/admin/settings/implant-companies/page.tsx`
- `app/admin/settings/milestones/page.tsx`
- `app/admin/settings/procedure-categories/page.tsx`
- `app/admin/settings/procedure-milestones/page.tsx`
- `app/admin/settings/procedures/page.tsx`
- `app/analytics/block-utilization/page.tsx`
- `app/analytics/financials/outliers/[caseId]/page.tsx`
- `app/analytics/kpi/page.tsx`
- `app/analytics/page.tsx`
- `app/analytics/surgeons/page.tsx`
- `app/api/admin/invite/route.ts`
- `app/api/admin/scan-pages/route.ts`
- `app/api/check-auth-status/route.ts`
- `app/api/check-user-status/route.ts`
- `app/api/create-device-rep/route.ts`
- `app/api/demo-data/route.ts`
- `app/api/invite/accept/route.ts`
- `app/api/resend-invite/route.ts`
- `app/auth/callback/route.ts`
- `app/auth/change-password/page.tsx`
- `app/auth/rep-signup/page.tsx`
- `app/auth/reset-password/page.tsx`
- `app/auth/set-password/page.tsx`
- `app/block-schedule/page.tsx`
- `app/cases/[id]/cancel/page.tsx`
- `app/cases/[id]/page.tsx`
- `app/cases/page.tsx`
- `app/checkin/page.tsx`
- `app/dashboard/data-quality/page.tsx`
- `app/dashboard/page.tsx`
- `app/invite/accept/[token]/page.tsx`
- `app/invite/user/[token]/page.tsx`
- `app/login/page.tsx`
- `app/profile/page.tsx`
- `app/settings/analytics/page.tsx`
- `app/settings/audit-log/page.tsx`
- `app/settings/cancellation-reasons/page.tsx`
- `app/settings/checkin/page.tsx`
- `app/settings/checklist-builder/page.tsx`
- `app/settings/closures/page.tsx`
- `app/settings/complexities/page.tsx`
- `app/settings/delay-types/page.tsx`
- `app/settings/device-reps/page.tsx`
- `app/settings/facilities/page.tsx`
- `app/settings/financials/cost-categories/page.tsx`
- `app/settings/financials/page.tsx`
- `app/settings/financials/payers/page.tsx`
- `app/settings/financials/procedure-pricing/page.tsx`
- `app/settings/financials/surgeon-variance/page.tsx`
- `app/settings/flags/page.tsx`
- `app/settings/general/page.tsx`
- `app/settings/implant-companies/page.tsx`
- `app/settings/milestones/page.tsx`
- `app/settings/procedure-milestones/page.tsx`
- `app/settings/procedures/page.tsx`
- `app/settings/rooms/page.tsx`
- `app/settings/surgeon-preferences/page.tsx`
- `app/settings/users/page.tsx`
- `app/spd/page.tsx`
- `app/status/[token]/page.tsx`
- `components/CallNextPatientModal.tsx`
- `components/FacilityLogoUpload.tsx`
- `components/GlobalSearch.tsx`
- `components/InviteUserModal.tsx`
- `components/analytics/financials/SurgeonTab.tsx`
- `components/block-schedule/BlockDialog.tsx`
- `components/cases/CaseComplexitySelector.tsx`
- `components/cases/CaseFlagsSection.tsx`
- `components/cases/CaseForm.tsx`
- `components/cases/DeviceRepSection.tsx`
- `components/cases/ImplantCompanySelect.tsx`
- `components/cases/ImplantSection.tsx`
- `components/cases/SurgeonPreferenceSelect.tsx`
- `components/layouts/DashboardLayout.tsx`
- `components/modals/DeleteFacilityModal.tsx`
- `components/settings/SettingsLayout.tsx`
- `components/settings/SurgeonClosingWorkflow.tsx`

**Action:** Extract to shared utility/component

### inlineDeleteConfirm (HIGH)

Found in 11 files:

- `app/admin/cancellation-reasons/page.tsx`
- `app/admin/complexities/page.tsx`
- `app/admin/settings/delay-types/page.tsx`
- `app/admin/settings/implant-companies/page.tsx`
- `app/cases/page.tsx`
- `app/settings/cancellation-reasons/page.tsx`
- `app/settings/financials/payers/page.tsx`
- `app/settings/implant-companies/page.tsx`
- `app/settings/surgeon-preferences/page.tsx`
- `components/settings/EditableList.tsx`
- `components/settings/SortableList.tsx`

**Action:** Extract to shared utility/component

### modalState (HIGH)

Found in 16 files:

- `app/admin/cancellation-reasons/page.tsx`
- `app/admin/complexities/page.tsx`
- `app/admin/facilities/[id]/page.tsx`
- `app/admin/settings/body-regions/page.tsx`
- `app/admin/settings/cost-categories/page.tsx`
- `app/admin/settings/milestones/page.tsx`
- `app/admin/settings/procedure-categories/page.tsx`
- `app/admin/settings/procedures/page.tsx`
- `app/analytics/kpi/page.tsx`
- `app/analytics/page.tsx`
- `app/dashboard/page.tsx`
- `app/settings/cancellation-reasons/page.tsx`
- `app/settings/complexities/page.tsx`
- `app/settings/milestones/page.tsx`
- `app/settings/users/page.tsx`
- `components/block-schedule/BlockPopover.tsx`

**Action:** Extract to shared utility/component

### consoleLog (HIGH)

Found in 65 files:

- `app/admin/cancellation-reasons/page.tsx`
- `app/admin/checklist-templates/page.tsx`
- `app/admin/complexities/page.tsx`
- `app/admin/demo/page.tsx`
- `app/admin/facilities/[id]/page.tsx`
- `app/admin/facilities/new/page.tsx`
- `app/admin/facilities/page.tsx`
- `app/admin/page.tsx`
- `app/admin/settings/body-regions/page.tsx`
- `app/admin/settings/cost-categories/page.tsx`
- `app/admin/settings/procedures/page.tsx`
- `app/analytics/block-utilization/page.tsx`
- `app/analytics/financials/outliers/[caseId]/page.tsx`
- `app/analytics/financials/page.tsx`
- `app/api/admin/invite/route.ts`
- `app/api/admin/scan-pages/route.ts`
- `app/api/check-auth-status/route.ts`
- `app/api/check-user-status/route.ts`
- `app/api/create-device-rep/route.ts`
- `app/api/demo-data/route.ts`
- `app/api/invite/accept/route.ts`
- `app/api/resend-invite/route.ts`
- `app/api/send-rep-invite/route.ts`
- `app/auth/callback/route.ts`
- `app/auth/change-password/page.tsx`
- `app/auth/rep-signup/page.tsx`
- `app/auth/reset-password/page.tsx`
- `app/cases/[id]/cancel/page.tsx`
- `app/cases/[id]/page.tsx`
- `app/checkin/page.tsx`
- `app/dashboard/data-quality/page.tsx`
- `app/dashboard/page.tsx`
- `app/invite/user/[token]/page.tsx`
- `app/profile/page.tsx`
- `app/settings/checkin/page.tsx`
- `app/settings/checklist-builder/page.tsx`
- `app/settings/complexities/page.tsx`
- `app/settings/device-reps/page.tsx`
- `app/settings/facilities/page.tsx`
- `app/settings/financials/cost-categories/page.tsx`
- `app/settings/financials/page.tsx`
- `app/settings/financials/payers/page.tsx`
- `app/settings/financials/procedure-pricing/page.tsx`
- `app/settings/financials/surgeon-variance/page.tsx`
- `app/settings/general/page.tsx`
- `app/settings/subscription/page.tsx`
- `app/settings/surgeon-preferences/page.tsx`
- `app/settings/users/page.tsx`
- `app/spd/page.tsx`
- `app/status/[token]/page.tsx`
- `components/CallNextPatientModal.tsx`
- `components/ErrorBoundary.tsx`
- `components/FacilityLogoUpload.tsx`
- `components/GlobalSearch.tsx`
- `components/InviteUserModal.tsx`
- `components/analytics/financials/SurgeonTab.tsx`
- `components/block-schedule/BlockDialog.tsx`
- `components/block-schedule/BlockPopover.tsx`
- `components/cases/CaseComplexitySelector.tsx`
- `components/cases/CaseFlagsSection.tsx`
- `components/cases/CaseForm.tsx`
- `components/layouts/DashboardLayout.tsx`
- `components/modals/DeleteFacilityModal.tsx`
- `components/pip/PiPMilestoneWrapper.tsx`
- `components/settings/EditableList.tsx`

**Action:** Extract to shared utility/component

### hardcodedColors (HIGH)

Found in 52 files:

- `app/admin/cancellation-reasons/page.tsx`
- `app/admin/complexities/page.tsx`
- `app/admin/demo/page.tsx`
- `app/admin/docs/page.tsx`
- `app/admin/facilities/[id]/page.tsx`
- `app/admin/facilities/new/page.tsx`
- `app/admin/page.tsx`
- `app/admin/settings/procedures/page.tsx`
- `app/analytics/block-utilization/page.tsx`
- `app/analytics/financials/outliers/[caseId]/page.tsx`
- `app/analytics/flags/page.tsx`
- `app/analytics/kpi/page.tsx`
- `app/analytics/page.tsx`
- `app/auth/change-password/page.tsx`
- `app/auth/reset-password/page.tsx`
- `app/cases/[id]/page.tsx`
- `app/cases/page.tsx`
- `app/dashboard/data-quality/page.tsx`
- `app/profile/page.tsx`
- `app/settings/cancellation-reasons/page.tsx`
- `app/settings/closures/page.tsx`
- `app/settings/financials/cost-categories/page.tsx`
- `app/settings/flags/page.tsx`
- `app/settings/implant-companies/page.tsx`
- `app/settings/notifications/page.tsx`
- `app/settings/rooms/page.tsx`
- `app/settings/subscription/page.tsx`
- `app/spd/page.tsx`
- `app/status/[token]/page.tsx`
- `components/FeatureGate.tsx`
- `components/GlobalSearch.tsx`
- `components/analytics/AnalyticsComponents.tsx`
- `components/analytics/FlagsSummaryCard.tsx`
- `components/analytics/KPICard.tsx`
- `components/analytics/financials/OverviewTab.tsx`
- `components/analytics/financials/ProcedureTab.tsx`
- `components/analytics/financials/SurgeonTab.tsx`
- `components/block-schedule/BlockSidebar.tsx`
- `components/cases/CaseFlagsSection.tsx`
- `components/cases/CaseForm.tsx`
- `components/cases/CaseSummary.tsx`
- `components/cases/CompletedCaseView.tsx`
- `components/cases/DeviceRepSection.tsx`
- `components/cases/ImplantCompanySelect.tsx`
- `components/dashboard/CaseListView.tsx`
- `components/dashboard/RoomGridView.tsx`
- `components/filters/CaseFilterBar.tsx`
- `components/ui/Alert.tsx`
- `components/ui/MetricCard.tsx`
- `components/ui/PhaseBadge.tsx`
- `components/ui/StatusBadge.tsx`
- `components/ui/StatusIndicator.tsx`

**Action:** Extract to shared utility/component

### inlineValidation (HIGH)

Found in 41 files:

- `app/admin/cancellation-reasons/page.tsx`
- `app/admin/checklist-templates/page.tsx`
- `app/admin/docs/page.tsx`
- `app/admin/facilities/[id]/page.tsx`
- `app/admin/facilities/new/page.tsx`
- `app/admin/facilities/page.tsx`
- `app/admin/page.tsx`
- `app/admin/settings/delay-types/page.tsx`
- `app/admin/settings/implant-companies/page.tsx`
- `app/analytics/financials/page.tsx`
- `app/analytics/surgeons/page.tsx`
- `app/api/admin/invite/route.ts`
- `app/api/admin/scan-pages/route.ts`
- `app/api/check-auth-status/route.ts`
- `app/api/check-user-status/route.ts`
- `app/api/create-device-rep/route.ts`
- `app/api/invite/accept/route.ts`
- `app/api/resend-invite/route.ts`
- `app/api/send-rep-invite/route.ts`
- `app/cases/[id]/page.tsx`
- `app/checkin/page.tsx`
- `app/profile/page.tsx`
- `app/settings/analytics/page.tsx`
- `app/settings/checkin/page.tsx`
- `app/settings/financials/cost-categories/page.tsx`
- `app/settings/financials/page.tsx`
- `app/settings/financials/payers/page.tsx`
- `app/settings/financials/procedure-pricing/page.tsx`
- `app/settings/flags/page.tsx`
- `components/FeatureGate.tsx`
- `components/analytics/financials/SurgeonTab.tsx`
- `components/block-schedule/BlockSidebar.tsx`
- `components/block-schedule/DeleteBlockModal.tsx`
- `components/cases/CaseComplexitySelector.tsx`
- `components/cases/DeviceRepSection.tsx`
- `components/cases/SurgeonPreferenceSelect.tsx`
- `components/dashboard/EnhancedRoomCard.tsx`
- `components/dashboard/PaceProgressBar.tsx`
- `components/dashboard/StaffDragOverlay.tsx`
- `components/layouts/DashboardLayout.tsx`
- `components/pip/PiPMilestoneWrapper.tsx`

**Action:** Extract to shared utility/component

### paginationLogic (MEDIUM)

Found in 4 files:

- `app/admin/audit-log/page.tsx`
- `app/analytics/flags/page.tsx`
- `app/cases/page.tsx`
- `app/settings/audit-log/page.tsx`

**Action:** Extract to shared utility/component

### getStatusConfig (MEDIUM)

Found in 2 files:

- `app/cases/[id]/page.tsx`
- `components/cases/DeviceRepSection.tsx`

**Action:** Extract to shared utility/component

