import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AliasRow } from '../AliasRow'
import type { VoiceCommandAlias } from '@/lib/dal/voice-commands'

describe('AliasRow', () => {
  const mockOnDelete = vi.fn()

  const baseAlias: VoiceCommandAlias = {
    id: 'alias-1',
    facility_id: 'facility-1',
    milestone_type_id: 'milestone-1',
    facility_milestone_id: null,
    alias_phrase: 'start the case',
    source_alias_id: null,
    is_active: true,
    deleted_at: null,
    created_at: '2026-03-01T10:00:00Z',
    updated_at: '2026-03-01T10:00:00Z',
    action_type: 'record',
    auto_learned: false,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('displays the alias phrase', () => {
      render(<AliasRow alias={baseAlias} onDelete={mockOnDelete} />)
      expect(screen.getByText('start the case')).toBeInTheDocument()
    })

    it('shows AI Learned badge for auto-learned aliases', () => {
      const learnedAlias = { ...baseAlias, auto_learned: true }
      render(<AliasRow alias={learnedAlias} onDelete={mockOnDelete} />)
      expect(screen.getByText('AI Learned')).toBeInTheDocument()
    })

    it('does not show AI Learned badge for manual aliases', () => {
      render(<AliasRow alias={baseAlias} onDelete={mockOnDelete} />)
      expect(screen.queryByText('AI Learned')).not.toBeInTheDocument()
    })

    it('initially hides delete button', () => {
      render(<AliasRow alias={baseAlias} onDelete={mockOnDelete} />)
      const deleteButton = screen.getByLabelText('Delete alias "start the case"')
      expect(deleteButton).toHaveClass('opacity-0')
    })
  })

  describe('Delete Confirmation Flow', () => {
    it('shows confirm/cancel buttons when delete is clicked', async () => {
      const user = userEvent.setup()
      render(<AliasRow alias={baseAlias} onDelete={mockOnDelete} />)

      const deleteButton = screen.getByLabelText('Delete alias "start the case"')
      await user.click(deleteButton)

      expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
    })

    it('hides delete button when confirm prompt is shown', async () => {
      const user = userEvent.setup()
      render(<AliasRow alias={baseAlias} onDelete={mockOnDelete} />)

      const deleteButton = screen.getByLabelText('Delete alias "start the case"')
      await user.click(deleteButton)

      expect(screen.queryByLabelText('Delete alias "start the case"')).not.toBeInTheDocument()
    })

    it('cancels delete and returns to initial state', async () => {
      const user = userEvent.setup()
      render(<AliasRow alias={baseAlias} onDelete={mockOnDelete} />)

      const deleteButton = screen.getByLabelText('Delete alias "start the case"')
      await user.click(deleteButton)

      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      await user.click(cancelButton)

      expect(screen.queryByRole('button', { name: /confirm/i })).not.toBeInTheDocument()
      expect(screen.getByLabelText('Delete alias "start the case"')).toBeInTheDocument()
      expect(mockOnDelete).not.toHaveBeenCalled()
    })

    it('calls onDelete when confirm is clicked', async () => {
      const user = userEvent.setup()
      mockOnDelete.mockResolvedValue(undefined)

      render(<AliasRow alias={baseAlias} onDelete={mockOnDelete} />)

      const deleteButton = screen.getByLabelText('Delete alias "start the case"')
      await user.click(deleteButton)

      const confirmButton = screen.getByRole('button', { name: /confirm/i })
      await user.click(confirmButton)

      await waitFor(() => {
        expect(mockOnDelete).toHaveBeenCalledWith('alias-1')
      })
    })

    it('disables confirm button while delete is in progress', async () => {
      const user = userEvent.setup()
      let resolveDelete: any
      const deletePromise = new Promise((resolve) => { resolveDelete = resolve })
      mockOnDelete.mockReturnValue(deletePromise)

      render(<AliasRow alias={baseAlias} onDelete={mockOnDelete} />)

      const deleteButton = screen.getByLabelText('Delete alias "start the case"')
      await user.click(deleteButton)

      const confirmButton = screen.getByRole('button', { name: /confirm/i })
      await user.click(confirmButton)

      expect(confirmButton).toBeDisabled()
      expect(confirmButton).toHaveTextContent('...')

      resolveDelete()
      await waitFor(() => {
        expect(confirmButton).not.toBeInTheDocument()
      })
    })

    it('closes confirmation prompt after successful delete', async () => {
      const user = userEvent.setup()
      mockOnDelete.mockResolvedValue(undefined)

      render(<AliasRow alias={baseAlias} onDelete={mockOnDelete} />)

      const deleteButton = screen.getByLabelText('Delete alias "start the case"')
      await user.click(deleteButton)

      const confirmButton = screen.getByRole('button', { name: /confirm/i })
      await user.click(confirmButton)

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /confirm/i })).not.toBeInTheDocument()
      })
    })
  })

  describe('Hover Behavior', () => {
    it('applies group-hover class to reveal delete button on hover', () => {
      render(<AliasRow alias={baseAlias} onDelete={mockOnDelete} />)
      const container = screen.getByText('start the case').closest('div')
      expect(container).toHaveClass('group')
    })

    it('delete button has group-hover:opacity-100 class', () => {
      render(<AliasRow alias={baseAlias} onDelete={mockOnDelete} />)
      const deleteButton = screen.getByLabelText('Delete alias "start the case"')
      expect(deleteButton).toHaveClass('group-hover:opacity-100')
    })
  })

  describe('Visual States', () => {
    it('renders with correct styles for normal state', () => {
      render(<AliasRow alias={baseAlias} onDelete={mockOnDelete} />)
      const container = screen.getByText('start the case').closest('div')
      expect(container).toHaveClass('hover:bg-white', 'transition-colors')
    })

    it('renders AI Learned badge with purple styling', () => {
      const learnedAlias = { ...baseAlias, auto_learned: true }
      render(<AliasRow alias={learnedAlias} onDelete={mockOnDelete} />)
      const badge = screen.getByText('AI Learned')
      expect(badge).toHaveClass('bg-purple-50', 'text-purple-600', 'border-purple-200')
    })

    it('renders confirm button with red styling', async () => {
      const user = userEvent.setup()
      render(<AliasRow alias={baseAlias} onDelete={mockOnDelete} />)

      const deleteButton = screen.getByLabelText('Delete alias "start the case"')
      await user.click(deleteButton)

      const confirmButton = screen.getByRole('button', { name: /confirm/i })
      expect(confirmButton).toHaveClass('bg-red-50', 'text-red-600', 'hover:bg-red-100')
    })
  })

  describe('Permission Gating (readOnly)', () => {
    it('hides delete button when readOnly is true', () => {
      render(<AliasRow alias={baseAlias} onDelete={mockOnDelete} readOnly={true} />)
      expect(screen.queryByLabelText('Delete alias "start the case"')).not.toBeInTheDocument()
    })

    it('shows delete button when readOnly is false', () => {
      render(<AliasRow alias={baseAlias} onDelete={mockOnDelete} readOnly={false} />)
      expect(screen.getByLabelText('Delete alias "start the case"')).toBeInTheDocument()
    })

    it('still shows alias phrase and AI Learned badge in read-only mode', () => {
      const learnedAlias = { ...baseAlias, auto_learned: true }
      render(<AliasRow alias={learnedAlias} onDelete={mockOnDelete} readOnly={true} />)
      expect(screen.getByText('start the case')).toBeInTheDocument()
      expect(screen.getByText('AI Learned')).toBeInTheDocument()
    })

    it('defaults readOnly to false (shows delete button)', () => {
      render(<AliasRow alias={baseAlias} onDelete={mockOnDelete} />)
      expect(screen.getByLabelText('Delete alias "start the case"')).toBeInTheDocument()
    })
  })

  describe('Global Command Protection', () => {
    const globalAlias: VoiceCommandAlias = {
      ...baseAlias,
      source_alias_id: 'global-template-1',
    }

    it('shows Global tag when alias has source_alias_id', () => {
      render(<AliasRow alias={globalAlias} onDelete={mockOnDelete} />)
      expect(screen.getByText('Global')).toBeInTheDocument()
    })

    it('does not show Global tag for local aliases', () => {
      render(<AliasRow alias={baseAlias} onDelete={mockOnDelete} />)
      expect(screen.queryByText('Global')).not.toBeInTheDocument()
    })

    it('hides delete button for global aliases even when not readOnly', () => {
      render(<AliasRow alias={globalAlias} onDelete={mockOnDelete} readOnly={false} />)
      expect(screen.queryByLabelText('Delete alias "start the case"')).not.toBeInTheDocument()
    })

    it('renders Global tag with blue styling', () => {
      render(<AliasRow alias={globalAlias} onDelete={mockOnDelete} />)
      const badge = screen.getByText('Global')
      expect(badge).toHaveClass('bg-blue-50', 'text-blue-600', 'border-blue-200')
    })
  })

  describe('Multiple Delete Attempts', () => {
    it('handles rapid delete → cancel → delete clicks', async () => {
      const user = userEvent.setup()
      render(<AliasRow alias={baseAlias} onDelete={mockOnDelete} />)

      const deleteButton = screen.getByLabelText('Delete alias "start the case"')

      // First delete attempt
      await user.click(deleteButton)
      expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument()

      // Cancel
      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      await user.click(cancelButton)

      // Second delete attempt
      const deleteButton2 = screen.getByLabelText('Delete alias "start the case"')
      await user.click(deleteButton2)
      expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument()
    })
  })
})
