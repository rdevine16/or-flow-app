import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import CaseDrawerFinancials from '../CaseDrawerFinancials'
import type {
  CaseFinancialData,
  MarginRating,
  CostBreakdownItem,
  FullDaySurgeonForecast,
  DataQuality,
  FinancialHeroMetrics,
} from '@/lib/utils/financialAnalytics'
import type { FinancialComparison, FinancialProjection } from '@/lib/financials'

// ============================================
// FIXTURES
// ============================================

function makeHero(overrides: Partial<FinancialHeroMetrics> = {}): FinancialHeroMetrics {
  return {
    margin_percentage: 58,
    surgeon_margin_rating: 'excellent' as MarginRating,
    facility_margin_rating: 'good' as MarginRating,
    profit: 2900,
    revenue: 5000,
    total_costs: 2100,
    surgeon_median_margin: 55,
    facility_median_margin: 50,
    surgeon_case_count: 25,
    facility_case_count: 100,
    ...overrides,
  }
}

function makeCostBreakdown(): CostBreakdownItem[] {
  return [
    { category: 'OR Time', amount: 1500, percentage_of_total: 65, source: 'projected' as const },
    { category: 'Soft Goods', amount: 500, percentage_of_total: 22, source: 'projected' as const },
    { category: 'Hard Goods', amount: 300, percentage_of_total: 13, source: 'projected' as const },
    { category: 'Credits', amount: -200, percentage_of_total: 0, source: 'projected' as const },
  ]
}

function makeComparison(): FinancialComparison {
  return {
    lineItems: [
      { label: 'Revenue', projected: 5000, actual: 5200, delta: 200, isRevenue: true },
      { label: 'OR Time Cost', projected: 1500, actual: 1600, delta: 100, isRevenue: false },
      { label: 'Supply Costs (Debits)', projected: 800, actual: 750, delta: -50, isRevenue: false },
      { label: 'Credits', projected: 200, actual: 250, delta: 50, isRevenue: true },
    ],
    projectedProfit: 2900,
    actualProfit: 3100,
    profitDelta: 200,
    projectedMargin: 58,
    actualMargin: 59.6,
  }
}

function makeForecast(): FullDaySurgeonForecast {
  return {
    surgeon_name: 'Dr. James Wilson',
    surgeon_id: 'surgeon-1',
    cases: [
      { case_id: 'c1', case_number: 'CASE-001', procedure_name: 'TKA', status: 'completed', revenue: 5000, total_costs: 2000, profit: 3000, margin_pct: 60 },
      { case_id: 'c2', case_number: 'CASE-002', procedure_name: 'THA', status: 'scheduled', revenue: null, total_costs: null, profit: null, margin_pct: null },
      { case_id: 'c3', case_number: 'CASE-003', procedure_name: 'ACL Repair', status: 'in_progress', revenue: 4000, total_costs: 1800, profit: 2200, margin_pct: 55 },
    ],
    total_revenue: 9000,
    total_costs: 3800,
    total_profit: 5200,
    total_margin: 57.8,
  }
}

function makeDataQuality(overrides: Partial<DataQuality> = {}): DataQuality {
  return {
    has_costs: true,
    has_revenue: true,
    cost_source: 'projected' as const,
    confidence: 'medium' as const,
    ...overrides,
  }
}

function makeProjection(overrides: Partial<FinancialProjection> = {}): FinancialProjection {
  return {
    revenue: 5000,
    revenueSource: 'Procedure default',
    orCost: 1500,
    projectedDuration: 90,
    durationSource: "Based on Dr. Wilson's median of 90 min",
    supplyDebits: 800,
    supplyCredits: 200,
    profit: 2900,
    marginPercent: 58,
    costItemBreakdown: [],
    hasData: true,
    ...overrides,
  }
}

function makeFullData(overrides: Partial<CaseFinancialData> = {}): CaseFinancialData {
  return {
    hero: makeHero(),
    cost_breakdown: makeCostBreakdown(),
    projected_vs_actual: makeComparison(),
    full_day_forecast: makeForecast(),
    data_quality: makeDataQuality(),
    projection: makeProjection(),
    actual: null,
    ...overrides,
  }
}

// ============================================
// TEST MATRIX: Financials Tab
// ============================================

describe('CaseDrawerFinancials — completed + validated with full data', () => {
  it('renders hero row with two margin gauges', () => {
    render(
      <CaseDrawerFinancials
        data={makeFullData()}
        displayStatus="completed"
        surgeonName="Dr. James Wilson"
        loading={false}
        error={null}
      />
    )
    // Two gauges with aria-labels
    const gauges = screen.getAllByRole('img')
    expect(gauges.length).toBeGreaterThanOrEqual(2)
    // At least one should mention "Margin"
    const marginGauges = gauges.filter(g => g.getAttribute('aria-label')?.includes('Margin'))
    expect(marginGauges.length).toBeGreaterThanOrEqual(2)
  })

  it('renders profit badge', () => {
    render(
      <CaseDrawerFinancials
        data={makeFullData()}
        displayStatus="completed"
        surgeonName="Dr. James Wilson"
        loading={false}
        error={null}
      />
    )
    expect(screen.getByText('EXCELLENT')).toBeDefined()
  })

  it('renders projected vs actual table with line items', () => {
    render(
      <CaseDrawerFinancials
        data={makeFullData()}
        displayStatus="completed"
        surgeonName="Dr. James Wilson"
        loading={false}
        error={null}
      />
    )
    expect(screen.getByText('Projected vs Actual')).toBeDefined()
    // "Revenue" and "Profit" appear in both hero row and table — use getAllByText
    expect(screen.getAllByText('Revenue').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('OR Time Cost')).toBeDefined()
    expect(screen.getAllByText('Profit').length).toBeGreaterThanOrEqual(1)
  })

  it('renders cost breakdown table with categories', () => {
    render(
      <CaseDrawerFinancials
        data={makeFullData()}
        displayStatus="completed"
        surgeonName="Dr. James Wilson"
        loading={false}
        error={null}
      />
    )
    expect(screen.getByText('Cost Breakdown')).toBeDefined()
    expect(screen.getByText('OR Time')).toBeDefined()
    expect(screen.getByText('Soft Goods')).toBeDefined()
    expect(screen.getByText('Total Costs')).toBeDefined()
  })

  it('renders full day forecast section (collapsed by default)', () => {
    render(
      <CaseDrawerFinancials
        data={makeFullData()}
        displayStatus="completed"
        surgeonName="Dr. James Wilson"
        loading={false}
        error={null}
      />
    )
    expect(screen.getByText('Full Day Forecast')).toBeDefined()
    // Toggle button should show aria-expanded=false
    const toggleBtn = screen.getByRole('button', { name: /Full Day Forecast/ })
    expect(toggleBtn.getAttribute('aria-expanded')).toBe('false')
  })

  it('expands full day forecast when clicked', () => {
    render(
      <CaseDrawerFinancials
        data={makeFullData()}
        displayStatus="completed"
        surgeonName="Dr. James Wilson"
        loading={false}
        error={null}
      />
    )
    const toggleBtn = screen.getByRole('button', { name: /Full Day Forecast/ })
    fireEvent.click(toggleBtn)
    // After expanding, case numbers should be visible
    expect(screen.getByText('CASE-001')).toBeDefined()
    expect(screen.getByText('CASE-002')).toBeDefined()
    expect(screen.getByText('CASE-003')).toBeDefined()
  })

  it('shows forecast status pills', () => {
    render(
      <CaseDrawerFinancials
        data={makeFullData()}
        displayStatus="completed"
        surgeonName="Dr. James Wilson"
        loading={false}
        error={null}
      />
    )
    const toggleBtn = screen.getByRole('button', { name: /Full Day Forecast/ })
    fireEvent.click(toggleBtn)
    expect(screen.getByText('Done')).toBeDefined()
    expect(screen.getByText('Sched')).toBeDefined()
    expect(screen.getByText('Active')).toBeDefined()
  })

  it('shows forecast footer with day totals', () => {
    render(
      <CaseDrawerFinancials
        data={makeFullData()}
        displayStatus="completed"
        surgeonName="Dr. James Wilson"
        loading={false}
        error={null}
      />
    )
    const toggleBtn = screen.getByRole('button', { name: /Full Day Forecast/ })
    fireEvent.click(toggleBtn)
    expect(screen.getByText(/Day Total/)).toBeDefined()
    expect(screen.getByText(/1 of 3 completed/)).toBeDefined()
  })
})

describe('CaseDrawerFinancials — completed + zero costs', () => {
  it('shows cost data unavailable banner', () => {
    const data = makeFullData({
      data_quality: makeDataQuality({ has_costs: false }),
    })
    render(
      <CaseDrawerFinancials
        data={data}
        displayStatus="completed"
        surgeonName="Dr. James Wilson"
        loading={false}
        error={null}
      />
    )
    expect(screen.getByText(/Cost data unavailable/)).toBeDefined()
  })
})

describe('CaseDrawerFinancials — scheduled case', () => {
  it('renders hero row with projected (italic) styling', () => {
    const data = makeFullData({
      projected_vs_actual: {
        ...makeComparison(),
        lineItems: makeComparison().lineItems.map(item => ({
          ...item,
          actual: null,
          delta: null,
        })),
        actualProfit: null,
        profitDelta: null,
        actualMargin: null,
      },
    })
    const { container } = render(
      <CaseDrawerFinancials
        data={data}
        displayStatus="scheduled"
        surgeonName="Dr. James Wilson"
        loading={false}
        error={null}
      />
    )
    // Profit value should be italic (projected)
    const italicElements = container.querySelectorAll('.italic')
    expect(italicElements.length).toBeGreaterThan(0)
  })

  it('shows dash for actual column when not completed', () => {
    const data = makeFullData({
      projected_vs_actual: {
        ...makeComparison(),
        lineItems: makeComparison().lineItems.map(item => ({
          ...item,
          actual: null,
          delta: null,
        })),
        actualProfit: null,
        profitDelta: null,
        actualMargin: null,
      },
    })
    render(
      <CaseDrawerFinancials
        data={data}
        displayStatus="scheduled"
        surgeonName="Dr. James Wilson"
        loading={false}
        error={null}
      />
    )
    // Actual column shows dashes
    const dashes = screen.getAllByText('\u2014')
    expect(dashes.length).toBeGreaterThan(0)
  })
})

describe('CaseDrawerFinancials — no revenue configured', () => {
  it('shows revenue not configured warning', () => {
    const data = makeFullData({
      data_quality: makeDataQuality({ has_revenue: false }),
    })
    render(
      <CaseDrawerFinancials
        data={data}
        displayStatus="scheduled"
        surgeonName="Dr. James Wilson"
        loading={false}
        error={null}
      />
    )
    expect(screen.getByText(/Revenue not configured/)).toBeDefined()
  })
})

describe('CaseDrawerFinancials — surgeon first case', () => {
  it('shows first case for surgeon message when surgeon count is 0', () => {
    const data = makeFullData({
      hero: makeHero({ surgeon_case_count: 0, facility_case_count: 50 }),
    })
    render(
      <CaseDrawerFinancials
        data={data}
        displayStatus="scheduled"
        surgeonName="Dr. James Wilson"
        loading={false}
        error={null}
      />
    )
    expect(screen.getByText(/First case for this surgeon/)).toBeDefined()
  })
})

describe('CaseDrawerFinancials — low confidence', () => {
  it('shows low confidence message for small case count', () => {
    const data = makeFullData({
      hero: makeHero({ surgeon_case_count: 3, facility_case_count: 100 }),
      data_quality: makeDataQuality({ confidence: 'low' }),
    })
    render(
      <CaseDrawerFinancials
        data={data}
        displayStatus="scheduled"
        surgeonName="Dr. James Wilson"
        loading={false}
        error={null}
      />
    )
    expect(screen.getByText(/Based on 3 cases/)).toBeDefined()
  })
})

describe('CaseDrawerFinancials — in-progress case', () => {
  it('shows info banner about final financials', () => {
    render(
      <CaseDrawerFinancials
        data={makeFullData()}
        displayStatus="in_progress"
        surgeonName="Dr. James Wilson"
        loading={false}
        error={null}
      />
    )
    expect(screen.getByText(/Final financials available after completion/)).toBeDefined()
  })
})

describe('CaseDrawerFinancials — full day forecast with 5 cases', () => {
  it('shows all 5 cases in expanded forecast', () => {
    const fiveCases = Array.from({ length: 5 }, (_, i) => ({
      case_id: `c${i + 1}`,
      case_number: `CASE-${String(i + 1).padStart(3, '0')}`,
      procedure_name: `Procedure ${i + 1}`,
      status: i < 3 ? 'completed' : 'scheduled',
      revenue: 5000,
      total_costs: 2000,
      profit: 3000,
      margin_pct: 60,
    }))

    const data = makeFullData({
      full_day_forecast: {
        surgeon_name: 'Dr. James Wilson',
        surgeon_id: 'surgeon-1',
        cases: fiveCases,
        total_revenue: 25000,
        total_costs: 10000,
        total_profit: 15000,
        total_margin: 60,
      },
    })

    render(
      <CaseDrawerFinancials
        data={data}
        displayStatus="completed"
        surgeonName="Dr. James Wilson"
        loading={false}
        error={null}
      />
    )

    const toggleBtn = screen.getByRole('button', { name: /Full Day Forecast/ })
    fireEvent.click(toggleBtn)

    for (let i = 1; i <= 5; i++) {
      expect(screen.getByText(`CASE-${String(i).padStart(3, '0')}`)).toBeDefined()
    }
    expect(screen.getByText(/3 of 5 completed/)).toBeDefined()
  })
})

describe('CaseDrawerFinancials — states', () => {
  it('renders loading skeleton', () => {
    const { container } = render(
      <CaseDrawerFinancials
        data={null}
        displayStatus="completed"
        surgeonName="Dr. James Wilson"
        loading={true}
        error={null}
      />
    )
    expect(container.querySelector('.animate-pulse')).toBeTruthy()
  })

  it('renders error state', () => {
    render(
      <CaseDrawerFinancials
        data={null}
        displayStatus="completed"
        surgeonName="Dr. James Wilson"
        loading={false}
        error="Database connection failed"
      />
    )
    expect(screen.getByText('Failed to load financial data')).toBeDefined()
    expect(screen.getByText('Database connection failed')).toBeDefined()
  })

  it('renders empty state when no data', () => {
    render(
      <CaseDrawerFinancials
        data={null}
        displayStatus="completed"
        surgeonName="Dr. James Wilson"
        loading={false}
        error={null}
      />
    )
    expect(screen.getByText('No financial data available')).toBeDefined()
  })

  it('hides full day forecast section when no forecast data', () => {
    const data = makeFullData({ full_day_forecast: null })
    render(
      <CaseDrawerFinancials
        data={data}
        displayStatus="completed"
        surgeonName="Dr. James Wilson"
        loading={false}
        error={null}
      />
    )
    expect(screen.queryByText('Full Day Forecast')).toBeNull()
  })

  it('hides cost breakdown when no cost items', () => {
    const data = makeFullData({ cost_breakdown: [] })
    render(
      <CaseDrawerFinancials
        data={data}
        displayStatus="completed"
        surgeonName="Dr. James Wilson"
        loading={false}
        error={null}
      />
    )
    expect(screen.queryByText('Cost Breakdown')).toBeNull()
  })

  it('hides projected vs actual when comparison is null', () => {
    const data = makeFullData({ projected_vs_actual: null })
    render(
      <CaseDrawerFinancials
        data={data}
        displayStatus="completed"
        surgeonName="Dr. James Wilson"
        loading={false}
        error={null}
      />
    )
    expect(screen.queryByText('Projected vs Actual')).toBeNull()
  })
})

describe('CaseDrawerFinancials — projection source footnote', () => {
  it('displays projection duration source as footnote', () => {
    render(
      <CaseDrawerFinancials
        data={makeFullData()}
        displayStatus="completed"
        surgeonName="Dr. James Wilson"
        loading={false}
        error={null}
      />
    )
    expect(screen.getByText(/Based on Dr. Wilson's median of 90 min/)).toBeDefined()
  })
})
