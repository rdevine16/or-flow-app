import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import CaseFlagsSection from '../CaseFlagsSection'

interface CaseFlagsSectionProps {
  caseId: string
  facilityId: string
  isCompleted: boolean
  userId: string
  supabase: unknown
}

// ============================================
// MOCKS
// ============================================

vi.mock('@/components/ui/Toast/ToastProvider', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}))

let mockShowConfirm = vi.fn()
let mockConfirmDialog: React.ReactNode = null
vi.mock('@/components/ui/ConfirmDialog', () => ({
  useConfirmDialog: () => ({
    confirmDialog: mockConfirmDialog,
    showConfirm: mockShowConfirm,
    isOpen: false,
    loading: false,
  }),
}))

vi.mock('@/lib/UserContext', () => ({
  useUser: () => ({
    can: () => true,
    canAny: () => true,
    canAll: () => true,
    permissionsLoading: false,
    userData: { accessLevel: 'facility_admin', userId: 'user-1', facilityId: 'fac-1' },
    loading: false,
    isGlobalAdmin: false,
    isAdmin: true,
    isImpersonating: false,
    effectiveFacilityId: 'fac-1',
  }),
}))

vi.mock('@/lib/formatters', () => ({
  formatElapsedMs: (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  },
}))

// ============================================
// SUPABASE MOCK
// ============================================

function createSupabaseMock() {
  const insertMock = vi.fn().mockResolvedValue({ data: null, error: null })

  const makeChain = (data: unknown) => {
    const chain: Record<string, (...args: unknown[]) => unknown> = {}
    chain.select = vi.fn().mockReturnValue(chain)
    chain.eq = vi.fn().mockReturnValue(chain)
    chain.or = vi.fn().mockReturnValue(chain)
    chain.order = vi.fn().mockResolvedValue({ data, error: null })
    chain.insert = insertMock
    return chain
  }

  const DELAY_TYPES = [
    { id: 'dt-1', name: 'waiting_for_surgeon', display_name: 'Waiting for Surgeon' },
    { id: 'dt-2', name: 'equipment_issue', display_name: 'Equipment Issue' },
  ]

  return {
    from: vi.fn((table: string) => {
      if (table === 'case_flags') return makeChain([])
      if (table === 'delay_types') return makeChain(DELAY_TYPES)
      if (table === 'case_delays') return makeChain([])
      return makeChain([])
    }),
    insertMock,
  }
}

// ============================================
// HELPERS
// ============================================

async function renderAndWaitForLoad(overrides: Partial<CaseFlagsSectionProps> = {}) {
  const { insertMock, ...supabase } = createSupabaseMock()
  const props = {
    caseId: 'case-1',
    facilityId: 'fac-1',
    isCompleted: false,
    userId: 'user-1',
    supabase,
    ...overrides,
  }
  const result = render(<CaseFlagsSection {...props} />)

  // Wait for loading to complete (supabase queries resolve)
  await waitFor(() => {
    expect(screen.getByText('Report Delay')).toBeDefined()
  })

  return { ...result, supabase, insertMock }
}

function openForm() {
  fireEvent.click(screen.getByText('Report Delay'))
}

function switchToTimer() {
  fireEvent.click(screen.getByText('Timer'))
}

function selectDelayType(id: string = 'dt-1') {
  fireEvent.change(screen.getByRole('combobox'), { target: { value: id } })
}

// ============================================
// UNIT TESTS: segmented control rendering
// ============================================

describe('CaseFlagsSection timer — unit: segmented control', () => {
  beforeEach(() => {
    mockShowConfirm = vi.fn()
    mockConfirmDialog = null
  })

  it('should show "Report Delay" button initially', async () => {
    await renderAndWaitForLoad()
    expect(screen.getByText('Report Delay')).toBeDefined()
  })

  it('should show Manual and Timer toggle buttons when form is open', async () => {
    await renderAndWaitForLoad()
    openForm()
    expect(screen.getByText('Manual')).toBeDefined()
    expect(screen.getByText('Timer')).toBeDefined()
  })

  it('should default to Manual mode with minutes input visible', async () => {
    await renderAndWaitForLoad()
    openForm()
    expect(screen.getByPlaceholderText('Min')).toBeDefined()
    expect(screen.queryByText('Start')).toBeNull()
  })

  it('should switch to Timer mode showing Start button', async () => {
    await renderAndWaitForLoad()
    openForm()
    switchToTimer()
    expect(screen.getByText('Start')).toBeDefined()
    expect(screen.queryByPlaceholderText('Min')).toBeNull()
  })

  it('should show 0:00:00 display when timer is idle', async () => {
    await renderAndWaitForLoad()
    openForm()
    switchToTimer()
    expect(screen.getByText('0:00:00')).toBeDefined()
  })

  it('should show Notes input in both modes', async () => {
    await renderAndWaitForLoad()
    openForm()
    // Manual mode
    expect(screen.getByPlaceholderText('Notes (optional)')).toBeDefined()

    // Timer mode
    switchToTimer()
    expect(screen.getByPlaceholderText('Notes (optional)')).toBeDefined()
  })
})

// ============================================
// UNIT TESTS: timer controls
// ============================================

describe('CaseFlagsSection timer — unit: timer controls', () => {
  beforeEach(() => {
    mockShowConfirm = vi.fn()
    mockConfirmDialog = null
  })

  it('should show Pause and Stop when timer is running', async () => {
    await renderAndWaitForLoad()
    openForm()
    switchToTimer()
    fireEvent.click(screen.getByText('Start'))

    expect(screen.getByText('Pause')).toBeDefined()
    expect(screen.getByText('Stop')).toBeDefined()
    expect(screen.queryByText('Start')).toBeNull()
  })

  it('should show Resume and Stop when timer is paused', async () => {
    await renderAndWaitForLoad()
    openForm()
    switchToTimer()
    fireEvent.click(screen.getByText('Start'))
    fireEvent.click(screen.getByText('Pause'))

    expect(screen.getByText('Resume')).toBeDefined()
    expect(screen.getByText('Stop')).toBeDefined()
    expect(screen.queryByText('Pause')).toBeNull()
    expect(screen.queryByText('Start')).toBeNull()
  })

  it('should show "Paused" label when timer is paused', async () => {
    await renderAndWaitForLoad()
    openForm()
    switchToTimer()
    fireEvent.click(screen.getByText('Start'))
    fireEvent.click(screen.getByText('Pause'))

    expect(screen.getByText('Paused')).toBeDefined()
  })

  it('should disable Save button while timer is running', async () => {
    await renderAndWaitForLoad()
    openForm()
    switchToTimer()
    fireEvent.click(screen.getByText('Start'))

    const saveBtn = screen.getByText('Save Delay').closest('button')
    expect(saveBtn?.disabled).toBe(true)
  })

  it('should disable Save button while timer is paused', async () => {
    await renderAndWaitForLoad()
    openForm()
    switchToTimer()
    fireEvent.click(screen.getByText('Start'))
    fireEvent.click(screen.getByText('Pause'))

    const saveBtn = screen.getByText('Save Delay').closest('button')
    expect(saveBtn?.disabled).toBe(true)
  })

  it('should disable Manual tab while timer is active', async () => {
    await renderAndWaitForLoad()
    openForm()
    switchToTimer()
    fireEvent.click(screen.getByText('Start'))

    const manualBtn = screen.getByText('Manual').closest('button')
    expect(manualBtn?.disabled).toBe(true)
  })

  it('should return to Start button after Stop', async () => {
    await renderAndWaitForLoad()
    openForm()
    switchToTimer()
    fireEvent.click(screen.getByText('Start'))
    fireEvent.click(screen.getByText('Stop'))

    expect(screen.getByText('Start')).toBeDefined()
    expect(screen.queryByText('Pause')).toBeNull()
    expect(screen.queryByText('Resume')).toBeNull()
  })

  it('should enable Save button after Stop (with delay type selected)', async () => {
    await renderAndWaitForLoad()
    openForm()
    selectDelayType()
    switchToTimer()
    fireEvent.click(screen.getByText('Start'))
    fireEvent.click(screen.getByText('Stop'))

    const saveBtn = screen.getByText('Save Delay').closest('button')
    expect(saveBtn?.disabled).toBe(false)
  })

  it('should re-enable Manual tab after Stop', async () => {
    await renderAndWaitForLoad()
    openForm()
    switchToTimer()
    fireEvent.click(screen.getByText('Start'))

    // Manual disabled while running
    expect(screen.getByText('Manual').closest('button')?.disabled).toBe(true)

    fireEvent.click(screen.getByText('Stop'))

    // Manual re-enabled after stop
    expect(screen.getByText('Manual').closest('button')?.disabled).toBe(false)
  })
})

// ============================================
// INTEGRATION: timer stop populates duration
// ============================================

describe('CaseFlagsSection timer — integration: stop populates duration', () => {
  beforeEach(() => {
    mockShowConfirm = vi.fn()
    mockConfirmDialog = null
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('should show computed duration after timer stop', async () => {
    const { ...supabase } = createSupabaseMock()
    const props = {
      caseId: 'case-1',
      facilityId: 'fac-1',
      isCompleted: false,
      userId: 'user-1',
      supabase,
    }
    await act(async () => {
      render(<CaseFlagsSection {...props} />)
    })
    await act(async () => { vi.advanceTimersByTime(10) })

    await act(async () => { fireEvent.click(screen.getByText('Report Delay')) })
    await act(async () => { fireEvent.click(screen.getByText('Timer')) })
    await act(async () => { fireEvent.click(screen.getByText('Start')) })

    await act(async () => { vi.advanceTimersByTime(300_000) })

    await act(async () => { fireEvent.click(screen.getByText('Stop')) })

    expect(screen.getByText('Duration: 5 min')).toBeDefined()
  })

  it('should accumulate only running time across pause/resume', async () => {
    const { ...supabase } = createSupabaseMock()
    const props = {
      caseId: 'case-1',
      facilityId: 'fac-1',
      isCompleted: false,
      userId: 'user-1',
      supabase,
    }
    await act(async () => {
      render(<CaseFlagsSection {...props} />)
    })
    await act(async () => { vi.advanceTimersByTime(10) })

    await act(async () => { fireEvent.click(screen.getByText('Report Delay')) })
    await act(async () => { fireEvent.click(screen.getByText('Timer')) })

    // Start → run 2 min
    await act(async () => { fireEvent.click(screen.getByText('Start')) })
    await act(async () => { vi.advanceTimersByTime(120_000) })

    // Pause → idle 1 min (doesn't count)
    await act(async () => { fireEvent.click(screen.getByText('Pause')) })
    await act(async () => { vi.advanceTimersByTime(60_000) })

    // Resume → run 1 min
    await act(async () => { fireEvent.click(screen.getByText('Resume')) })
    await act(async () => { vi.advanceTimersByTime(60_000) })

    // Stop
    await act(async () => { fireEvent.click(screen.getByText('Stop')) })

    // 2 + 1 = 3 minutes of running time
    expect(screen.getByText('Duration: 3 min')).toBeDefined()
  })

  it('should show minimum 1 min for very short timer', async () => {
    const { ...supabase } = createSupabaseMock()
    const props = {
      caseId: 'case-1',
      facilityId: 'fac-1',
      isCompleted: false,
      userId: 'user-1',
      supabase,
    }
    await act(async () => {
      render(<CaseFlagsSection {...props} />)
    })
    await act(async () => { vi.advanceTimersByTime(10) })

    await act(async () => { fireEvent.click(screen.getByText('Report Delay')) })
    await act(async () => { fireEvent.click(screen.getByText('Timer')) })
    await act(async () => { fireEvent.click(screen.getByText('Start')) })
    await act(async () => { vi.advanceTimersByTime(10_000) }) // 10 seconds
    await act(async () => { fireEvent.click(screen.getByText('Stop')) })

    expect(screen.getByText('Duration: 1 min')).toBeDefined()
  })
})

// ============================================
// INTEGRATION: close warning
// ============================================

describe('CaseFlagsSection timer — integration: close warning', () => {
  beforeEach(() => {
    mockShowConfirm = vi.fn()
    mockConfirmDialog = null
  })

  it('should call showConfirm when closing with active timer', async () => {
    await renderAndWaitForLoad()
    openForm()
    switchToTimer()
    fireEvent.click(screen.getByText('Start'))

    // Click X to close
    const formHeader = screen.getByText('Report a Delay').parentElement!
    const xButton = formHeader.querySelector('button')!
    fireEvent.click(xButton)

    expect(mockShowConfirm).toHaveBeenCalledTimes(1)
    expect(mockShowConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'warning',
        title: 'Timer is running',
        confirmText: 'Discard',
        cancelText: 'Keep timing',
      })
    )
  })

  it('should call showConfirm when closing with paused timer', async () => {
    await renderAndWaitForLoad()
    openForm()
    switchToTimer()
    fireEvent.click(screen.getByText('Start'))
    fireEvent.click(screen.getByText('Pause'))

    const formHeader = screen.getByText('Report a Delay').parentElement!
    const xButton = formHeader.querySelector('button')!
    fireEvent.click(xButton)

    expect(mockShowConfirm).toHaveBeenCalledTimes(1)
  })

  it('should close directly without warning when timer is idle', async () => {
    await renderAndWaitForLoad()
    openForm()

    const formHeader = screen.getByText('Report a Delay').parentElement!
    const xButton = formHeader.querySelector('button')!
    fireEvent.click(xButton)

    expect(mockShowConfirm).not.toHaveBeenCalled()
    expect(screen.getByText('Report Delay')).toBeDefined()
    expect(screen.queryByText('Report a Delay')).toBeNull()
  })

  it('should close directly after timer is stopped (idle again)', async () => {
    await renderAndWaitForLoad()
    openForm()
    switchToTimer()
    fireEvent.click(screen.getByText('Start'))
    fireEvent.click(screen.getByText('Stop'))

    const formHeader = screen.getByText('Report a Delay').parentElement!
    const xButton = formHeader.querySelector('button')!
    fireEvent.click(xButton)

    expect(mockShowConfirm).not.toHaveBeenCalled()
    expect(screen.getByText('Report Delay')).toBeDefined()
  })

  it('should reset timer when confirm callback is invoked', async () => {
    await renderAndWaitForLoad()
    openForm()
    switchToTimer()
    fireEvent.click(screen.getByText('Start'))

    const formHeader = screen.getByText('Report a Delay').parentElement!
    const xButton = formHeader.querySelector('button')!
    fireEvent.click(xButton)

    // Extract onConfirm and call it
    const onConfirm = mockShowConfirm.mock.calls[0][0].onConfirm
    act(() => { onConfirm() })

    expect(screen.getByText('Report Delay')).toBeDefined()
    expect(screen.queryByText('Report a Delay')).toBeNull()
  })
})

// ============================================
// WORKFLOW: full delay report flows
// ============================================

describe('CaseFlagsSection timer — workflow', () => {
  beforeEach(() => {
    mockShowConfirm = vi.fn()
    mockConfirmDialog = null
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('should complete timer flow: type → start → pause → resume → stop → save', async () => {
    const { ...supabase } = createSupabaseMock()
    const props = {
      caseId: 'case-1',
      facilityId: 'fac-1',
      isCompleted: false,
      userId: 'user-1',
      supabase,
    }
    await act(async () => { render(<CaseFlagsSection {...props} />) })
    await act(async () => { vi.advanceTimersByTime(10) })

    await act(async () => { fireEvent.click(screen.getByText('Report Delay')) })
    await act(async () => {
      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'dt-1' } })
    })
    await act(async () => { fireEvent.click(screen.getByText('Timer')) })

    // Start → 3 min → pause → 1 min idle → resume → 2 min → stop
    await act(async () => { fireEvent.click(screen.getByText('Start')) })
    expect(screen.getByText('Pause')).toBeDefined()
    await act(async () => { vi.advanceTimersByTime(180_000) })

    await act(async () => { fireEvent.click(screen.getByText('Pause')) })
    expect(screen.getByText('Paused')).toBeDefined()
    await act(async () => { vi.advanceTimersByTime(60_000) })

    await act(async () => { fireEvent.click(screen.getByText('Resume')) })
    await act(async () => { vi.advanceTimersByTime(120_000) })

    await act(async () => { fireEvent.click(screen.getByText('Stop')) })
    expect(screen.getByText('Duration: 5 min')).toBeDefined()

    await act(async () => { fireEvent.click(screen.getByText('Save Delay')) })

    expect(supabase.from).toHaveBeenCalledWith('case_flags')
    expect(supabase.from).toHaveBeenCalledWith('case_delays')
  })

  it('should complete manual flow: type → duration → note → save', async () => {
    const { ...supabase } = createSupabaseMock()
    const props = {
      caseId: 'case-1',
      facilityId: 'fac-1',
      isCompleted: false,
      userId: 'user-1',
      supabase,
    }
    await act(async () => { render(<CaseFlagsSection {...props} />) })
    await act(async () => { vi.advanceTimersByTime(10) })

    await act(async () => { fireEvent.click(screen.getByText('Report Delay')) })
    await act(async () => {
      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'dt-2' } })
    })
    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText('Min'), { target: { value: '15' } })
    })
    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText('Notes (optional)'), { target: { value: 'Equipment malfunction' } })
    })
    await act(async () => { fireEvent.click(screen.getByText('Save Delay')) })

    expect(supabase.from).toHaveBeenCalledWith('case_flags')
    expect(supabase.from).toHaveBeenCalledWith('case_delays')
  })

  it('should reset form completely after save and re-open in default state', async () => {
    const { ...supabase } = createSupabaseMock()
    const props = {
      caseId: 'case-1',
      facilityId: 'fac-1',
      isCompleted: false,
      userId: 'user-1',
      supabase,
    }
    await act(async () => { render(<CaseFlagsSection {...props} />) })
    await act(async () => { vi.advanceTimersByTime(10) })

    await act(async () => { fireEvent.click(screen.getByText('Report Delay')) })
    await act(async () => {
      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'dt-1' } })
    })
    await act(async () => { fireEvent.click(screen.getByText('Timer')) })
    await act(async () => { fireEvent.click(screen.getByText('Start')) })
    await act(async () => { vi.advanceTimersByTime(60_000) })
    await act(async () => { fireEvent.click(screen.getByText('Stop')) })
    await act(async () => { fireEvent.click(screen.getByText('Save Delay')) })
    await act(async () => { vi.advanceTimersByTime(10) })

    expect(screen.getByText('Report Delay')).toBeDefined()

    await act(async () => { fireEvent.click(screen.getByText('Report Delay')) })
    expect(screen.getByPlaceholderText('Min')).toBeDefined()
    expect(screen.queryByText('Start')).toBeNull()
  })
})
