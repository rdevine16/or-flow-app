/**
 * ReviewDetailPanel Tests
 *
 * Tests the 3-column entity mapping layout for reviewing pending HL7v2 imports.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ReviewDetailPanel, {
  computeHasUnresolved,
  getEntityMatchState,
  findEntityMapping,
} from '../ReviewDetailPanel'
import type { EhrIntegrationLog, EhrEntityMapping } from '@/lib/integrations/shared/integration-types'

// ── Mock HL7MessageViewer ────────────────────────────────────────────────────
vi.mock('@/components/integrations/HL7MessageViewer', () => ({
  default: ({ rawMessage, parsedData }: { rawMessage: string | null; parsedData: Record<string, unknown> | null }) => (
    <div data-testid="hl7-viewer">
      <span data-testid="raw">{rawMessage}</span>
      <span data-testid="parsed">{parsedData ? 'has-parsed' : 'no-parsed'}</span>
    </div>
  ),
}))

// ── Test Data ────────────────────────────────────────────────────────────────

const mockSurgeons = [
  { id: 'surg-1', label: 'Smith, John' },
  { id: 'surg-2', label: 'Jones, Emily' },
  { id: 'surg-3', label: 'Wilson, Robert' },
  { id: 'surg-4', label: 'Brown, Sarah' },
  { id: 'surg-5', label: 'Davis, Michael' },
  { id: 'surg-6', label: 'Miller, Amanda' },
  { id: 'surg-7', label: 'Taylor, James' },
  { id: 'surg-8', label: 'Anderson, Lisa' },
  { id: 'surg-9', label: 'Thomas, David' },
  { id: 'surg-10', label: 'Jackson, Jennifer' },
  { id: 'surg-11', label: 'White, Christopher' },
  { id: 'surg-12', label: 'Harris, Patricia' },
]

const mockProcedures = [
  { id: 'proc-1', label: 'Total Knee Replacement' },
  { id: 'proc-2', label: 'Total Hip Replacement' },
  { id: 'proc-3', label: 'Rotator Cuff Repair' },
  { id: 'proc-4', label: 'ACL Reconstruction' },
  { id: 'proc-5', label: 'Carpal Tunnel Release' },
  { id: 'proc-6', label: 'Lumbar Fusion' },
  { id: 'proc-7', label: 'Cervical Discectomy' },
  { id: 'proc-8', label: 'Ankle Arthroscopy' },
  { id: 'proc-9', label: 'Shoulder Arthroscopy' },
  { id: 'proc-10', label: 'Meniscus Repair' },
  { id: 'proc-11', label: 'Bunionectomy' },
  { id: 'proc-12', label: 'Trigger Finger Release' },
]

const mockRooms = [
  { id: 'room-1', label: 'OR 1' },
  { id: 'room-2', label: 'OR 2' },
  { id: 'room-3', label: 'OR 3' },
]

/** Entity mappings matching the test data's external identifiers */
const mockEntityMappings: EhrEntityMapping[] = [
  {
    id: 'map-1', facility_id: 'fac-1', integration_id: 'int-1',
    entity_type: 'surgeon', external_identifier: '1234567890',
    external_display_name: 'JONES, EMILY A',
    orbit_entity_id: 'surg-2', orbit_display_name: 'Jones, Emily',
    match_method: 'auto', match_confidence: 0.85,
    created_at: '2026-03-01T00:00:00Z', updated_at: '2026-03-01T00:00:00Z',
  },
  {
    id: 'map-2', facility_id: 'fac-1', integration_id: 'int-1',
    entity_type: 'procedure', external_identifier: '27447',
    external_display_name: 'Total knee arthroplasty',
    orbit_entity_id: 'proc-1', orbit_display_name: 'Total Knee Replacement',
    match_method: 'auto', match_confidence: 0.82,
    created_at: '2026-03-01T00:00:00Z', updated_at: '2026-03-01T00:00:00Z',
  },
  {
    id: 'map-3', facility_id: 'fac-1', integration_id: 'int-1',
    entity_type: 'room', external_identifier: 'OR3',
    external_display_name: 'Operating Room 3',
    orbit_entity_id: 'room-3', orbit_display_name: 'OR 3',
    match_method: 'auto', match_confidence: 0.90,
    created_at: '2026-03-01T00:00:00Z', updated_at: '2026-03-01T00:00:00Z',
  },
]

function createEntry(overrides: Partial<EhrIntegrationLog> = {}): EhrIntegrationLog {
  return {
    id: 'log-1',
    facility_id: 'fac-1',
    integration_id: 'int-1',
    message_type: 'SIU^S12',
    message_control_id: 'MSG001',
    raw_message: 'MSH|^~\\&|EPIC|...',
    parsed_data: {
      triggerEvent: 'S12',
      externalCaseId: 'SC10001',
      scheduledStart: '2026-03-01T08:00:00',
      patient: {
        mrn: '12345',
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: '1970-05-15',
        gender: 'M',
      },
      surgeon: {
        id: 'EP001',
        npi: '1234567890',
        name: 'JONES, EMILY A',
      },
      procedure: {
        cptCode: '27447',
        name: 'Total knee arthroplasty',
      },
      room: {
        code: 'OR3',
        name: 'Operating Room 3',
      },
    },
    processing_status: 'pending_review',
    error_message: null,
    external_case_id: 'SC10001',
    case_id: null,
    review_notes: {
      unmatched_surgeon: {
        name: 'JONES, EMILY A',
        npi: '1234567890',
        suggestions: [
          {
            orbit_entity_id: 'surg-2',
            orbit_display_name: 'Jones, Emily',
            confidence: 0.85,
            match_reason: 'Name similarity',
          },
        ],
      },
      unmatched_procedure: {
        cpt: '27447',
        name: 'Total knee arthroplasty',
        suggestions: [
          {
            orbit_entity_id: 'proc-1',
            orbit_display_name: 'Total Knee Replacement',
            confidence: 0.82,
            match_reason: 'Name similarity',
          },
        ],
      },
    },
    reviewed_by: null,
    reviewed_at: null,
    created_at: '2026-03-01T10:00:00Z',
    processed_at: null,
    ...overrides,
  }
}

const defaultProps = {
  allSurgeons: mockSurgeons,
  allProcedures: mockProcedures,
  allRooms: mockRooms,
  entityMappings: mockEntityMappings,
  onResolveEntity: vi.fn().mockResolvedValue(undefined),
  onRemapCaseOnly: vi.fn().mockResolvedValue(undefined),
  onCreateEntity: vi.fn().mockResolvedValue('new-entity-id'),
  onPhiAccess: vi.fn(),
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('ReviewDetailPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Header', () => {
    it('renders patient name, message type, case ID, and date', () => {
      render(<ReviewDetailPanel entry={createEntry()} {...defaultProps} />)
      // Patient name appears in both header and patient row
      const patientNames = screen.getAllByText('Doe, John')
      expect(patientNames.length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText('SIU^S12')).toBeInTheDocument()
      expect(screen.getByText(/SC10001/)).toBeInTheDocument()
    })
  })

  describe('Entity Mapping Table', () => {
    it('renders all 4 entity rows (surgeon, procedure, room, patient)', () => {
      render(<ReviewDetailPanel entry={createEntry()} {...defaultProps} />)
      expect(screen.getByText('Surgeon')).toBeInTheDocument()
      expect(screen.getByText('Procedure')).toBeInTheDocument()
      expect(screen.getByText('Room')).toBeInTheDocument()
      expect(screen.getByText('Patient')).toBeInTheDocument()
    })

    it('shows unmatched surgeon with Epic data', () => {
      render(<ReviewDetailPanel entry={createEntry()} {...defaultProps} />)
      expect(screen.getByText('JONES, EMILY A')).toBeInTheDocument()
      expect(screen.getByText(/NPI: 1234567890/)).toBeInTheDocument()
    })

    it('shows unmatched procedure with Epic data', () => {
      render(<ReviewDetailPanel entry={createEntry()} {...defaultProps} />)
      expect(screen.getByText('Total knee arthroplasty')).toBeInTheDocument()
      expect(screen.getByText(/CPT: 27447/)).toBeInTheDocument()
    })

    it('shows auto-matched room with ORbit name from mapping', () => {
      render(<ReviewDetailPanel entry={createEntry()} {...defaultProps} />)
      // Room is NOT in review_notes.unmatched_room, and has a mapping → auto_matched
      // Epic column shows "Operating Room 3"
      expect(screen.getByText('Operating Room 3')).toBeInTheDocument()
      // ORbit column shows the mapped ORbit name, not the Epic name
      expect(screen.getByText('OR 3')).toBeInTheDocument()
      // Should show "Auto-matched" badge
      expect(screen.getByText('Auto-matched')).toBeInTheDocument()
    })

    it('shows "Change" button on auto-matched entities', () => {
      render(<ReviewDetailPanel entry={createEntry()} {...defaultProps} />)
      // Room is auto-matched, so it should have a "Change" button
      expect(screen.getByText('Change')).toBeInTheDocument()
    })

    it('shows patient row as info-only with MRN matching text', () => {
      render(<ReviewDetailPanel entry={createEntry()} {...defaultProps} />)
      // Patient name appears in both header and patient row
      const patientNames = screen.getAllByText('Doe, John')
      expect(patientNames.length).toBeGreaterThanOrEqual(2) // header + patient row
      expect(screen.getByText(/MRN: 12345/)).toBeInTheDocument()
      expect(screen.getByText('Matched by MRN on import')).toBeInTheDocument()
    })

    it('shows selector dropdowns for unmatched entities', () => {
      render(<ReviewDetailPanel entry={createEntry()} {...defaultProps} />)
      // Surgeon and procedure are unmatched, so they should have "Select" buttons
      const selectButtons = screen.getAllByText(/Select surgeon|Select procedure/i)
      expect(selectButtons.length).toBe(2)
    })
  })

  describe('Entity Selector - No 10-item limit', () => {
    it('shows ALL entities in the dropdown (no truncation)', async () => {
      const user = userEvent.setup()
      render(<ReviewDetailPanel entry={createEntry()} {...defaultProps} />)

      // Click to open surgeon selector
      const surgeonSelect = screen.getByText(/Select surgeon/i)
      await user.click(surgeonSelect)

      // All 12 surgeons should be visible (not just 10)
      await waitFor(() => {
        // Suggestions show at top, rest below
        // Jones, Emily appears as suggestion, others in all list
        expect(screen.getByText('Smith, John')).toBeInTheDocument()
        expect(screen.getByText('White, Christopher')).toBeInTheDocument()
        expect(screen.getByText('Harris, Patricia')).toBeInTheDocument()
      })
    })

    it('shows suggestions section at top of dropdown', async () => {
      const user = userEvent.setup()
      render(<ReviewDetailPanel entry={createEntry()} {...defaultProps} />)

      const surgeonSelect = screen.getByText(/Select surgeon/i)
      await user.click(surgeonSelect)

      await waitFor(() => {
        expect(screen.getByText('Suggestions')).toBeInTheDocument()
        expect(screen.getByText('Jones, Emily')).toBeInTheDocument()
        expect(screen.getByText(/85% match/)).toBeInTheDocument()
      })
    })

    it('filters entities when search query is typed', async () => {
      const user = userEvent.setup()
      render(<ReviewDetailPanel entry={createEntry()} {...defaultProps} />)

      const surgeonSelect = screen.getByText(/Select surgeon/i)
      await user.click(surgeonSelect)

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Search surgeons/i)).toBeInTheDocument()
      })

      const searchInput = screen.getByPlaceholderText(/Search surgeons/i)
      await user.type(searchInput, 'Smith')

      await waitFor(() => {
        expect(screen.getByText('Smith, John')).toBeInTheDocument()
        expect(screen.queryByText('Harris, Patricia')).not.toBeInTheDocument()
      })
    })
  })

  describe('Entity Mapping Actions', () => {
    it('calls onResolveEntity when suggestion is clicked', async () => {
      const user = userEvent.setup()
      render(<ReviewDetailPanel entry={createEntry()} {...defaultProps} />)

      // Open surgeon selector
      const surgeonSelect = screen.getByText(/Select surgeon/i)
      await user.click(surgeonSelect)

      // Click the suggestion
      await waitFor(() => {
        expect(screen.getByText('Jones, Emily')).toBeInTheDocument()
      })

      const mapButtons = screen.getAllByText('Map')
      await user.click(mapButtons[0])

      await waitFor(() => {
        expect(defaultProps.onResolveEntity).toHaveBeenCalledWith(
          expect.objectContaining({ id: 'log-1' }),
          'surgeon',
          '1234567890',
          'JONES, EMILY A',
          'surg-2',
          'Jones, Emily',
        )
      })
    })

    it('calls onResolveEntity when entity is selected from list', async () => {
      const user = userEvent.setup()
      render(<ReviewDetailPanel entry={createEntry()} {...defaultProps} />)

      // Open procedure selector
      const procSelect = screen.getByText(/Select procedure/i)
      await user.click(procSelect)

      // Search for a specific procedure
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Search procedures/i)).toBeInTheDocument()
      })

      const searchInput = screen.getByPlaceholderText(/Search procedures/i)
      await user.type(searchInput, 'Rotator')

      await waitFor(() => {
        expect(screen.getByText('Rotator Cuff Repair')).toBeInTheDocument()
      })

      await user.click(screen.getByText('Rotator Cuff Repair'))

      await waitFor(() => {
        expect(defaultProps.onResolveEntity).toHaveBeenCalledWith(
          expect.objectContaining({ id: 'log-1' }),
          'procedure',
          '27447',
          'Total knee arthroplasty',
          'proc-3',
          'Rotator Cuff Repair',
        )
      })
    })
  })

  describe('Create New Entity', () => {
    it('shows create form when "Create New" is clicked', async () => {
      const user = userEvent.setup()
      render(<ReviewDetailPanel entry={createEntry()} {...defaultProps} />)

      // Open surgeon selector
      await user.click(screen.getByText(/Select surgeon/i))

      // Click "Create New Surgeon"
      await waitFor(() => {
        expect(screen.getByText(/Create New Surgeon/i)).toBeInTheDocument()
      })

      await user.click(screen.getByText(/Create New Surgeon/i))

      // Form should appear with pre-filled name
      await waitFor(() => {
        expect(screen.getByDisplayValue('JONES, EMILY A')).toBeInTheDocument()
        expect(screen.getByDisplayValue('1234567890')).toBeInTheDocument()
      })
    })

    it('calls onCreateEntity and onResolveEntity when form is submitted', async () => {
      const user = userEvent.setup()
      render(<ReviewDetailPanel entry={createEntry()} {...defaultProps} />)

      await user.click(screen.getByText(/Select surgeon/i))

      await waitFor(() => {
        expect(screen.getByText(/Create New Surgeon/i)).toBeInTheDocument()
      })

      await user.click(screen.getByText(/Create New Surgeon/i))

      // Submit the create form
      await waitFor(() => {
        expect(screen.getByText('Create & Map')).toBeInTheDocument()
      })

      await user.click(screen.getByText('Create & Map'))

      await waitFor(() => {
        expect(defaultProps.onCreateEntity).toHaveBeenCalledWith(
          expect.objectContaining({
            entityType: 'surgeon',
            name: 'JONES, EMILY A',
            npi: '1234567890',
          }),
        )
        expect(defaultProps.onResolveEntity).toHaveBeenCalledWith(
          expect.objectContaining({ id: 'log-1' }),
          'surgeon',
          '1234567890',
          'JONES, EMILY A',
          'new-entity-id',
          'JONES, EMILY A',
        )
      })
    })
  })

  // Note: Approve/Reject buttons moved to ImportReviewDrawer (phase 14).
  // Those interactions are tested in ImportReviewDrawer tests.

  describe('HL7 Message Viewer', () => {
    it('is collapsed by default', () => {
      render(<ReviewDetailPanel entry={createEntry()} {...defaultProps} />)
      expect(screen.getByText('View Full HL7 Message')).toBeInTheDocument()
      expect(screen.queryByTestId('hl7-viewer')).not.toBeInTheDocument()
    })

    it('expands on click and logs PHI access', async () => {
      const user = userEvent.setup()
      render(<ReviewDetailPanel entry={createEntry()} {...defaultProps} />)

      await user.click(screen.getByText('View Full HL7 Message'))

      expect(screen.getByTestId('hl7-viewer')).toBeInTheDocument()
      expect(defaultProps.onPhiAccess).toHaveBeenCalledWith('log-1', 'SIU^S12')
    })
  })

  describe('Demographics Mismatch', () => {
    it('shows demographics mismatch warning when present', () => {
      const entry = createEntry({
        review_notes: {
          ...createEntry().review_notes,
          demographics_mismatch: {
            field: 'dateOfBirth',
            expected: '1970-05-15',
            received: '1970-05-16',
          },
        },
      })
      render(<ReviewDetailPanel entry={entry} {...defaultProps} />)
      expect(screen.getByText('Demographics Mismatch')).toBeInTheDocument()
      expect(screen.getByText(/dateOfBirth/)).toBeInTheDocument()
    })

    it('does not show demographics warning when absent', () => {
      render(<ReviewDetailPanel entry={createEntry()} {...defaultProps} />)
      expect(screen.queryByText('Demographics Mismatch')).not.toBeInTheDocument()
    })
  })

  describe('All-matched state', () => {
    it('shows all entities as auto-matched when review_notes is null and mappings exist', () => {
      const allMatchedEntry = createEntry({ review_notes: null })
      render(<ReviewDetailPanel entry={allMatchedEntry} {...defaultProps} />)

      // All 3 entity rows (surgeon, procedure, room) should show "Auto-matched"
      const autoMatchedTexts = screen.getAllByText('Auto-matched')
      expect(autoMatchedTexts.length).toBe(3)

      // ORbit names from mappings should appear
      expect(screen.getByText('Jones, Emily')).toBeInTheDocument()
      expect(screen.getByText('Total Knee Replacement')).toBeInTheDocument()
      expect(screen.getByText('OR 3')).toBeInTheDocument()

      // Patient shows MRN matching text
      expect(screen.getByText('Matched by MRN on import')).toBeInTheDocument()

      // No selector dropdowns
      expect(screen.queryByText(/Select surgeon/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/Select procedure/i)).not.toBeInTheDocument()
    })

    it('shows "Change" button on all auto-matched entities', () => {
      const allMatchedEntry = createEntry({ review_notes: null })
      render(<ReviewDetailPanel entry={allMatchedEntry} {...defaultProps} />)

      const changeButtons = screen.getAllByText('Change')
      expect(changeButtons.length).toBe(3) // surgeon, procedure, room
    })
  })

  describe('Re-mapping (Change) flow', () => {
    it('clicking "Change" opens remap selector with entity list', async () => {
      const user = userEvent.setup()
      const allMatchedEntry = createEntry({ review_notes: null })
      render(<ReviewDetailPanel entry={allMatchedEntry} {...defaultProps} />)

      // Click the first "Change" button (surgeon)
      const changeButtons = screen.getAllByText('Change')
      await user.click(changeButtons[0])

      // Should show remap selector with search and entity list
      await waitFor(() => {
        expect(screen.getByText(/Change surgeon/i)).toBeInTheDocument()
        expect(screen.getByText('Cancel')).toBeInTheDocument()
      })
    })

    it('selecting an entity shows "This case only" and "All future matches" choices', async () => {
      const user = userEvent.setup()
      const allMatchedEntry = createEntry({ review_notes: null })
      render(<ReviewDetailPanel entry={allMatchedEntry} {...defaultProps} />)

      // Click Change on surgeon
      const changeButtons = screen.getAllByText('Change')
      await user.click(changeButtons[0])

      // Select a different surgeon from the remap list
      await waitFor(() => {
        expect(screen.getByText('Smith, John')).toBeInTheDocument()
      })
      await user.click(screen.getByText('Smith, John'))

      // Should show scope choice
      await waitFor(() => {
        expect(screen.getByText('This case only')).toBeInTheDocument()
        expect(screen.getByText('All future matches')).toBeInTheDocument()
      })
    })

    it('clicking "This case only" calls onRemapCaseOnly', async () => {
      const user = userEvent.setup()
      const allMatchedEntry = createEntry({ review_notes: null })
      render(<ReviewDetailPanel entry={allMatchedEntry} {...defaultProps} />)

      // Click Change on surgeon
      const changeButtons = screen.getAllByText('Change')
      await user.click(changeButtons[0])

      // Select a different surgeon
      await waitFor(() => {
        expect(screen.getByText('Smith, John')).toBeInTheDocument()
      })
      await user.click(screen.getByText('Smith, John'))

      // Click "This case only"
      await user.click(screen.getByText('This case only'))

      await waitFor(() => {
        expect(defaultProps.onRemapCaseOnly).toHaveBeenCalledWith(
          expect.objectContaining({ id: 'log-1' }),
          'surgeon',
          'surg-1',
          'Smith, John',
        )
      })
    })

    it('clicking "All future matches" calls onResolveEntity', async () => {
      const user = userEvent.setup()
      const allMatchedEntry = createEntry({ review_notes: null })
      render(<ReviewDetailPanel entry={allMatchedEntry} {...defaultProps} />)

      // Click Change on surgeon
      const changeButtons = screen.getAllByText('Change')
      await user.click(changeButtons[0])

      // Select a different surgeon
      await waitFor(() => {
        expect(screen.getByText('Smith, John')).toBeInTheDocument()
      })
      await user.click(screen.getByText('Smith, John'))

      // Click "All future matches"
      await user.click(screen.getByText('All future matches'))

      await waitFor(() => {
        expect(defaultProps.onResolveEntity).toHaveBeenCalledWith(
          expect.objectContaining({ id: 'log-1' }),
          'surgeon',
          '1234567890',
          'JONES, EMILY A',
          'surg-1',
          'Smith, John',
        )
      })
    })

    it('Cancel button closes remap selector', async () => {
      const user = userEvent.setup()
      const allMatchedEntry = createEntry({ review_notes: null })
      render(<ReviewDetailPanel entry={allMatchedEntry} {...defaultProps} />)

      // Click Change
      const changeButtons = screen.getAllByText('Change')
      await user.click(changeButtons[0])

      // Verify remap UI is open
      await waitFor(() => {
        expect(screen.getByText(/Change surgeon/i)).toBeInTheDocument()
      })

      // Click Cancel
      await user.click(screen.getByText('Cancel'))

      // Should return to auto-matched display
      await waitFor(() => {
        expect(screen.queryByText(/Change surgeon/i)).not.toBeInTheDocument()
        expect(screen.getByText('Jones, Emily')).toBeInTheDocument()
      })
    })
  })

  describe('Case override state', () => {
    it('shows case override badge when review_notes.matched_* exists', () => {
      const overrideEntry = createEntry({
        review_notes: {
          matched_surgeon: {
            orbit_entity_id: 'surg-1',
            orbit_display_name: 'Smith, John',
          },
        },
      })
      render(<ReviewDetailPanel entry={overrideEntry} {...defaultProps} />)

      expect(screen.getByText('Case override')).toBeInTheDocument()
      expect(screen.getByText('Smith, John')).toBeInTheDocument()
    })

    it('shows "Change" button on case override entities', () => {
      const overrideEntry = createEntry({
        review_notes: {
          matched_surgeon: {
            orbit_entity_id: 'surg-1',
            orbit_display_name: 'Smith, John',
          },
        },
      })
      render(<ReviewDetailPanel entry={overrideEntry} {...defaultProps} />)

      // Should have Change buttons (surgeon case override + room auto-matched)
      const changeButtons = screen.getAllByText('Change')
      expect(changeButtons.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('No mapping state', () => {
    it('shows entity selector when no mapping and no unmatched entry', () => {
      // Room has no unmatched entry and no mapping → shows selector
      const entry = createEntry()
      render(
        <ReviewDetailPanel
          entry={entry}
          {...defaultProps}
          entityMappings={[]} // No mappings at all
        />,
      )

      // Room should show selector since there's no mapping and no unmatched entry
      // Surgeon and procedure have unmatched entries → always show selector
      // Room with no mapping → also shows selector
      const selectButtons = screen.getAllByText(/Select/i)
      expect(selectButtons.length).toBeGreaterThanOrEqual(3) // surgeon + procedure + room
    })
  })
})

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EXPORTED HELPER FUNCTIONS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('Exported helper functions', () => {
  describe('findEntityMapping', () => {
    it('returns mapping when found by entity type and external identifier', () => {
      const mapping = findEntityMapping(
        'surgeon',
        ['1234567890'],
        mockEntityMappings,
      )
      expect(mapping).toBeDefined()
      expect(mapping?.entity_type).toBe('surgeon')
      expect(mapping?.external_identifier).toBe('1234567890')
      expect(mapping?.orbit_entity_id).toBe('surg-2')
    })

    it('returns undefined when no mapping exists for entity type', () => {
      const mapping = findEntityMapping(
        'surgeon',
        ['unknown-npi'],
        mockEntityMappings,
      )
      expect(mapping).toBeUndefined()
    })

    it('returns undefined when external identifier does not match', () => {
      const mapping = findEntityMapping(
        'surgeon',
        ['9999999999'],
        mockEntityMappings,
      )
      expect(mapping).toBeUndefined()
    })

    it('handles empty mappings array', () => {
      const mapping = findEntityMapping('surgeon', ['1234567890'], [])
      expect(mapping).toBeUndefined()
    })

    it('tries multiple identifiers and returns first match', () => {
      const mapping = findEntityMapping(
        'surgeon',
        ['wrong-id', '1234567890', 'another-id'],
        mockEntityMappings,
      )
      expect(mapping).toBeDefined()
      expect(mapping?.orbit_entity_id).toBe('surg-2')
    })

    it('skips empty or null identifiers', () => {
      const mapping = findEntityMapping(
        'surgeon',
        ['', '1234567890'],
        mockEntityMappings,
      )
      expect(mapping).toBeDefined()
      expect(mapping?.orbit_entity_id).toBe('surg-2')
    })
  })

  describe('getEntityMatchState', () => {
    it('returns "unmatched" when entity is in review_notes.unmatched_surgeon', () => {
      const reviewNotes = {
        unmatched_surgeon: {
          name: 'JONES, EMILY A',
          npi: '1234567890',
          suggestions: [],
        },
      }
      const mapping = undefined // No auto mapping
      const state = getEntityMatchState('surgeon', reviewNotes, mapping)
      expect(state).toBe('unmatched')
    })

    it('returns "case_override" when entity is in review_notes.matched_procedure', () => {
      const reviewNotes = {
        matched_procedure: {
          orbit_procedure_id: 'proc-override',
        },
      }
      const mapping = mockEntityMappings.find(m => m.entity_type === 'procedure')
      const state = getEntityMatchState('procedure', reviewNotes, mapping)
      expect(state).toBe('case_override')
    })

    it('returns "auto_matched" when mapping exists and no review_notes override', () => {
      const reviewNotes = null
      const mapping = mockEntityMappings.find(m => m.entity_type === 'surgeon')
      const state = getEntityMatchState('surgeon', reviewNotes, mapping)
      expect(state).toBe('auto_matched')
    })

    it('returns "no_mapping" when no mapping exists and not in review_notes', () => {
      const reviewNotes = null
      const mapping = undefined
      const state = getEntityMatchState('surgeon', reviewNotes, mapping)
      expect(state).toBe('no_mapping')
    })

    it('prioritizes case_override over auto_matched', () => {
      // Even if a mapping exists, if there's a case override it should return case_override
      const reviewNotes = {
        matched_surgeon: {
          orbit_surgeon_id: 'surg-override',
        },
      }
      const mapping = mockEntityMappings.find(m => m.entity_type === 'surgeon')
      const state = getEntityMatchState('surgeon', reviewNotes, mapping)
      expect(state).toBe('case_override')
    })

    it('prioritizes unmatched over auto_matched', () => {
      // If both unmatched AND mapping exist, unmatched takes precedence
      const reviewNotes = {
        unmatched_surgeon: {
          name: 'JONES, EMILY A',
          npi: '1234567890',
          suggestions: [],
        },
      }
      const mapping = mockEntityMappings.find(m => m.entity_type === 'surgeon')
      const state = getEntityMatchState('surgeon', reviewNotes, mapping)
      expect(state).toBe('unmatched')
    })

    it('handles room entity type with matched_room', () => {
      const reviewNotes = {
        matched_room: {
          orbit_room_id: 'room-override',
        },
      }
      const mapping = mockEntityMappings.find(m => m.entity_type === 'room')
      const state = getEntityMatchState('room', reviewNotes, mapping)
      expect(state).toBe('case_override')
    })
  })

  describe('computeHasUnresolved', () => {
    it('returns true when surgeon is unmatched', () => {
      const entry = createEntry({
        review_notes: {
          unmatched_surgeon: {
            name: 'JONES, EMILY A',
            npi: '1234567890',
            suggestions: [],
          },
        },
      })
      const hasUnresolved = computeHasUnresolved(entry, mockEntityMappings)
      expect(hasUnresolved).toBe(true)
    })

    it('returns true when procedure is unmatched', () => {
      const entry = createEntry({
        review_notes: {
          unmatched_procedure: {
            cpt: '27447',
            name: 'Total knee arthroplasty',
            suggestions: [],
          },
        },
      })
      const hasUnresolved = computeHasUnresolved(entry, mockEntityMappings)
      expect(hasUnresolved).toBe(true)
    })

    it('returns true when surgeon has no mapping', () => {
      const defaultEntry = createEntry()
      const entry = {
        ...defaultEntry,
        parsed_data: {
          ...(defaultEntry.parsed_data as Record<string, unknown>),
          surgeon: { npi: 'unknown-npi', name: 'Unknown Surgeon' },
          // Keep procedure from default (has mapping)
        },
      }
      const hasUnresolved = computeHasUnresolved(entry, mockEntityMappings)
      expect(hasUnresolved).toBe(true)
    })

    it('returns true when procedure has no mapping', () => {
      const defaultEntry = createEntry()
      const entry = {
        ...defaultEntry,
        parsed_data: {
          ...(defaultEntry.parsed_data as Record<string, unknown>),
          procedure: { cptCode: 'unknown-code' },
          // Keep surgeon from default (has mapping)
        },
      }
      const hasUnresolved = computeHasUnresolved(entry, mockEntityMappings)
      expect(hasUnresolved).toBe(true)
    })

    it('returns false when both surgeon and procedure are auto-matched', () => {
      // Use createEntry with review_notes=null so it uses auto-mappings
      const entry = createEntry({ review_notes: null })
      const hasUnresolved = computeHasUnresolved(entry, mockEntityMappings)
      expect(hasUnresolved).toBe(false)
    })

    it('returns false when both surgeon and procedure have case overrides', () => {
      const entry = createEntry({
        review_notes: {
          matched_surgeon: {
            orbit_surgeon_id: 'surg-1',
          },
          matched_procedure: {
            orbit_procedure_id: 'proc-1',
          },
        },
      })
      const hasUnresolved = computeHasUnresolved(entry, mockEntityMappings)
      expect(hasUnresolved).toBe(false)
    })

    it('returns false when mix of auto-matched and case overrides', () => {
      // Start with default entry (has both surgeon and procedure data)
      // Then add case override for procedure via review_notes
      const entry = createEntry({
        review_notes: {
          matched_procedure: {
            orbit_procedure_id: 'proc-override',
          },
        },
        // surgeon npi '1234567890' from default createEntry will auto-match
      })
      const hasUnresolved = computeHasUnresolved(entry, mockEntityMappings)
      expect(hasUnresolved).toBe(false)
    })

    it('returns true when demographics_mismatch is present', () => {
      // Use default entry (has both surgeon and procedure mappings)
      const entry = createEntry({
        review_notes: {
          demographics_mismatch: {
            expected: { firstName: 'John', lastName: 'Smith' },
            received: { firstName: 'Jane', lastName: 'Smith' },
          },
        },
      })
      const hasUnresolved = computeHasUnresolved(entry, mockEntityMappings)
      expect(hasUnresolved).toBe(true)
    })

    it('returns true when parsed_data is null (cannot verify matches)', () => {
      const entry = createEntry({ parsed_data: null })
      const hasUnresolved = computeHasUnresolved(entry, mockEntityMappings)
      // When parsed_data is null, there's no surgeon/procedure → both are undefined → no mapping → unresolved
      expect(hasUnresolved).toBe(true)
    })

    it('returns true when surgeon and procedure are missing from parsed_data', () => {
      const defaultEntry = createEntry()
      const entry = {
        ...defaultEntry,
        parsed_data: {
          room: { code: 'OR3' }, // Only room, no surgeon or procedure
        },
      }
      const hasUnresolved = computeHasUnresolved(entry, mockEntityMappings)
      // Missing surgeon/procedure → no mapping → unresolved
      expect(hasUnresolved).toBe(true)
    })
  })
})
