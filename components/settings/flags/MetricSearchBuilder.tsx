// components/settings/flags/MetricSearchBuilder.tsx
// Slide-over drawer with 2-step rule builder flow.
// Step 1: Search/browse metrics catalog. Step 2: Configure rule.
// Pattern: Radix Dialog slide-over (matches FlagDrillThrough).

'use client'

import { useState, useCallback } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { MetricSearchStep } from '@/components/settings/flags/MetricSearchStep'
import { RuleConfigureStep } from '@/components/settings/flags/RuleConfigureStep'
import type { CustomRuleFormState, MetricCatalogEntry } from '@/types/flag-settings'

interface MetricSearchBuilderProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (form: CustomRuleFormState) => void
  dynamicMetrics: MetricCatalogEntry[]
}

const INITIAL_FORM: CustomRuleFormState = {
  metricId: '',
  name: '',
  description: '',
  thresholdType: 'absolute',
  operator: 'gt',
  thresholdValue: 90,
  thresholdValueMax: null,
  severity: 'warning',
  comparisonScope: 'facility',
  costCategoryId: null,
}

export function MetricSearchBuilder({
  open,
  onOpenChange,
  onSubmit,
  dynamicMetrics,
}: MetricSearchBuilderProps) {
  const [step, setStep] = useState<'search' | 'configure'>('search')
  const [selectedMetric, setSelectedMetric] = useState<MetricCatalogEntry | undefined>()
  const [form, setForm] = useState<CustomRuleFormState>(INITIAL_FORM)

  const resetState = useCallback(() => {
    setStep('search')
    setSelectedMetric(undefined)
    setForm(INITIAL_FORM)
  }, [])

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) resetState()
      onOpenChange(nextOpen)
    },
    [onOpenChange, resetState]
  )

  const handleSelectMetric = useCallback((metric: MetricCatalogEntry) => {
    setSelectedMetric(metric)

    // Choose initial defaults based on metric capabilities
    const defaultThresholdType = metric.supportsMedian ? 'median_plus_sd' : 'absolute'
    let defaultValue: number
    switch (defaultThresholdType) {
      case 'median_plus_sd':
        defaultValue = 1.0
        break
      case 'absolute':
        defaultValue = metric.dataType === 'currency' ? 500 : metric.dataType === 'percentage' ? 20 : 90
        break
      default:
        defaultValue = 1.0
    }

    setForm({
      ...INITIAL_FORM,
      metricId: metric.id,
      thresholdType: defaultThresholdType,
      thresholdValue: defaultValue,
      costCategoryId: metric.costCategoryId ?? null,
    })
    setStep('configure')
  }, [])

  const handleFormChange = useCallback((updates: Partial<CustomRuleFormState>) => {
    setForm((prev) => ({ ...prev, ...updates }))
  }, [])

  const handleBack = useCallback(() => {
    setStep('search')
    setSelectedMetric(undefined)
    setForm(INITIAL_FORM)
  }, [])

  const handleSubmit = useCallback(() => {
    onSubmit(form)
    resetState()
    onOpenChange(false)
  }, [form, onSubmit, resetState, onOpenChange])

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-[540px] bg-white shadow-[-8px_0_32px_rgba(0,0,0,0.08)] border-l border-slate-200 flex flex-col data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right duration-300"
          aria-describedby={undefined}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && step === 'configure' && form.name.trim()) {
              e.preventDefault()
              handleSubmit()
            }
          }}
        >
          {/* Drawer header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80 shrink-0">
            <div>
              <Dialog.Title className="text-[15px] font-semibold text-slate-900">
                {step === 'search' ? 'Add Custom Rule' : 'Configure Rule'}
              </Dialog.Title>
              <p className="text-xs text-slate-400 mt-0.5">
                {step === 'search'
                  ? 'Select a metric to build a custom flag rule'
                  : 'Configure thresholds and severity for this rule'}
              </p>
            </div>
            <Dialog.Close asChild>
              <button
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                aria-label="Close builder"
              >
                <X className="w-5 h-5" />
              </button>
            </Dialog.Close>
          </div>

          {/* Step content */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {step === 'search' ? (
              <MetricSearchStep
                onSelectMetric={handleSelectMetric}
                dynamicMetrics={dynamicMetrics}
              />
            ) : (
              <RuleConfigureStep
                metric={selectedMetric!}
                form={form}
                onFormChange={handleFormChange}
                onBack={handleBack}
                onSubmit={handleSubmit}
              />
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
