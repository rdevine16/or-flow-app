// app/admin/demo/DemoWizardShell.tsx
// 6-step sidebar wizard shell for Demo Data Generator.
// Mirrors the FacilityWizard sidebar layout pattern.

'use client'

import { useCallback, type ReactNode } from 'react'
import {
  Building2,
  Users,
  LayoutGrid,
  SlidersHorizontal,
  ClipboardCheck,
  Play,
  Check,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import type { DemoWizardStep } from './types'
import { DEMO_STEP_LABELS, DEMO_STEP_DESCRIPTIONS, DEMO_STEP_COUNT } from './types'

// ============================================================================
// STEP ICONS
// ============================================================================

interface StepDef {
  id: DemoWizardStep
  label: string
  description: string
  Icon: LucideIcon
}

const STEPS: StepDef[] = [
  { id: 1, label: DEMO_STEP_LABELS[1], description: DEMO_STEP_DESCRIPTIONS[1], Icon: Building2 },
  { id: 2, label: DEMO_STEP_LABELS[2], description: DEMO_STEP_DESCRIPTIONS[2], Icon: Users },
  { id: 3, label: DEMO_STEP_LABELS[3], description: DEMO_STEP_DESCRIPTIONS[3], Icon: LayoutGrid },
  { id: 4, label: DEMO_STEP_LABELS[4], description: DEMO_STEP_DESCRIPTIONS[4], Icon: SlidersHorizontal },
  { id: 5, label: DEMO_STEP_LABELS[5], description: DEMO_STEP_DESCRIPTIONS[5], Icon: ClipboardCheck },
  { id: 6, label: DEMO_STEP_LABELS[6], description: DEMO_STEP_DESCRIPTIONS[6], Icon: Play },
]

// ============================================================================
// PROPS
// ============================================================================

export interface DemoWizardShellProps {
  currentStep: DemoWizardStep
  completedSteps: Set<DemoWizardStep>
  onStepChange: (step: DemoWizardStep) => void
  canAdvance: boolean
  onNext: () => void
  onBack: () => void
  /** Sidebar provision summary items */
  summaryItems: { label: string; value: string }[]
  children: ReactNode
  /** Hide footer navigation (for Running step) */
  hideFooter?: boolean
  /** Custom next button label */
  nextLabel?: string
  /** Show "Generate" button instead of "Continue" (for Review step) */
  showGenerate?: boolean
  onGenerate?: () => void
  generating?: boolean
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function DemoWizardShell({
  currentStep,
  completedSteps,
  onStepChange,
  canAdvance,
  onNext,
  onBack,
  summaryItems,
  children,
  hideFooter = false,
  showGenerate = false,
  onGenerate,
  generating = false,
}: DemoWizardShellProps) {
  const maxAccessibleStep = Math.max(currentStep, ...[...completedSteps], 0) + 1

  const handleStepClick = useCallback(
    (stepId: DemoWizardStep) => {
      if (stepId <= maxAccessibleStep && stepId !== currentStep) {
        onStepChange(stepId)
      }
    },
    [maxAccessibleStep, currentStep, onStepChange],
  )

  return (
    <div className="max-w-[1120px] mx-auto py-8 px-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900">Demo Data Generator</h1>
        <p className="text-slate-500 mt-1">Generate realistic surgical data for client demos</p>
      </div>

      <div className="flex gap-8">
        {/* ================================================================ */}
        {/* SIDEBAR NAVIGATION                                               */}
        {/* ================================================================ */}
        <aside className="w-[264px] shrink-0 hidden lg:block">
          <div className="sticky top-8">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-4 pl-3">
              Setup Steps
            </p>
            <nav className="flex flex-col gap-0.5" data-testid="demo-wizard-progress">
              {STEPS.map((step) => {
                const isActive = step.id === currentStep
                const isCompleted = completedSteps.has(step.id)
                const isAccessible = step.id <= maxAccessibleStep
                const StepIcon = step.Icon

                return (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => handleStepClick(step.id)}
                    disabled={!isAccessible}
                    data-testid={`demo-step-${step.id}`}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-[10px] border-none text-left transition-all ${
                      isActive
                        ? 'bg-blue-50'
                        : isAccessible
                        ? 'bg-transparent hover:bg-slate-50'
                        : 'bg-transparent'
                    } ${!isAccessible ? 'opacity-40 cursor-default' : 'cursor-pointer'}`}
                  >
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all ${
                        isCompleted
                          ? 'bg-green-500 text-white'
                          : isActive
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                          : 'bg-slate-200 text-slate-500'
                      }`}
                    >
                      {isCompleted ? (
                        <Check className="w-[15px] h-[15px]" />
                      ) : (
                        <StepIcon className="w-4 h-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div
                        className={`text-[13.5px] leading-tight ${
                          isActive
                            ? 'font-semibold text-blue-600'
                            : 'font-medium text-slate-900'
                        }`}
                      >
                        {step.label}
                      </div>
                      <div className="text-[11.5px] text-slate-500 leading-tight mt-0.5">
                        {step.description}
                      </div>
                    </div>
                  </button>
                )
              })}
            </nav>

            {/* Provision Summary */}
            {summaryItems.length > 0 && (
              <div className="mt-7 p-4 bg-white rounded-xl border border-slate-200">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2.5">
                  Generation Summary
                </p>
                <div className="flex flex-col gap-1.5">
                  {summaryItems.map((item) => (
                    <div key={item.label} className="flex justify-between text-xs">
                      <span className="text-slate-500">{item.label}</span>
                      <span className="font-semibold text-slate-900 font-mono text-[12px]">
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* ================================================================ */}
        {/* MAIN CONTENT                                                      */}
        {/* ================================================================ */}
        <main className="flex-1 min-w-0">
          {/* Step Content */}
          <div key={currentStep} className="demo-wizard-step-enter">
            {children}
          </div>

          {/* Footer Navigation */}
          {!hideFooter && (
            <div className="flex justify-between items-center mt-7 pt-5 border-t border-slate-200">
              {currentStep > 1 ? (
                <Button variant="ghost" onClick={onBack}>
                  <ChevronLeft className="w-4 h-4" />
                  Back
                </Button>
              ) : (
                <div />
              )}

              {showGenerate ? (
                <button
                  type="button"
                  onClick={onGenerate}
                  disabled={generating || !canAdvance}
                  className="inline-flex items-center gap-2 px-8 py-2.5 text-sm font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-green-500 to-green-600 text-white shadow-md shadow-green-500/25 hover:shadow-lg hover:shadow-green-500/30"
                >
                  <Play className="w-4 h-4" />
                  Generate Demo Data
                </button>
              ) : currentStep < DEMO_STEP_COUNT ? (
                <button
                  type="button"
                  onClick={onNext}
                  disabled={!canAdvance}
                  data-testid="demo-next-btn"
                  className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md shadow-blue-600/25 hover:shadow-lg hover:shadow-blue-600/30"
                >
                  Continue
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : null}
            </div>
          )}
        </main>
      </div>

      {/* Step transition animation */}
      <style>{`
        @keyframes demoWizardFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .demo-wizard-step-enter {
          animation: demoWizardFadeIn 0.2s ease-out;
        }
      `}</style>
    </div>
  )
}
