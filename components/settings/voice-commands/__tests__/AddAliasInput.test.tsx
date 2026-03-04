import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AddAliasInput } from '../AddAliasInput'
import { voiceCommandsDAL } from '@/lib/dal/voice-commands'

// Mock dependencies
vi.mock('@/lib/supabase', () => ({
  createClient: vi.fn(() => ({})),
}))

vi.mock('@/lib/dal/voice-commands', () => ({
  voiceCommandsDAL: {
    checkDuplicate: vi.fn(),
    addAlias: vi.fn(),
  },
}))

vi.mock('@/components/ui/Toast/ToastProvider', () => ({
  useToast: vi.fn(() => ({
    showToast: vi.fn(),
  })),
}))

describe('AddAliasInput', () => {
  const mockOnAdded = vi.fn()
  const defaultProps = {
    actionType: 'record',
    milestoneTypeId: 'milestone-1',
    facilityId: 'facility-1',
    onAdded: mockOnAdded,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('renders input field and add button', () => {
      render(<AddAliasInput {...defaultProps} />)
      expect(screen.getByPlaceholderText('Add voice phrase...')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /add/i })).toBeInTheDocument()
    })

    it('disables add button when input is empty', () => {
      render(<AddAliasInput {...defaultProps} />)
      const addButton = screen.getByRole('button', { name: /add/i })
      expect(addButton).toBeDisabled()
    })

    it('enables add button when input has text', async () => {
      const user = userEvent.setup()
      render(<AddAliasInput {...defaultProps} />)

      const input = screen.getByPlaceholderText('Add voice phrase...')
      await user.type(input, 'test phrase')

      const addButton = screen.getByRole('button', { name: /add/i })
      expect(addButton).not.toBeDisabled()
    })
  })

  describe('Duplicate Detection', () => {
    it('shows warning toast when duplicate phrase is detected', async () => {
      const user = userEvent.setup()
      const mockShowToast = vi.fn()
      vi.mocked(voiceCommandsDAL.checkDuplicate).mockResolvedValue({
        data: {
          id: 'existing-1',
          alias_phrase: 'test phrase',
          action_type: 'record',
          milestone_type_id: 'milestone-1',
        } as VoiceCommandAlias,
        error: null,
      })

      const { useToast } = await import('@/components/ui/Toast/ToastProvider')
      vi.mocked(useToast).mockReturnValue({ showToast: mockShowToast })

      render(<AddAliasInput {...defaultProps} />)

      const input = screen.getByPlaceholderText('Add voice phrase...')
      await user.type(input, 'test phrase')

      const addButton = screen.getByRole('button', { name: /add/i })
      await user.click(addButton)

      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalledWith({
          type: 'warning',
          title: 'Duplicate phrase',
          message: expect.stringContaining('"test phrase"'),
        })
      })
    })

    it('calls checkDuplicate with correct parameters', async () => {
      const user = userEvent.setup()
      vi.mocked(voiceCommandsDAL.checkDuplicate).mockResolvedValue({ data: null, error: null })
      vi.mocked(voiceCommandsDAL.addAlias).mockResolvedValue({ data: {} as VoiceCommandAlias, error: null })

      render(<AddAliasInput {...defaultProps} />)

      const input = screen.getByPlaceholderText('Add voice phrase...')
      await user.type(input, 'test phrase')

      const addButton = screen.getByRole('button', { name: /add/i })
      await user.click(addButton)

      await waitFor(() => {
        expect(voiceCommandsDAL.checkDuplicate).toHaveBeenCalledWith(
          expect.anything(),
          'test phrase',
          'record',
          'facility-1'
        )
      })
    })
  })

  describe('Add Alias Success', () => {
    it('calls addAlias with correct parameters', async () => {
      const user = userEvent.setup()
      vi.mocked(voiceCommandsDAL.checkDuplicate).mockResolvedValue({ data: null, error: null })
      vi.mocked(voiceCommandsDAL.addAlias).mockResolvedValue({ data: {} as VoiceCommandAlias, error: null })

      render(<AddAliasInput {...defaultProps} />)

      const input = screen.getByPlaceholderText('Add voice phrase...')
      await user.type(input, 'new phrase')

      const addButton = screen.getByRole('button', { name: /add/i })
      await user.click(addButton)

      await waitFor(() => {
        expect(voiceCommandsDAL.addAlias).toHaveBeenCalledWith(
          expect.anything(),
          {
            facility_id: 'facility-1',
            milestone_type_id: 'milestone-1',
            facility_milestone_id: null,
            alias_phrase: 'new phrase',
            action_type: 'record',
          }
        )
      })
    })

    it('clears input and calls onAdded after successful add', async () => {
      const user = userEvent.setup()
      const mockShowToast = vi.fn()
      vi.mocked(voiceCommandsDAL.checkDuplicate).mockResolvedValue({ data: null, error: null })
      vi.mocked(voiceCommandsDAL.addAlias).mockResolvedValue({ data: {} as VoiceCommandAlias, error: null })

      const { useToast } = await import('@/components/ui/Toast/ToastProvider')
      vi.mocked(useToast).mockReturnValue({ showToast: mockShowToast })

      render(<AddAliasInput {...defaultProps} />)

      const input = screen.getByPlaceholderText('Add voice phrase...')
      await user.type(input, 'new phrase')

      const addButton = screen.getByRole('button', { name: /add/i })
      await user.click(addButton)

      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalledWith({
          type: 'success',
          title: 'Alias added',
        })
        expect(mockOnAdded).toHaveBeenCalled()
        expect(input).toHaveValue('')
      })
    })

    it('trims whitespace from input before adding', async () => {
      const user = userEvent.setup()
      vi.mocked(voiceCommandsDAL.checkDuplicate).mockResolvedValue({ data: null, error: null })
      vi.mocked(voiceCommandsDAL.addAlias).mockResolvedValue({ data: {} as VoiceCommandAlias, error: null })

      render(<AddAliasInput {...defaultProps} />)

      const input = screen.getByPlaceholderText('Add voice phrase...')
      await user.type(input, '  trimmed phrase  ')

      const addButton = screen.getByRole('button', { name: /add/i })
      await user.click(addButton)

      await waitFor(() => {
        expect(voiceCommandsDAL.addAlias).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            alias_phrase: 'trimmed phrase',
          })
        )
      })
    })
  })

  describe('Error Handling', () => {
    it('shows error toast when checkDuplicate fails', async () => {
      const user = userEvent.setup()
      const mockShowToast = vi.fn()
      vi.mocked(voiceCommandsDAL.checkDuplicate).mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      })

      const { useToast } = await import('@/components/ui/Toast/ToastProvider')
      vi.mocked(useToast).mockReturnValue({ showToast: mockShowToast })

      render(<AddAliasInput {...defaultProps} />)

      const input = screen.getByPlaceholderText('Add voice phrase...')
      await user.type(input, 'test phrase')

      const addButton = screen.getByRole('button', { name: /add/i })
      await user.click(addButton)

      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalledWith({
          type: 'error',
          title: 'Failed to check duplicates',
          message: 'Database error',
        })
      })
    })

    it('shows error toast when addAlias fails', async () => {
      const user = userEvent.setup()
      const mockShowToast = vi.fn()
      vi.mocked(voiceCommandsDAL.checkDuplicate).mockResolvedValue({ data: null, error: null })
      vi.mocked(voiceCommandsDAL.addAlias).mockResolvedValue({
        data: null,
        error: { message: 'Insert failed' },
      })

      const { useToast } = await import('@/components/ui/Toast/ToastProvider')
      vi.mocked(useToast).mockReturnValue({ showToast: mockShowToast })

      render(<AddAliasInput {...defaultProps} />)

      const input = screen.getByPlaceholderText('Add voice phrase...')
      await user.type(input, 'test phrase')

      const addButton = screen.getByRole('button', { name: /add/i })
      await user.click(addButton)

      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalledWith({
          type: 'error',
          title: 'Failed to add alias',
          message: 'Insert failed',
        })
      })
    })
  })

  describe('Keyboard Interaction', () => {
    it('submits alias when Enter is pressed', async () => {
      const user = userEvent.setup()
      vi.mocked(voiceCommandsDAL.checkDuplicate).mockResolvedValue({ data: null, error: null })
      vi.mocked(voiceCommandsDAL.addAlias).mockResolvedValue({ data: {} as VoiceCommandAlias, error: null })

      render(<AddAliasInput {...defaultProps} />)

      const input = screen.getByPlaceholderText('Add voice phrase...')
      await user.type(input, 'keyboard entry{Enter}')

      await waitFor(() => {
        expect(voiceCommandsDAL.addAlias).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            alias_phrase: 'keyboard entry',
          })
        )
      })
    })

    it('clears input when Escape is pressed', async () => {
      const user = userEvent.setup()
      render(<AddAliasInput {...defaultProps} />)

      const input = screen.getByPlaceholderText('Add voice phrase...')
      await user.type(input, 'test phrase')
      expect(input).toHaveValue('test phrase')

      await user.type(input, '{Escape}')
      expect(input).toHaveValue('')
    })
  })

  describe('Loading States', () => {
    it('disables input and button while saving', async () => {
      const user = userEvent.setup()
      let resolveAdd: any
      const addPromise = new Promise((resolve) => { resolveAdd = resolve })

      vi.mocked(voiceCommandsDAL.checkDuplicate).mockResolvedValue({ data: null, error: null })
      vi.mocked(voiceCommandsDAL.addAlias).mockReturnValue(addPromise as any)

      render(<AddAliasInput {...defaultProps} />)

      const input = screen.getByPlaceholderText('Add voice phrase...')
      await user.type(input, 'test phrase')

      const addButton = screen.getByRole('button', { name: /add/i })
      await user.click(addButton)

      // Should be disabled during save
      expect(input).toBeDisabled()
      expect(addButton).toBeDisabled()

      // Resolve and verify re-enabled
      resolveAdd({ data: {} as VoiceCommandAlias, error: null })
      await waitFor(() => {
        expect(input).not.toBeDisabled()
      })
    })

    it('shows spinner icon while saving', async () => {
      const user = userEvent.setup()
      let resolveAdd: any
      const addPromise = new Promise((resolve) => { resolveAdd = resolve })

      vi.mocked(voiceCommandsDAL.checkDuplicate).mockResolvedValue({ data: null, error: null })
      vi.mocked(voiceCommandsDAL.addAlias).mockReturnValue(addPromise as any)

      render(<AddAliasInput {...defaultProps} />)

      const input = screen.getByPlaceholderText('Add voice phrase...')
      await user.type(input, 'test phrase')

      const addButton = screen.getByRole('button', { name: /add/i })
      await user.click(addButton)

      // Should show spinner (Loader2 icon has animate-spin class)
      await waitFor(() => {
        const spinnerElement = addButton.querySelector('.animate-spin')
        expect(spinnerElement).toBeInTheDocument()
      })

      resolveAdd({ data: {} as VoiceCommandAlias, error: null })
    })
  })

  describe('Null Facility ID (Global Templates)', () => {
    it('passes null facility_id to DAL for global templates', async () => {
      const user = userEvent.setup()
      vi.mocked(voiceCommandsDAL.checkDuplicate).mockResolvedValue({ data: null, error: null })
      vi.mocked(voiceCommandsDAL.addAlias).mockResolvedValue({ data: {} as VoiceCommandAlias, error: null })

      render(<AddAliasInput {...defaultProps} facilityId={null} />)

      const input = screen.getByPlaceholderText('Add voice phrase...')
      await user.type(input, 'global phrase')

      const addButton = screen.getByRole('button', { name: /add/i })
      await user.click(addButton)

      await waitFor(() => {
        expect(voiceCommandsDAL.addAlias).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            facility_id: null,
          })
        )
      })
    })
  })
})
