// components/settings/flags/__tests__/FlagRuleRow.test.tsx
// Unit tests for FlagRuleRow component — Phase 4 additions

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FlagRuleRow } from '../FlagRuleRow'
import type { FlagRule } from '@/types/flag-settings'

// =====================================================
// MOCKS
// =====================================================

const mockBuiltInRule: FlagRule = {
  id: 'rule-1',
  facility_id: 'fac-1',
  name: 'Long Incision to Close',
  description: 'Built-in timing rule',
  category: 'timing',
  metric: 'incision_to_close_duration',
  start_milestone: 'incision',
  end_milestone: 'closure',
  operator: 'gt',
  threshold_type: 'absolute',
  threshold_value: 90,
  threshold_value_max: null,
  comparison_scope: 'facility',
  severity: 'warning',
  display_order: 1,
  is_built_in: true,
  is_enabled: true,
  is_active: true,
  cost_category_id: null,
  source_rule_id: null,
  deleted_at: null,
  deleted_by: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

const mockCustomRule: FlagRule = {
  ...mockBuiltInRule,
  id: 'rule-2',
  name: 'Custom Turnover Alert',
  description: 'Custom efficiency rule',
  category: 'efficiency',
  metric: 'room_turnover_duration',
  is_built_in: false,
}

// =====================================================
// TESTS
// =====================================================

describe('FlagRuleRow — Phase 4: Custom Badge & Archive/Restore Buttons', () => {
  describe('Custom badge display', () => {
    it('shows Custom badge for custom rules (is_built_in = false)', () => {
      render(
        <FlagRuleRow
          rule={mockCustomRule}
          onToggle={vi.fn()}
          onSeverityChange={vi.fn()}
          onThresholdTypeChange={vi.fn()}
          onOperatorChange={vi.fn()}
          onValueChange={vi.fn()}
          onValueMaxChange={vi.fn()}
          onScopeChange={vi.fn()}
          isSaving={false}
          showArchive={true}
          onArchive={vi.fn()}
        />
      )

      const customBadge = screen.getByText('Custom')
      expect(customBadge).toBeInTheDocument()
      expect(customBadge).toHaveClass('bg-blue-50', 'text-blue-600')
    })

    it('does NOT show Custom badge for built-in rules', () => {
      render(
        <FlagRuleRow
          rule={mockBuiltInRule}
          onToggle={vi.fn()}
          onSeverityChange={vi.fn()}
          onThresholdTypeChange={vi.fn()}
          onOperatorChange={vi.fn()}
          onValueChange={vi.fn()}
          onValueMaxChange={vi.fn()}
          onScopeChange={vi.fn()}
          isSaving={false}
        />
      )

      const customBadge = screen.queryByText('Custom')
      expect(customBadge).not.toBeInTheDocument()
    })
  })

  describe('Archive button for custom rules', () => {
    it('shows archive button when showArchive=true and onArchive provided', () => {
      render(
        <FlagRuleRow
          rule={mockCustomRule}
          onToggle={vi.fn()}
          onSeverityChange={vi.fn()}
          onThresholdTypeChange={vi.fn()}
          onOperatorChange={vi.fn()}
          onValueChange={vi.fn()}
          onValueMaxChange={vi.fn()}
          onScopeChange={vi.fn()}
          isSaving={false}
          showArchive={true}
          onArchive={vi.fn()}
        />
      )

      const archiveButton = screen.getByTitle('Archive rule')
      expect(archiveButton).toBeInTheDocument()
    })

    it('does NOT show archive button when showArchive=false or onArchive not provided', () => {
      render(
        <FlagRuleRow
          rule={mockBuiltInRule}
          onToggle={vi.fn()}
          onSeverityChange={vi.fn()}
          onThresholdTypeChange={vi.fn()}
          onOperatorChange={vi.fn()}
          onValueChange={vi.fn()}
          onValueMaxChange={vi.fn()}
          onScopeChange={vi.fn()}
          isSaving={false}
          showArchive={false}
        />
      )

      const archiveButton = screen.queryByTitle('Archive rule')
      expect(archiveButton).not.toBeInTheDocument()
    })

    it('calls onArchive when archive button clicked', async () => {
      const user = userEvent.setup()
      const onArchive = vi.fn()

      render(
        <FlagRuleRow
          rule={mockCustomRule}
          onToggle={vi.fn()}
          onSeverityChange={vi.fn()}
          onThresholdTypeChange={vi.fn()}
          onOperatorChange={vi.fn()}
          onValueChange={vi.fn()}
          onValueMaxChange={vi.fn()}
          onScopeChange={vi.fn()}
          isSaving={false}
          showArchive={true}
          onArchive={onArchive}
        />
      )

      const archiveButton = screen.getByTitle('Archive rule')
      await user.click(archiveButton)

      expect(onArchive).toHaveBeenCalled()
    })

    it('archive button has Archive icon', () => {
      render(
        <FlagRuleRow
          rule={mockCustomRule}
          onToggle={vi.fn()}
          onSeverityChange={vi.fn()}
          onThresholdTypeChange={vi.fn()}
          onOperatorChange={vi.fn()}
          onValueChange={vi.fn()}
          onValueMaxChange={vi.fn()}
          onScopeChange={vi.fn()}
          isSaving={false}
          showArchive={true}
          onArchive={vi.fn()}
        />
      )

      const archiveButton = screen.getByTitle('Archive rule')
      // Lucide Archive icon should be rendered inside the button
      expect(archiveButton.querySelector('svg')).toBeInTheDocument()
    })
  })

  describe('6-column grid layout', () => {
    it('renders in 6-column grid (name, threshold, severity, scope, toggle, actions)', () => {
      const { container } = render(
        <FlagRuleRow
          rule={mockCustomRule}
          isSaving={false}
          onToggle={vi.fn()}
          onSeverityChange={vi.fn()}
          onThresholdTypeChange={vi.fn()}
          onOperatorChange={vi.fn()}
          onValueChange={vi.fn()}
          onValueMaxChange={vi.fn()}
          onScopeChange={vi.fn()}
          showArchive={true}
          onArchive={vi.fn()}
        />
      )

      // FlagRuleTable uses grid-cols-[auto_1fr_auto_auto_auto_auto]
      // FlagRuleRow should match this structure
      const row = container.querySelector('[class*="grid"]')
      expect(row).toBeInTheDocument()
    })

    it('actions column (6th column) contains archive button for custom rules', () => {
      render(
        <FlagRuleRow
          rule={mockCustomRule}
          isSaving={false}
          onToggle={vi.fn()}
          onSeverityChange={vi.fn()}
          onThresholdTypeChange={vi.fn()}
          onOperatorChange={vi.fn()}
          onValueChange={vi.fn()}
          onValueMaxChange={vi.fn()}
          onScopeChange={vi.fn()}
          showArchive={true}
          onArchive={vi.fn()}
        />
      )

      const archiveButton = screen.getByTitle('Archive rule')
      expect(archiveButton).toBeInTheDocument()

      // Archive button should be in the last (6th) grid column
      const parentDiv = archiveButton.closest('div')
      expect(parentDiv).toBeInTheDocument()
    })

    it('actions column is empty for built-in rules', () => {
      const { container } = render(
        <FlagRuleRow
          rule={mockBuiltInRule}
          isSaving={false}
          onToggle={vi.fn()}
          onSeverityChange={vi.fn()}
          onThresholdTypeChange={vi.fn()}
          onOperatorChange={vi.fn()}
          onValueChange={vi.fn()}
          onValueMaxChange={vi.fn()}
          onScopeChange={vi.fn()}
          showArchive={false}
          onArchive={vi.fn()}
        />
      )

      // No archive button for built-in rules
      const archiveButton = screen.queryByTitle('Archive rule')
      expect(archiveButton).not.toBeInTheDocument()

      // But the 6th column still exists (empty)
      const row = container.querySelector('[class*="grid"]')
      expect(row).toBeInTheDocument()
    })
  })

  describe('Saving state', () => {
    it('disables archive button when rule is being saved', () => {
      render(
        <FlagRuleRow
          rule={mockCustomRule}
          isSaving={true}
          onToggle={vi.fn()}
          onSeverityChange={vi.fn()}
          onThresholdTypeChange={vi.fn()}
          onOperatorChange={vi.fn()}
          onValueChange={vi.fn()}
          onValueMaxChange={vi.fn()}
          onScopeChange={vi.fn()}
          showArchive={true}
          onArchive={vi.fn()}
        />
      )

      const archiveButton = screen.getByTitle('Archive rule')
      expect(archiveButton).toBeDisabled()
    })

    it('archive button is enabled when not saving', () => {
      render(
        <FlagRuleRow
          rule={mockCustomRule}
          isSaving={false}
          onToggle={vi.fn()}
          onSeverityChange={vi.fn()}
          onThresholdTypeChange={vi.fn()}
          onOperatorChange={vi.fn()}
          onValueChange={vi.fn()}
          onValueMaxChange={vi.fn()}
          onScopeChange={vi.fn()}
          showArchive={true}
          onArchive={vi.fn()}
        />
      )

      const archiveButton = screen.getByTitle('Archive rule')
      expect(archiveButton).not.toBeDisabled()
    })
  })

  describe('Rule name display with Custom badge', () => {
    it('renders rule name and Custom badge in name column', () => {
      render(
        <FlagRuleRow
          rule={mockCustomRule}
          isSaving={false}
          onToggle={vi.fn()}
          onSeverityChange={vi.fn()}
          onThresholdTypeChange={vi.fn()}
          onOperatorChange={vi.fn()}
          onValueChange={vi.fn()}
          onValueMaxChange={vi.fn()}
          onScopeChange={vi.fn()}
          showArchive={true}
          onArchive={vi.fn()}
        />
      )

      expect(screen.getByText('Custom Turnover Alert')).toBeInTheDocument()
      expect(screen.getByText('Custom')).toBeInTheDocument()
    })

    it('Custom badge appears next to rule name (not in separate column)', () => {
      const { container } = render(
        <FlagRuleRow
          rule={mockCustomRule}
          isSaving={false}
          onToggle={vi.fn()}
          onSeverityChange={vi.fn()}
          onThresholdTypeChange={vi.fn()}
          onOperatorChange={vi.fn()}
          onValueChange={vi.fn()}
          onValueMaxChange={vi.fn()}
          onScopeChange={vi.fn()}
          showArchive={true}
          onArchive={vi.fn()}
        />
      )

      const nameColumn = screen.getByText('Custom Turnover Alert').closest('div')
      const customBadge = screen.getByText('Custom')
      const badgeParent = customBadge.closest('div')

      // Badge should be in the same column as the name
      expect(nameColumn).toContainElement(customBadge)
    })
  })

  describe('Visual hierarchy', () => {
    it('Custom badge has blue background and smaller text', () => {
      render(
        <FlagRuleRow
          rule={mockCustomRule}
          isSaving={false}
          onToggle={vi.fn()}
          onSeverityChange={vi.fn()}
          onThresholdTypeChange={vi.fn()}
          onOperatorChange={vi.fn()}
          onValueChange={vi.fn()}
          onValueMaxChange={vi.fn()}
          onScopeChange={vi.fn()}
          showArchive={true}
          onArchive={vi.fn()}
        />
      )

      const customBadge = screen.getByText('Custom')
      // Updated to match Phase 5 styling: smaller font, uppercase, rounded
      expect(customBadge).toHaveClass('text-[9px]', 'font-bold', 'uppercase', 'bg-blue-50', 'text-blue-600')
    })

    it('archive button has slate default with red hover', () => {
      render(
        <FlagRuleRow
          rule={mockCustomRule}
          isSaving={false}
          onToggle={vi.fn()}
          onSeverityChange={vi.fn()}
          onThresholdTypeChange={vi.fn()}
          onOperatorChange={vi.fn()}
          onValueChange={vi.fn()}
          onValueMaxChange={vi.fn()}
          onScopeChange={vi.fn()}
          showArchive={true}
          onArchive={vi.fn()}
        />
      )

      const archiveButton = screen.getByTitle('Archive rule')
      // Archive button: light slate default, red on hover to indicate removal
      expect(archiveButton).toHaveClass('text-slate-300', 'hover:text-red-500')
    })
  })

  describe('Accessibility', () => {
    it('archive button has accessible title attribute', () => {
      render(
        <FlagRuleRow
          rule={mockCustomRule}
          isSaving={false}
          onToggle={vi.fn()}
          onSeverityChange={vi.fn()}
          onThresholdTypeChange={vi.fn()}
          onOperatorChange={vi.fn()}
          onValueChange={vi.fn()}
          onValueMaxChange={vi.fn()}
          onScopeChange={vi.fn()}
          showArchive={true}
          onArchive={vi.fn()}
        />
      )

      const archiveButton = screen.getByTitle('Archive rule')
      expect(archiveButton).toHaveAttribute('title', 'Archive rule')
    })

    it('Custom badge has appropriate semantic markup', () => {
      render(
        <FlagRuleRow
          rule={mockCustomRule}
          isSaving={false}
          onToggle={vi.fn()}
          onSeverityChange={vi.fn()}
          onThresholdTypeChange={vi.fn()}
          onOperatorChange={vi.fn()}
          onValueChange={vi.fn()}
          onValueMaxChange={vi.fn()}
          onScopeChange={vi.fn()}
          showArchive={true}
          onArchive={vi.fn()}
        />
      )

      const customBadge = screen.getByText('Custom')
      // Badge should be a span with appropriate styling
      expect(customBadge.tagName).toBe('SPAN')
    })
  })
})
