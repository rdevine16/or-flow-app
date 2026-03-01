# Epic Field Mapping - Integration Test Plan

## Test Coverage Status

### Unit Tests (Automated) - PASSING
- `lib/dal/__tests__/epic.test.ts`:
  - `listFieldMappings()` - lists all mappings, filters by active status
  - `batchUpdateFieldMappings()` - updates multiple mappings, handles errors
  - `resetFieldMappingsToDefaults()` - deletes all and re-seeds defaults
- `lib/epic/__tests__/audit-domain.test.ts`:
  - Audit action labels for `epic.field_mapping_updated` and `epic.field_mapping_reset`

### Integration Tests (Manual Verification Required)

Due to the complexity of mocking DashboardLayout and the UserContext, the following integration scenarios should be manually verified:

#### Scenario 1: Load and Display
**Steps:**
1. Log in as global admin
2. Navigate to Admin Settings → Integrations → Epic Field Mapping
3. Verify page loads without error
4. Verify default mappings are displayed:
   - Appointment mappings (start → cases.scheduled_date, start → cases.start_time, serviceType → cases.procedure_type_id)
   - Patient mappings (name.family → patients.last_name, name.given → patients.first_name, birthDate → patients.date_of_birth, identifier[MRN] → patients.mrn)
   - Practitioner mapping (name → surgeons.id)
   - Location mapping (name → rooms.id)
5. Verify mappings are grouped by FHIR resource type
6. Verify FHIR source fields are read-only (grayed out, not editable)
7. Verify ORbit target fields are editable (table, column inputs)
8. Verify label and description fields are editable
9. Verify is_active toggle switches work

#### Scenario 2: Edit and Save
**Steps:**
1. From the loaded page, edit one mapping's label (e.g., "Surgery Date" → "Appointment Date")
2. Verify unsaved changes banner appears: "You have 1 unsaved change."
3. Verify edited row has amber highlight
4. Verify Save button shows count: "Save Changes (1)"
5. Click Save Changes
6. Verify success toast: "1 field mapping(s) saved"
7. Verify page refetches data (amber highlight clears)
8. Refresh page manually
9. Verify edited label persists ("Appointment Date" still shows)

**Expected database state:**
- `epic_field_mappings` table has the updated label
- `audit_log` table has a row with action = 'epic.field_mapping_updated', metadata.count = 1

#### Scenario 3: Edit Multiple and Save
**Steps:**
1. Edit 3 different mappings (label, description, orbit_column)
2. Verify unsaved changes banner: "You have 3 unsaved changes."
3. Verify Save button: "Save Changes (3)"
4. Click Save
5. Verify success toast: "3 field mapping(s) saved"
6. Refresh page
7. Verify all 3 edits persisted

**Expected database state:**
- All 3 mappings updated in `epic_field_mappings`
- Audit log shows count = 3

#### Scenario 4: Toggle is_active
**Steps:**
1. Find an active mapping (blue toggle)
2. Click the toggle to deactivate
3. Verify toggle turns gray
4. Verify unsaved changes banner appears
5. Save changes
6. Verify success toast
7. Refresh page
8. Verify toggle remains gray (deactivated)

**Expected database state:**
- `is_active = false` for that mapping

#### Scenario 5: Reset to Defaults
**Steps:**
1. Edit 2 mappings and save them (so they differ from defaults)
2. Click "Reset to Defaults" button
3. Verify confirmation modal appears:
   - Title: "Reset Field Mappings"
   - Warning: "This will delete all current field mappings and restore the default configuration."
   - Red text: "This action cannot be undone."
4. Click "Cancel" → modal closes, no changes
5. Click "Reset to Defaults" again
6. Click "Reset to Defaults" in modal (confirm)
7. Verify success toast: "Field mappings reset to defaults"
8. Verify page refetches data
9. Verify edited mappings are back to default labels

**Expected database state:**
- All rows in `epic_field_mappings` deleted
- Default 9 rows re-inserted with original labels
- Audit log has action = 'epic.field_mapping_reset'

#### Scenario 6: Reset After Edit (Don't Save)
**Steps:**
1. Edit a mapping but DO NOT save
2. Verify unsaved changes banner shows
3. Click "Reset to Defaults"
4. Confirm reset
5. Verify page refetches and unsaved changes are lost (defaults restored)

#### Scenario 7: Empty State
**Steps:**
1. Manually delete all rows from `epic_field_mappings` table (via SQL)
2. Reload page
3. Verify empty state displays:
   - "No field mappings found"
   - "Click 'Reset to Defaults' to restore the default mappings."
4. Click "Reset to Defaults"
5. Verify defaults are restored (9 mappings)

#### Scenario 8: Access Control
**Steps:**
1. Log in as facility admin (NOT global admin)
2. Attempt to navigate to `/admin/settings/epic-field-mapping`
3. Verify redirect to `/dashboard`
4. Verify page does not render

#### Scenario 9: Error Handling - Save Failure
**Steps:**
1. Edit a mapping
2. Simulate DB error (e.g., temporarily revoke UPDATE permission or disconnect network)
3. Click Save
4. Verify error toast: "Save failed" with error message
5. Verify audit log is NOT called (no row created)
6. Verify page state remains (changes not lost, can retry after fixing issue)

#### Scenario 10: Error Handling - Reset Failure
**Steps:**
1. Simulate DB error for DELETE operation
2. Click "Reset to Defaults" and confirm
3. Verify error toast: "Reset failed"
4. Verify audit log is NOT called
5. Verify existing mappings remain unchanged

## ORbit Domain Checks

### Count ↔ List Parity
N/A - This page does not display counts separate from list

### Facility Scoping
N/A - Field mappings are global (not facility-scoped)

### Trigger Chain Awareness
N/A - No triggers fire on epic_field_mappings updates

### Financial Projection Accuracy
N/A - No financial calculations on this page

### Filter Composition
N/A - No filters on this page

### Supabase Query Patterns
- All queries correctly call `epicDAL` functions (no direct Supabase queries in component)
- DAL functions are unit tested

### Empty States
- Tested in Scenario 7

### Bulk Operations
- Tested in Scenario 3 (batch update)
- Tested in Scenario 5 (reset = delete all + re-insert)

## Automated Test Summary

**What's tested automatically:**
- DAL function logic (list, batch update, reset to defaults)
- Error handling in DAL functions
- Audit action labels exist and are human-readable

**What requires manual testing:**
- Full page render with DashboardLayout
- User interactions (edit fields, toggle switches, click buttons)
- Toast notifications
- Modal confirmation flow
- Page refetch after mutations
- Browser refresh persistence
- Access control redirect

## Recommendation

For Phase 2b, the critical layer (DAL functions) has full unit test coverage. The UI layer is straightforward CRUD and can be verified manually using the scenarios above. Future work could add integration tests with a custom render helper that mocks DashboardLayout + UserContext, but for initial shipment, manual verification is sufficient given:

1. No complex business logic in the UI component
2. All data operations are tested at the DAL layer
3. The component follows established patterns (similar to other admin settings pages)
4. Manual test scenarios provide clear verification steps
