// ============================================
// components/settings/SurgeonClosingWorkflow.tsx
// ============================================
// Add this to your surgeon profile/settings page
// ============================================

'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'

interface SurgeonClosingWorkflowProps {
  surgeonId: string
  initialWorkflow?: 'surgeon_closes' | 'pa_closes'
  initialHandoffMinutes?: number
  onSave?: () => void
}

export default function SurgeonClosingWorkflow({
  surgeonId,
  initialWorkflow = 'surgeon_closes',
  initialHandoffMinutes = 0,
  onSave
}: SurgeonClosingWorkflowProps) {
  const supabase = createClient()
  
  const [workflow, setWorkflow] = useState<'surgeon_closes' | 'pa_closes'>(initialWorkflow)
  const [handoffMinutes, setHandoffMinutes] = useState(initialHandoffMinutes)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Reset saved indicator after 2 seconds
  useEffect(() => {
    if (saved) {
      const timer = setTimeout(() => setSaved(false), 2000)
      return () => clearTimeout(timer)
    }
  }, [saved])

  const handleSave = async () => {
    setSaving(true)
    
    const { error } = await supabase
      .from('users')
      .update({
        closing_workflow: workflow,
        closing_handoff_minutes: workflow === 'pa_closes' ? handoffMinutes : 0
      })
      .eq('id', surgeonId)

    setSaving(false)
    
    if (!error) {
      setSaved(true)
      onSave?.()
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-slate-900">Closing Workflow</h3>
        <p className="text-sm text-slate-500 mt-1">
          Configure how surgical turnover time is calculated for flip room scenarios
        </p>
      </div>

      <div className="space-y-4">
        {/* Option 1: Surgeon closes */}
        <label className="flex items-start gap-3 cursor-pointer group">
          <input
            type="radio"
            name="closing_workflow"
            value="surgeon_closes"
            checked={workflow === 'surgeon_closes'}
            onChange={() => setWorkflow('surgeon_closes')}
            className="mt-1 w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500"
          />
          <div>
            <span className="text-sm font-medium text-slate-900 group-hover:text-blue-600">
              Surgeon closes entirely
            </span>
            <p className="text-xs text-slate-500 mt-0.5">
              Surgical turnover measured from closing complete to next incision
            </p>
          </div>
        </label>

        {/* Option 2: PA closes */}
        <label className="flex items-start gap-3 cursor-pointer group">
          <input
            type="radio"
            name="closing_workflow"
            value="pa_closes"
            checked={workflow === 'pa_closes'}
            onChange={() => setWorkflow('pa_closes')}
            className="mt-1 w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500"
          />
          <div className="flex-1">
            <span className="text-sm font-medium text-slate-900 group-hover:text-blue-600">
              PA closes (surgeon hands off)
            </span>
            <p className="text-xs text-slate-500 mt-0.5">
              Surgical turnover measured from when surgeon leaves to next incision
            </p>
            
            {/* Handoff minutes input - only show when PA closes is selected */}
            {workflow === 'pa_closes' && (
              <div className="mt-3 flex items-center gap-2">
                <label className="text-sm text-slate-600">
                  Surgeon closes for
                </label>
                <input
                  type="number"
                  min="0"
                  max="30"
                  value={handoffMinutes}
                  onChange={(e) => setHandoffMinutes(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-16 px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-center"
                />
                <span className="text-sm text-slate-600">
                  minutes before handoff
                </span>
              </div>
            )}
          </div>
        </label>
      </div>

      {/* Info box */}
      <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
        <p className="text-xs text-blue-700">
          <strong>Tip:</strong> If staff records a "Surgeon Left" milestone during a case, 
          it will override this setting for that specific case.
        </p>
      </div>

      {/* Save button */}
      <div className="mt-6 flex items-center justify-between">
        <div>
          {saved && (
            <span className="text-sm text-green-600 flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Saved
            </span>
          )}
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}