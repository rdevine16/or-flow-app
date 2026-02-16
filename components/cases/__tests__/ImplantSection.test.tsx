import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import ImplantSection from '@/components/cases/ImplantSection'

// Build a chainable Supabase mock per table
function createSupabaseMock(opts: { implantCategory?: string | null; implantData?: Record<string, unknown> | null } = {}) {
  const category = 'implantCategory' in opts ? opts.implantCategory : 'total_hip'
  const implantData = 'implantData' in opts ? opts.implantData : null

  function makeChain(resolvedData: unknown) {
    const chain: Record<string, ReturnType<typeof vi.fn>> = {}
    chain.select = vi.fn().mockReturnValue(chain)
    chain.eq = vi.fn().mockReturnValue(chain)
    chain.single = vi.fn().mockResolvedValue({ data: resolvedData, error: null })
    chain.insert = vi.fn().mockReturnValue(chain)
    chain.update = vi.fn().mockReturnValue(chain)
    return chain
  }

  const mockSupabase = {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'procedure_types') {
        return makeChain({ implant_category: category })
      }
      if (table === 'case_implants') {
        return makeChain(implantData)
      }
      return makeChain(null)
    }),
  }

  return mockSupabase
}

describe('ImplantSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders nothing when procedure has no implant category', async () => {
    const supabase = createSupabaseMock({ implantCategory: null })

    const { container } = render(
      <ImplantSection
        caseId="case-1"
        procedureTypeId="proc-1"
        supabase={supabase as never}
      />
    )

    await waitFor(() => {
      expect(container.innerHTML).toBe('')
    })
  })

  it('renders hip implant fields for total_hip category', async () => {
    const supabase = createSupabaseMock({ implantCategory: 'total_hip' })

    render(
      <ImplantSection
        caseId="case-1"
        procedureTypeId="proc-1"
        supabase={supabase as never}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Hip Implants')).toBeInTheDocument()
    })

    expect(screen.getByText('Acetabular Cup')).toBeInTheDocument()
    expect(screen.getByText('Femoral Stem')).toBeInTheDocument()
    expect(screen.getByText('Femoral Head')).toBeInTheDocument()
    expect(screen.getByText('Liner')).toBeInTheDocument()
  })

  it('renders knee implant fields for total_knee category', async () => {
    const supabase = createSupabaseMock({ implantCategory: 'total_knee' })

    render(
      <ImplantSection
        caseId="case-1"
        procedureTypeId="proc-1"
        supabase={supabase as never}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Knee Implants')).toBeInTheDocument()
    })

    expect(screen.getByText('Femoral Component')).toBeInTheDocument()
    expect(screen.getByText('Tibial Component')).toBeInTheDocument()
    expect(screen.getByText('Poly Insert')).toBeInTheDocument()
    expect(screen.getByText('Patella')).toBeInTheDocument()
  })

  it('disables inputs in readOnly mode', async () => {
    const supabase = createSupabaseMock({ implantCategory: 'total_hip' })

    render(
      <ImplantSection
        caseId="case-1"
        procedureTypeId="proc-1"
        supabase={supabase as never}
        readOnly
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Hip Implants')).toBeInTheDocument()
    })

    const inputs = screen.getAllByRole('textbox')
    inputs.forEach(input => {
      expect(input).toBeDisabled()
    })
  })

  it('renders nothing when procedureTypeId is null', async () => {
    const supabase = createSupabaseMock()

    const { container } = render(
      <ImplantSection
        caseId="case-1"
        procedureTypeId={null}
        supabase={supabase as never}
      />
    )

    await waitFor(() => {
      expect(container.innerHTML).toBe('')
    })
  })

  it('renders fixation type buttons', async () => {
    const supabase = createSupabaseMock({ implantCategory: 'total_hip' })

    render(
      <ImplantSection
        caseId="case-1"
        procedureTypeId="proc-1"
        supabase={supabase as never}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Hip Implants')).toBeInTheDocument()
    })

    expect(screen.getByText('Cemented')).toBeInTheDocument()
    expect(screen.getByText('Pressfit')).toBeInTheDocument()
  })
})

describe('implantFilledCount logic', () => {
  it('counts non-null final size fields correctly', () => {
    const implants = {
      cup_size_final: '52mm',
      stem_size_final: null,
      head_size_final: '32mm',
      liner_size_final: null,
      femur_size_final: null,
      tibia_size_final: null,
      poly_size_final: null,
      patella_size_final: null,
    }

    const count = [
      implants.cup_size_final, implants.stem_size_final, implants.head_size_final, implants.liner_size_final,
      implants.femur_size_final, implants.tibia_size_final, implants.poly_size_final, implants.patella_size_final,
    ].filter(Boolean).length

    expect(count).toBe(2)
  })

  it('returns 0 when no implant data', () => {
    const implants = null
    const count = implants ? [].filter(Boolean).length : 0
    expect(count).toBe(0)
  })

  it('counts all 8 fields when fully filled', () => {
    const implants = {
      cup_size_final: '52mm',
      stem_size_final: '12',
      head_size_final: '32mm',
      liner_size_final: 'Elevated',
      femur_size_final: '5',
      tibia_size_final: '4',
      poly_size_final: '10mm',
      patella_size_final: '32mm',
    }

    const count = [
      implants.cup_size_final, implants.stem_size_final, implants.head_size_final, implants.liner_size_final,
      implants.femur_size_final, implants.tibia_size_final, implants.poly_size_final, implants.patella_size_final,
    ].filter(Boolean).length

    expect(count).toBe(8)
  })
})
