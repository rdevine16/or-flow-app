# useSupabaseQuery Migration Report
Generated: 2026-02-11T04:15:58.848Z

## Summary
- **Total pages needing migration:** 55
- **Simple (1-2 queries, drop-in replacement):** 4
- **Medium (3-5 queries, some restructuring):** 20
- **Complex (6+ queries, manual review needed):** 31
- **Auth flows (skip — different pattern):** 0

## Estimated effort
- Simple pages: ~5 min each = 20 min
- Medium pages: ~15 min each = 300 min
- Complex pages: ~30 min each = 930 min
- **Total: ~1250 min**

---

## Simple — Drop-in Replacement
### app/admin/demo/page.tsx (1057L, 0q → useSupabaseList)
Tables: N/A
Remove: 3 state declarations + useEffect + loadFacility

// REPLACE these state declarations:
//   const [facilities, setFacilities] = useState<Facility[]>([])
//   const [loading, setLoading] = useState(true)
//   const [error, setError] = useState<string | null>(null)
//   useEffect + loadFacility
//
// WITH:
const { data: facilities, loading, error, refetch } = useSupabaseList<Facility>(
  async (sb) => {
    const { data, error } = await sb
      .from('TABLE_NAME')
      .select('*')
      // .eq('facility_id', facilityId)  // add your filters
      .order('display_order')
    return { data: data || [], error }
  },
  [/* deps like facilityId */],
  { enabled: true /* replace with your guard condition */ }
)

// THEN: replace all setLoading/setError/setFacilities in CRUD handlers with refetch()
// THEN: add to imports: import { useSupabaseList } from '@/hooks/useSupabaseQuery'

### app/admin/docs/page.tsx (3182L, 0q → useSupabaseList)
Tables: N/A
Remove: 3 state declarations + useEffect + fetchData

// REPLACE these state declarations:
//   const [pages, setPages] = useState<PageEntry[]>([])
//   const [loading, setLoading] = useState(true)
//   const [error, setError] = useState<string | null>(null)
//   useEffect + fetchData
//
// WITH:
const { data: pages, loading, error, refetch } = useSupabaseList<PageEntry>(
  async (sb) => {
    const { data, error } = await sb
      .from('TABLE_NAME')
      .select('*')
      // .eq('facility_id', facilityId)  // add your filters
      .order('display_order')
    return { data: data || [], error }
  },
  [/* deps like facilityId */],
  { enabled: true /* replace with your guard condition */ }
)

// THEN: replace all setLoading/setError/setPages in CRUD handlers with refetch()
// THEN: add to imports: import { useSupabaseList } from '@/hooks/useSupabaseQuery'

### app/settings/closures/page.tsx (897L, 1q → useSupabaseQuery)
Tables: users
Remove: 2 state declarations + useEffect + loadUser

// REPLACE these state declarations:
//   const [facilityId, setFacilityId] = useState<string | null>(null)
//   const [loading, setLoading] = useState(true)
//   const [error, setError] = useState<string | null>(null)
//   useEffect + loadUser
//
// WITH:
const { data: facilityId, loading, error, refetch } = useSupabaseQuery<string>(
  async (sb) => {
    const result = await sb
      .from('users')
      .select('*')
      .eq('id', id)
      .single()
    return result
  },
  [/* deps */]
)

// THEN: add to imports: import { useSupabaseQuery } from '@/hooks/useSupabaseQuery'

### app/spd/page.tsx (943L, 2q → useSupabaseList)
Tables: cases, case_device_activity
Remove: 4 state declarations + useEffect + fetchData

// REPLACE these state declarations:
//   const [cases, setCases] = useState<SPDCase[]>([])
//   const [loading, setLoading] = useState(true)
//   const [error, setError] = useState<string | null>(null)
//   useEffect + fetchData
//
// WITH:
const { data: cases, loading, error, refetch } = useSupabaseList<SPDCase>(
  async (sb) => {
    const { data, error } = await sb
      .from('cases')
      .select('*')
      // .eq('facility_id', facilityId)  // add your filters
      .order('display_order')
    return { data: data || [], error }
  },
  [/* deps like facilityId */],
  { enabled: true /* replace with your guard condition */ }
)

// THEN: replace all setLoading/setError/setCases in CRUD handlers with refetch()
// THEN: add to imports: import { useSupabaseList } from '@/hooks/useSupabaseQuery'


## Medium — Some Restructuring  
### app/admin/audit-log/page.tsx (587L, 3q)
Tables: facilities, audit_log
Fetch function: fetchFacilities (line 141)

### app/admin/cancellation-reasons/page.tsx (558L, 5q)
Tables: cancellation_reason_templates
Fetch function: fetchReasons (line 86)

### app/admin/checklist-templates/page.tsx (744L, 5q)
Tables: preop_checklist_field_templates
Fetch function: fetchFields (line 409)

### app/admin/facilities/page.tsx (450L, 3q)
Tables: facilities, users, cases
Fetch function: fetchFacilities (line 59)

### app/admin/global-security/page.tsx (698L, 4q)
Tables: facilities, error_logs, audit_log, user_sessions
Fetch function: loadDashboardData (line 108)

### app/admin/page.tsx (453L, 4q)
Tables: facilities, users, cases, audit_log
Fetch function: fetchData (line 74)

### app/admin/settings/delay-types/page.tsx (364L, 4q)
Tables: delay_types
Fetch function: fetchData (line 56)

### app/analytics/flags/page.tsx (1456L, 4q)
Tables: or_rooms, facility_analytics_settings, cases
Fetch function: fetchData (line 1018)

### app/analytics/kpi/page.tsx (1471L, 4q)
Tables: or_rooms, facility_analytics_settings, cases
Fetch function: fetchData (line 1036)

### app/analytics/orbit-score/page.tsx (762L, 5q)
Tables: cases, case_completion_stats, case_flags, facility_analytics_settings, facilities
Fetch function: loadORbitScores (line 560)

### app/analytics/page.tsx (1093L, 4q)
Tables: procedure_categories, procedure_techniques, cases
Fetch function: fetchData (line 422)

### app/cases/page.tsx (520L, 3q)
Tables: cases, case_statuses
Fetch function: null (line -1)

### app/settings/analytics/page.tsx (649L, 3q)
Tables: facility_analytics_settings
Fetch function: fetchSettings (line 81)

### app/settings/audit-log/page.tsx (464L, 4q)
Tables: users, audit_log
Fetch function: fetchUsers (line 108)

### app/settings/cancellation-reasons/page.tsx (475L, 5q)
Tables: cancellation_reasons
Fetch function: fetchReasons (line 80)

### app/settings/checkin/page.tsx (398L, 4q)
Tables: facilities, procedure_types
Fetch function: fetchData (line 60)

### app/settings/checklist-builder/page.tsx (619L, 5q)
Tables: preop_checklist_fields
Fetch function: fetchFields (line 375)

### app/settings/financials/payers/page.tsx (445L, 5q)
Tables: payers
Fetch function: fetchData (line 71)

### app/settings/flags/page.tsx (488L, 4q)
Tables: flag_rules
Fetch function: fetchData (line 104)

### app/settings/subscription/page.tsx (453L, 3q)
Tables: cases, users
Fetch function: null (line -1)


## Complex — Manual Review
### app/admin/complexities/page.tsx (504L, 7q)
Tables: complexity_templates, procedure_categories

### app/admin/facilities/[id]/page.tsx (1654L, 21q)
Tables: cases, users, audit_log, metric_issues, facilities, or_rooms, procedure_types, user_roles

### app/admin/settings/body-regions/page.tsx (588L, 6q)
Tables: body_regions

### app/admin/settings/cost-categories/page.tsx (736L, 8q)
Tables: cost_category_templates, cost_categories

### app/admin/settings/implant-companies/page.tsx (441L, 6q)
Tables: implant_companies

### app/admin/settings/milestones/page.tsx (897L, 17q)
Tables: milestone_types, facilities, facility_milestones

### app/admin/settings/procedure-categories/page.tsx (638L, 7q)
Tables: procedure_categories, body_regions

### app/admin/settings/procedure-milestones/page.tsx (506L, 9q)
Tables: procedure_type_templates, milestone_types, procedure_milestone_templates

### app/admin/settings/procedures/page.tsx (884L, 15q)
Tables: procedure_type_templates, body_regions, procedure_categories, milestone_types, procedure_milestone_templates

### app/analytics/block-utilization/page.tsx (2080L, 9q)
Tables: cases, block_schedules, facility_closures, facility_holidays, facility_milestones, facilities, procedure_reimbursements, or_rooms, room_schedules

### app/analytics/financials/page.tsx (373L, 8q)
Tables: case_completion_stats, surgeon_procedure_stats, facility_procedure_stats, facilities, procedure_types, payers, or_rooms, users

### app/analytics/surgeons/page.tsx (1282L, 10q)
Tables: facilities, user_roles, users, procedure_types, procedure_techniques, cases

### app/cases/[id]/cancel/page.tsx (594L, 8q)
Tables: cases, case_milestones, cancellation_reasons, case_statuses

### app/cases/[id]/page.tsx (1203L, 24q)
Tables: cases, procedure_milestone_config, facility_milestones, case_milestones, case_staff, users, case_implants, procedure_types, case_device_companies, surgeon_procedure_averages, surgeon_milestone_averages, case_statuses

### app/checkin/page.tsx (950L, 6q)
Tables: patient_statuses, preop_checklist_fields, patient_checkins

### app/dashboard/data-quality/page.tsx (2072L, 16q)
Tables: case_milestones, facility_milestones, metric_issues, cases, case_statuses

### app/dashboard/page.tsx (735L, 7q)
Tables: surgeon_procedure_stats, facility_milestones, surgeon_milestone_stats, cases, or_rooms, case_milestones

### app/settings/complexities/page.tsx (532L, 8q)
Tables: complexities, procedure_categories

### app/settings/device-reps/page.tsx (611L, 8q)
Tables: users, facilities, facility_device_reps, device_rep_invites, implant_companies

### app/settings/facilities/page.tsx (1161L, 19q)
Tables: users, facilities, procedure_types, procedure_reimbursements, payers

### app/settings/financials/cost-categories/page.tsx (785L, 8q)
Tables: cost_categories, procedure_cost_items, surgeon_cost_items

### app/settings/financials/page.tsx (673L, 8q)
Tables: facility_cost_categories, payers, procedure_types, procedure_cost_items, surgeon_cost_items, facilities, audit_log_with_users

### app/settings/financials/procedure-pricing/page.tsx (827L, 11q)
Tables: procedure_types, cost_categories, procedure_cost_items, procedure_reimbursements, payers, facilities

### app/settings/financials/surgeon-variance/page.tsx (723L, 9q)
Tables: users, user_roles, procedure_types, cost_categories, surgeon_cost_items, procedure_cost_items

### app/settings/general/page.tsx (695L, 6q)
Tables: facilities, cases, users, or_rooms

### app/settings/implant-companies/page.tsx (459L, 7q)
Tables: users, implant_companies

### app/settings/milestones/page.tsx (1197L, 16q)
Tables: facility_milestones, case_milestones

### app/settings/procedure-milestones/page.tsx (507L, 8q)
Tables: procedure_types, facility_milestones, procedure_milestone_config

### app/settings/procedures/page.tsx (875L, 11q)
Tables: procedure_types, body_regions, procedure_techniques, procedure_categories, cases, procedure_milestone_config

### app/settings/rooms/page.tsx (695L, 7q)
Tables: or_rooms, cases, block_schedules

### app/settings/users/page.tsx (954L, 6q)
Tables: users, user_roles, facilities

