// app/admin/facilities/new/__tests__/ReviewStep.test.tsx
// Tests for ReviewStep component (Step 5 of facility wizard)

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ReviewStep from '../ReviewStep'
import type { FacilityData, AdminData, TemplateConfig, TemplateCounts } from '../types'
import { DEFAULT_FACILITY_DATA, DEFAULT_TEMPLATE_CONFIG } from '../types'

describe('ReviewStep', () => {
  const mockOnEditStep = vi.fn()

  const FACILITY_DATA: FacilityData = {
    ...DEFAULT_FACILITY_DATA,
    name: 'Pacific Surgery Center',
    facilityType: 'asc',
    phone: '(555) 123-4567',
    streetAddress: '123 Main St',
    streetAddress2: 'Suite 200',
    city: 'Seattle',
    state: 'WA',
    zipCode: '98101',
    timezone: 'America/Los_Angeles',
    subscriptionStatus: 'trial',
    trialDays: 30,
  }

  const ADMIN_DATA: AdminData = {
    firstName: 'Jane',
    lastName: 'Smith',
    email: 'jane.smith@hospital.com',
    roleId: 'role-1',
  }

  const TEMPLATE_COUNTS: TemplateCounts = {
    milestones: 12,
    procedures: 25,
    procedureMilestoneConfig: 8,
    delayTypes: 6,
    cancellationReasons: 4,
    complexities: 3,
    checklistFields: 10,
    costCategories: 8,
    implantCompanies: 15,
    payers: 20,
    analyticsSettings: 1,
    flagRules: 32,
    phaseDefinitions: 5,
    notificationSettings: 1,
  }

  function setup(overrides: {
    facilityData?: Partial<FacilityData>
    adminData?: Partial<AdminData>
    templateConfig?: Partial<TemplateConfig>
    templateCounts?: TemplateCounts
    sendWelcomeEmail?: boolean
  } = {}) {
    return render(
      <ReviewStep
        facilityData={{ ...FACILITY_DATA, ...overrides.facilityData }}
        adminData={{ ...ADMIN_DATA, ...overrides.adminData }}
        templateConfig={{ ...DEFAULT_TEMPLATE_CONFIG, ...overrides.templateConfig }}
        templateCounts={overrides.templateCounts ?? TEMPLATE_COUNTS}
        sendWelcomeEmail={overrides.sendWelcomeEmail ?? true}
        onEditStep={mockOnEditStep}
      />,
    )
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ============================================================================
  // RENDERING
  // ============================================================================

  describe('Rendering', () => {
    it('renders the review step with provision banner', () => {
      setup()
      expect(screen.getByText('Ready to provision')).toBeTruthy()
      expect(screen.getByText('All validations passed')).toBeTruthy()
    })

    it('renders all four review sections', () => {
      setup()
      expect(screen.getByTestId('review-section-step-1')).toBeTruthy()
      expect(screen.getByTestId('review-section-step-2')).toBeTruthy()
      expect(screen.getByTestId('review-section-step-3')).toBeTruthy()
      expect(screen.getByTestId('review-section-step-4')).toBeTruthy()
    })

    it('renders edit buttons for each section', () => {
      setup()
      expect(screen.getByTestId('review-edit-step-1')).toBeTruthy()
      expect(screen.getByTestId('review-edit-step-2')).toBeTruthy()
      expect(screen.getByTestId('review-edit-step-3')).toBeTruthy()
      expect(screen.getByTestId('review-edit-step-4')).toBeTruthy()
    })
  })

  // ============================================================================
  // FACILITY DETAILS SECTION
  // ============================================================================

  describe('Facility Details Section', () => {
    it('displays facility name', () => {
      setup()
      expect(screen.getByText('Pacific Surgery Center')).toBeTruthy()
    })

    it('displays facility type label', () => {
      setup()
      expect(screen.getByText('Ambulatory Surgery Center (ASC)')).toBeTruthy()
    })

    it('displays phone number when provided', () => {
      setup()
      expect(screen.getByText('(555) 123-4567')).toBeTruthy()
    })

    it('does not display phone row when phone is empty', () => {
      setup({ facilityData: { phone: '' } })
      expect(screen.queryByText('(555) 123-4567')).toBeNull()
    })

    it('displays address when provided', () => {
      setup()
      const section = screen.getByTestId('review-section-step-1')
      expect(section.textContent).toContain('123 Main St')
    })

    it('does not display address section when no address fields are provided', () => {
      setup({
        facilityData: {
          streetAddress: '',
          streetAddress2: '',
          city: '',
          state: '',
          zipCode: '',
        },
      })
      const section = screen.getByTestId('review-section-step-1')
      expect(section.textContent).not.toContain('123 Main St')
    })

    it('displays timezone label', () => {
      setup()
      expect(screen.getByText('Pacific Time (PT)')).toBeTruthy()
    })

    it('displays trial subscription status with badge', () => {
      setup()
      expect(screen.getByText('Trial')).toBeTruthy()
      expect(screen.getByText('30 days')).toBeTruthy()
    })

    it('displays active subscription status without trial length', () => {
      setup({ facilityData: { subscriptionStatus: 'active' } })
      expect(screen.getByText('Active')).toBeTruthy()
      expect(screen.queryByText('30 days')).toBeNull()
    })
  })

  // ============================================================================
  // ADMINISTRATOR SECTION
  // ============================================================================

  describe('Administrator Section', () => {
    it('displays admin full name', () => {
      setup()
      expect(screen.getByText('Jane Smith')).toBeTruthy()
    })

    it('displays admin email', () => {
      setup()
      expect(screen.getByText('jane.smith@hospital.com')).toBeTruthy()
    })

    it('displays "Will be sent" when welcome email is enabled', () => {
      setup({ sendWelcomeEmail: true })
      expect(screen.getByText('Will be sent')).toBeTruthy()
    })

    it('displays "Not sending" when welcome email is disabled', () => {
      setup({ sendWelcomeEmail: false })
      expect(screen.getByText('Not sending')).toBeTruthy()
    })
  })

  // ============================================================================
  // CLINICAL TEMPLATES SECTION
  // ============================================================================

  describe('Clinical Templates Section', () => {
    it('displays enabled clinical template chips', () => {
      setup()
      expect(screen.getByTestId('review-template-milestones')).toBeTruthy()
      expect(screen.getByTestId('review-template-procedures')).toBeTruthy()
      expect(screen.getByTestId('review-template-delayTypes')).toBeTruthy()
    })

    it('shows count in chip for enabled templates', () => {
      setup()
      const milestoneChip = screen.getByTestId('review-template-milestones')
      expect(milestoneChip.textContent).toContain('(12)')
    })

    it('does not show chip for disabled templates', () => {
      setup({ templateConfig: { milestones: false } })
      expect(screen.queryByTestId('review-template-milestones')).toBeNull()
    })

    it('shows "None selected" when all clinical templates are disabled', () => {
      setup({
        templateConfig: {
          milestones: false,
          procedures: false,
          procedureMilestoneConfig: false,
          delayTypes: false,
          cancellationReasons: false,
          complexities: false,
          checklistFields: false,
        },
      })
      const section = screen.getByTestId('review-section-step-3')
      expect(section.textContent).toContain('None selected')
    })

    it('shows all 7 clinical template chips when all are enabled', () => {
      setup()
      expect(screen.getByTestId('review-template-milestones')).toBeTruthy()
      expect(screen.getByTestId('review-template-procedures')).toBeTruthy()
      expect(screen.getByTestId('review-template-procedureMilestoneConfig')).toBeTruthy()
      expect(screen.getByTestId('review-template-delayTypes')).toBeTruthy()
      expect(screen.getByTestId('review-template-cancellationReasons')).toBeTruthy()
      expect(screen.getByTestId('review-template-complexities')).toBeTruthy()
      expect(screen.getByTestId('review-template-checklistFields')).toBeTruthy()
    })
  })

  // ============================================================================
  // OPERATIONAL TEMPLATES SECTION
  // ============================================================================

  describe('Operational Templates Section', () => {
    it('displays enabled operational template chips', () => {
      setup()
      expect(screen.getByTestId('review-template-costCategories')).toBeTruthy()
      expect(screen.getByTestId('review-template-implantCompanies')).toBeTruthy()
      expect(screen.getByTestId('review-template-payers')).toBeTruthy()
    })

    it('shows "None selected" when all operational templates are disabled', () => {
      setup({
        templateConfig: {
          costCategories: false,
          implantCompanies: false,
          payers: false,
          analyticsSettings: false,
          flagRules: false,
          phaseDefinitions: false,
          notificationSettings: false,
        },
      })
      const section = screen.getByTestId('review-section-step-4')
      expect(section.textContent).toContain('None selected')
    })

    it('shows all operational template categories when enabled', () => {
      setup()
      expect(screen.getByTestId('review-template-costCategories')).toBeTruthy()
      expect(screen.getByTestId('review-template-implantCompanies')).toBeTruthy()
      expect(screen.getByTestId('review-template-payers')).toBeTruthy()
      expect(screen.getByTestId('review-template-analyticsSettings')).toBeTruthy()
      expect(screen.getByTestId('review-template-flagRules')).toBeTruthy()
      expect(screen.getByTestId('review-template-phaseDefinitions')).toBeTruthy()
      expect(screen.getByTestId('review-template-notificationSettings')).toBeTruthy()
    })
  })

  // ============================================================================
  // EDIT BUTTONS
  // ============================================================================

  describe('Edit Buttons', () => {
    it('calls onEditStep(1) when facility edit button is clicked', () => {
      setup()
      fireEvent.click(screen.getByTestId('review-edit-step-1'))
      expect(mockOnEditStep).toHaveBeenCalledWith(1)
    })

    it('calls onEditStep(2) when admin edit button is clicked', () => {
      setup()
      fireEvent.click(screen.getByTestId('review-edit-step-2'))
      expect(mockOnEditStep).toHaveBeenCalledWith(2)
    })

    it('calls onEditStep(3) when clinical templates edit button is clicked', () => {
      setup()
      fireEvent.click(screen.getByTestId('review-edit-step-3'))
      expect(mockOnEditStep).toHaveBeenCalledWith(3)
    })

    it('calls onEditStep(4) when operational templates edit button is clicked', () => {
      setup()
      fireEvent.click(screen.getByTestId('review-edit-step-4'))
      expect(mockOnEditStep).toHaveBeenCalledWith(4)
    })
  })

  // ============================================================================
  // EDGE CASES
  // ============================================================================

  describe('Edge Cases', () => {
    it('handles all templates disabled', () => {
      const allDisabled: Partial<TemplateConfig> = {
        milestones: false,
        procedures: false,
        procedureMilestoneConfig: false,
        delayTypes: false,
        cancellationReasons: false,
        complexities: false,
        checklistFields: false,
        costCategories: false,
        implantCompanies: false,
        payers: false,
        analyticsSettings: false,
        flagRules: false,
        phaseDefinitions: false,
        notificationSettings: false,
      }
      setup({ templateConfig: allDisabled })
      const clinicalSection = screen.getByTestId('review-section-step-3')
      const operationalSection = screen.getByTestId('review-section-step-4')
      expect(clinicalSection.textContent).toContain('None selected')
      expect(operationalSection.textContent).toContain('None selected')
    })

    it('displays street address 2 when provided', () => {
      setup()
      const section = screen.getByTestId('review-section-step-1')
      expect(section.textContent).toContain('Suite 200')
    })

    it('handles facility type not in known list', () => {
      setup({ facilityData: { facilityType: 'unknown_type' } })
      // Falls back to the raw value
      expect(screen.getByText('unknown_type')).toBeTruthy()
    })

    it('handles timezone not in known list', () => {
      setup({ facilityData: { timezone: 'Custom/Timezone' } })
      expect(screen.getByText('Custom/Timezone')).toBeTruthy()
    })
  })
})
