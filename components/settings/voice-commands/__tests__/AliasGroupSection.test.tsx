import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AliasGroupSection } from '../AliasGroupSection'
import type { VoiceCommandAlias } from '@/lib/dal/voice-commands'

// Mock child components
vi.mock('../AliasRow', () => ({
  AliasRow: ({ alias }: { alias: VoiceCommandAlias }) => (
    <div data-testid={`alias-row-${alias.id}`}>{alias.alias_phrase}</div>
  ),
}))

vi.mock('../AddAliasInput', () => ({
  AddAliasInput: ({ actionType }: { actionType: string }) => (
    <div data-testid="add-alias-input">Add {actionType}</div>
  ),
}))

describe('AliasGroupSection', () => {
  const mockOnDelete = vi.fn()
  const mockOnAdded = vi.fn()

  const defaultProps = {
    actionType: 'record',
    aliases: [],
    milestoneTypeId: 'milestone-1',
    facilityId: 'facility-1',
    onDelete: mockOnDelete,
    onAdded: mockOnAdded,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Section Header', () => {
    it('renders action type label', () => {
      render(<AliasGroupSection {...defaultProps} />)
      expect(screen.getByText('Record')).toBeInTheDocument()
    })

    it('displays alias count badge', () => {
      render(<AliasGroupSection {...defaultProps} />)
      expect(screen.getByText('0')).toBeInTheDocument()
    })

    it('shows correct count when aliases are provided', () => {
      const aliases: VoiceCommandAlias[] = [
        {
          id: 'alias-1',
          alias_phrase: 'start case',
          action_type: 'record',
          milestone_type_id: 'milestone-1',
        } as VoiceCommandAlias,
        {
          id: 'alias-2',
          alias_phrase: 'begin procedure',
          action_type: 'record',
          milestone_type_id: 'milestone-1',
        } as VoiceCommandAlias,
      ]

      render(<AliasGroupSection {...defaultProps} aliases={aliases} />)
      expect(screen.getByText('2')).toBeInTheDocument()
    })

    it('renders correct label for cancel action type', () => {
      render(<AliasGroupSection {...defaultProps} actionType="cancel" />)
      expect(screen.getByText('Cancel')).toBeInTheDocument()
    })

    it('renders correct label for utility actions', () => {
      render(<AliasGroupSection {...defaultProps} actionType="next_patient" />)
      expect(screen.getByText('Next Patient')).toBeInTheDocument()
    })

    it('falls back to raw action_type for unknown action types', () => {
      render(<AliasGroupSection {...defaultProps} actionType="unknown_action" />)
      expect(screen.getByText('unknown_action')).toBeInTheDocument()
    })
  })

  describe('Empty State', () => {
    it('shows "No aliases yet" when aliases array is empty', () => {
      render(<AliasGroupSection {...defaultProps} aliases={[]} />)
      expect(screen.getByText('No aliases yet')).toBeInTheDocument()
    })

    it('does not render AliasRow components when empty', () => {
      render(<AliasGroupSection {...defaultProps} aliases={[]} />)
      expect(screen.queryByTestId(/^alias-row-/)).not.toBeInTheDocument()
    })
  })

  describe('Alias List Rendering', () => {
    it('renders AliasRow for each alias', () => {
      const aliases: VoiceCommandAlias[] = [
        {
          id: 'alias-1',
          alias_phrase: 'start case',
          action_type: 'record',
          milestone_type_id: 'milestone-1',
        } as VoiceCommandAlias,
        {
          id: 'alias-2',
          alias_phrase: 'begin procedure',
          action_type: 'record',
          milestone_type_id: 'milestone-1',
        } as VoiceCommandAlias,
      ]

      render(<AliasGroupSection {...defaultProps} aliases={aliases} />)
      expect(screen.getByTestId('alias-row-alias-1')).toBeInTheDocument()
      expect(screen.getByTestId('alias-row-alias-2')).toBeInTheDocument()
      expect(screen.getByText('start case')).toBeInTheDocument()
      expect(screen.getByText('begin procedure')).toBeInTheDocument()
    })

    it('hides empty state message when aliases exist', () => {
      const aliases: VoiceCommandAlias[] = [
        {
          id: 'alias-1',
          alias_phrase: 'start case',
          action_type: 'record',
          milestone_type_id: 'milestone-1',
        } as VoiceCommandAlias,
      ]

      render(<AliasGroupSection {...defaultProps} aliases={aliases} />)
      expect(screen.queryByText('No aliases yet')).not.toBeInTheDocument()
    })

    it('passes correct props to AliasRow components', () => {
      const alias: VoiceCommandAlias = {
        id: 'alias-1',
        alias_phrase: 'start case',
        action_type: 'record',
        milestone_type_id: 'milestone-1',
        facility_id: 'facility-1',
        facility_milestone_id: null,
        source_alias_id: null,
        is_active: true,
        deleted_at: null,
        created_at: '2026-03-01T10:00:00Z',
        updated_at: '2026-03-01T10:00:00Z',
        auto_learned: false,
      }

      render(<AliasGroupSection {...defaultProps} aliases={[alias]} />)
      expect(screen.getByTestId('alias-row-alias-1')).toBeInTheDocument()
    })
  })

  describe('AddAliasInput Integration', () => {
    it('renders AddAliasInput component', () => {
      render(<AliasGroupSection {...defaultProps} />)
      expect(screen.getByTestId('add-alias-input')).toBeInTheDocument()
    })

    it('passes correct actionType to AddAliasInput', () => {
      render(<AliasGroupSection {...defaultProps} actionType="cancel" />)
      expect(screen.getByText('Add cancel')).toBeInTheDocument()
    })
  })

  describe('Action Type Labels', () => {
    const actionTypeCases = [
      { actionType: 'record', label: 'Record' },
      { actionType: 'cancel', label: 'Cancel' },
      { actionType: 'next_patient', label: 'Next Patient' },
      { actionType: 'surgeon_left', label: 'Surgeon Left' },
      { actionType: 'undo_last', label: 'Undo Last' },
      { actionType: 'confirm_pending', label: 'Confirm Pending' },
      { actionType: 'cancel_pending', label: 'Cancel Pending' },
    ]

    actionTypeCases.forEach(({ actionType, label }) => {
      it(`displays "${label}" for action type "${actionType}"`, () => {
        render(<AliasGroupSection {...defaultProps} actionType={actionType} />)
        expect(screen.getByText(label)).toBeInTheDocument()
      })
    })
  })

  describe('Visual Structure', () => {
    it('has correct section spacing', () => {
      const { container } = render(<AliasGroupSection {...defaultProps} />)
      const section = container.firstChild as HTMLElement
      expect(section).toHaveClass('mb-4')
    })

    it('renders header with uppercase styling', () => {
      render(<AliasGroupSection {...defaultProps} />)
      const header = screen.getByText('Record')
      expect(header).toHaveClass('uppercase', 'tracking-wider')
    })

    it('renders count badge with pill styling', () => {
      render(<AliasGroupSection {...defaultProps} />)
      const badge = screen.getByText('0')
      expect(badge).toHaveClass('rounded-full', 'bg-slate-100')
    })
  })

  describe('Multiple Aliases Workflow', () => {
    it('renders 10+ aliases without visual issues', () => {
      const aliases: VoiceCommandAlias[] = Array.from({ length: 15 }, (_, i) => ({
        id: `alias-${i}`,
        alias_phrase: `phrase ${i}`,
        action_type: 'record',
        milestone_type_id: 'milestone-1',
      })) as VoiceCommandAlias[]

      render(<AliasGroupSection {...defaultProps} aliases={aliases} />)
      expect(screen.getByText('15')).toBeInTheDocument()
      expect(screen.getAllByTestId(/^alias-row-/)).toHaveLength(15)
    })
  })
})
