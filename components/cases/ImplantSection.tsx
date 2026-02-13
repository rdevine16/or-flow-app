'use client'

import { useState, useEffect } from 'react'
import { SupabaseClient } from '@supabase/supabase-js'

interface ImplantSectionProps {
  caseId: string
  procedureTypeId: string | null
  supabase: SupabaseClient
  readOnly?: boolean
}

interface ImplantData {
  id?: string
  case_id: string
  fixation_type: string | null
  // Hip
  cup_brand: string | null
  cup_size_templated: string | null
  cup_size_final: string | null
  stem_brand: string | null
  stem_size_templated: string | null
  stem_size_final: string | null
  head_size_templated: string | null
  head_size_final: string | null
  liner_size_templated: string | null
  liner_size_final: string | null
  // Knee
  femur_brand: string | null
  femur_type: string | null
  femur_size_templated: string | null
  femur_size_final: string | null
  tibia_brand: string | null
  tibia_size_templated: string | null
  tibia_size_final: string | null
  poly_brand: string | null
  poly_size_templated: string | null
  poly_size_final: string | null
  patella_brand: string | null
  patella_type: string | null
  patella_size_templated: string | null
  patella_size_final: string | null
}

const EMPTY_IMPLANT: Omit<ImplantData, 'case_id'> = {
  fixation_type: null,
  cup_brand: null,
  cup_size_templated: null,
  cup_size_final: null,
  stem_brand: null,
  stem_size_templated: null,
  stem_size_final: null,
  head_size_templated: null,
  head_size_final: null,
  liner_size_templated: null,
  liner_size_final: null,
  femur_brand: null,
  femur_type: null,
  femur_size_templated: null,
  femur_size_final: null,
  tibia_brand: null,
  tibia_size_templated: null,
  tibia_size_final: null,
  poly_brand: null,
  poly_size_templated: null,
  poly_size_final: null,
  patella_brand: null,
  patella_type: null,
  patella_size_templated: null,
  patella_size_final: null,
}

// Input component for size fields with templated/final
function SizeInput({ 
  label, 
  templatedValue, 
  finalValue, 
  onTemplatedChange, 
  onFinalChange,
  readOnly 
}: {
  label: string
  templatedValue: string | null
  finalValue: string | null
  onTemplatedChange: (val: string) => void
  onFinalChange: (val: string) => void
  readOnly?: boolean
}) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-slate-600">{label}</label>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <input
            type="text"
            value={templatedValue || ''}
            onChange={(e) => onTemplatedChange(e.target.value)}
            placeholder="Templated"
            disabled={readOnly}
            className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
          />
        </div>
        <div>
          <input
            type="text"
            value={finalValue || ''}
            onChange={(e) => onFinalChange(e.target.value)}
            placeholder="Final"
            disabled={readOnly}
            className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
          />
        </div>
      </div>
    </div>
  )
}

// Brand input component
function BrandInput({
  label,
  value,
  onChange,
  readOnly
}: {
  label: string
  value: string | null
  onChange: (val: string) => void
  readOnly?: boolean
}) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-slate-600">{label}</label>
      <input
        type="text"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Enter brand"
        disabled={readOnly}
        className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
      />
    </div>
  )
}

export default function ImplantSection({ caseId, procedureTypeId, supabase, readOnly = false }: ImplantSectionProps) {
  const [implantCategory, setImplantCategory] = useState<string | null>(null)
  const [implantData, setImplantData] = useState<ImplantData>({ case_id: caseId, ...EMPTY_IMPLANT })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)

  // Fetch procedure's implant category
  useEffect(() => {
    async function fetchCategory() {
      if (!procedureTypeId) {
        setImplantCategory(null)
        setLoading(false)
        return
      }

      const { data } = await supabase
        .from('procedure_types')
        .select('implant_category')
        .eq('id', procedureTypeId)
        .single()

      setImplantCategory(data?.implant_category || null)
    }
    fetchCategory()
  }, [procedureTypeId, supabase])

  // Fetch existing implant data
  useEffect(() => {
    async function fetchImplantData() {
      const { data } = await supabase
        .from('case_implants')
        .select('*')
        .eq('case_id', caseId)
        .single()

      if (data) {
        setImplantData(data)
      } else {
        setImplantData({ case_id: caseId, ...EMPTY_IMPLANT })
      }
      setLoading(false)
    }
    fetchImplantData()
  }, [caseId, supabase])

  // Auto-save with debounce
  useEffect(() => {
    if (!hasChanges || readOnly) return

    const timer = setTimeout(async () => {
      await saveImplantData()
    }, 1000)

    return () => clearTimeout(timer)
  }, [implantData, hasChanges])

  const saveImplantData = async () => {
    setSaving(true)
    
    if (implantData.id) {
      // Update existing
      await supabase
        .from('case_implants')
        .update(implantData)
        .eq('id', implantData.id)
    } else {
      // Insert new
      const { data } = await supabase
        .from('case_implants')
        .insert(implantData)
        .select()
        .single()
      
      if (data) {
        setImplantData(data)
      }
    }
    
    setSaving(false)
    setHasChanges(false)
    setLastSaved(new Date())
  }

  const updateField = (field: keyof ImplantData, value: string | null) => {
    setImplantData(prev => ({ ...prev, [field]: value || null }))
    setHasChanges(true)
  }

  // Don't show if no implant category set for this procedure
  if (!implantCategory) {
    if (loading) {
      return (
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="animate-pulse flex items-center gap-2">
            <div className="w-4 h-4 bg-slate-200 rounded" />
            <div className="h-4 w-32 bg-slate-200 rounded" />
          </div>
        </div>
      )
    }
    return null // No implant tracking for this procedure type
  }

  const isHip = implantCategory === 'total_hip'
  const isKnee = implantCategory === 'total_knee'

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
          </svg>
          <h3 className="text-sm font-semibold text-slate-900">
            {isHip ? 'Hip Implants' : 'Knee Implants'}
          </h3>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {saving && (
            <span className="text-amber-600 flex items-center gap-1">
              <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Saving...
            </span>
          )}
          {!saving && lastSaved && (
            <span className="text-green-600 flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Saved
            </span>
          )}
        </div>
      </div>

      <div className="p-4">
        {/* Fixation Type */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-slate-600 mb-1">Fixation Type</label>
          <div className="flex gap-2">
            {['cemented', 'pressfit'].map(type => (
              <button
                key={type}
                type="button"
                onClick={() => !readOnly && updateField('fixation_type', type)}
                disabled={readOnly}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
                  implantData.fixation_type === type
                    ? 'bg-blue-50 border-blue-200 text-blue-700'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                } ${readOnly ? 'cursor-not-allowed opacity-60' : ''}`}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Column Headers */}
        <div className="grid grid-cols-2 gap-2 mb-2 px-1">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider text-center">Templated</div>
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider text-center">Final</div>
        </div>

        {/* Hip Components */}
        {isHip && (
          <div className="space-y-4">
            <div className="p-3 bg-slate-50 rounded-lg space-y-3">
              <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Acetabular Cup</p>
              <BrandInput label="Brand" value={implantData.cup_brand} onChange={(v) => updateField('cup_brand', v)} readOnly={readOnly} />
              <SizeInput
                label="Size"
                templatedValue={implantData.cup_size_templated}
                finalValue={implantData.cup_size_final}
                onTemplatedChange={(v) => updateField('cup_size_templated', v)}
                onFinalChange={(v) => updateField('cup_size_final', v)}
                readOnly={readOnly}
              />
            </div>

            <div className="p-3 bg-slate-50 rounded-lg space-y-3">
              <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Femoral Stem</p>
              <BrandInput label="Brand" value={implantData.stem_brand} onChange={(v) => updateField('stem_brand', v)} readOnly={readOnly} />
              <SizeInput
                label="Size"
                templatedValue={implantData.stem_size_templated}
                finalValue={implantData.stem_size_final}
                onTemplatedChange={(v) => updateField('stem_size_templated', v)}
                onFinalChange={(v) => updateField('stem_size_final', v)}
                readOnly={readOnly}
              />
            </div>

            <div className="p-3 bg-slate-50 rounded-lg space-y-3">
              <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Femoral Head</p>
              <SizeInput
                label="Size"
                templatedValue={implantData.head_size_templated}
                finalValue={implantData.head_size_final}
                onTemplatedChange={(v) => updateField('head_size_templated', v)}
                onFinalChange={(v) => updateField('head_size_final', v)}
                readOnly={readOnly}
              />
            </div>

            <div className="p-3 bg-slate-50 rounded-lg space-y-3">
              <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Liner</p>
              <SizeInput
                label="Size"
                templatedValue={implantData.liner_size_templated}
                finalValue={implantData.liner_size_final}
                onTemplatedChange={(v) => updateField('liner_size_templated', v)}
                onFinalChange={(v) => updateField('liner_size_final', v)}
                readOnly={readOnly}
              />
            </div>
          </div>
        )}

        {/* Knee Components */}
        {isKnee && (
          <div className="space-y-4">
            <div className="p-3 bg-slate-50 rounded-lg space-y-3">
              <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Femoral Component</p>
              <BrandInput label="Brand" value={implantData.femur_brand} onChange={(v) => updateField('femur_brand', v)} readOnly={readOnly} />
              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-600">Type</label>
                <div className="flex gap-2">
                  {['PS', 'CR'].map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => !readOnly && updateField('femur_type', type)}
                      disabled={readOnly}
                      className={`px-3 py-1 text-xs font-medium rounded border transition-colors ${
                        implantData.femur_type === type
                          ? 'bg-blue-50 border-blue-200 text-blue-700'
                          : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                      } ${readOnly ? 'cursor-not-allowed opacity-60' : ''}`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
              <SizeInput
                label="Size"
                templatedValue={implantData.femur_size_templated}
                finalValue={implantData.femur_size_final}
                onTemplatedChange={(v) => updateField('femur_size_templated', v)}
                onFinalChange={(v) => updateField('femur_size_final', v)}
                readOnly={readOnly}
              />
            </div>

            <div className="p-3 bg-slate-50 rounded-lg space-y-3">
              <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Tibial Component</p>
              <BrandInput label="Brand" value={implantData.tibia_brand} onChange={(v) => updateField('tibia_brand', v)} readOnly={readOnly} />
              <SizeInput
                label="Size"
                templatedValue={implantData.tibia_size_templated}
                finalValue={implantData.tibia_size_final}
                onTemplatedChange={(v) => updateField('tibia_size_templated', v)}
                onFinalChange={(v) => updateField('tibia_size_final', v)}
                readOnly={readOnly}
              />
            </div>

            <div className="p-3 bg-slate-50 rounded-lg space-y-3">
              <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Poly Insert</p>
              <BrandInput label="Brand" value={implantData.poly_brand} onChange={(v) => updateField('poly_brand', v)} readOnly={readOnly} />
              <SizeInput
                label="Size"
                templatedValue={implantData.poly_size_templated}
                finalValue={implantData.poly_size_final}
                onTemplatedChange={(v) => updateField('poly_size_templated', v)}
                onFinalChange={(v) => updateField('poly_size_final', v)}
                readOnly={readOnly}
              />
            </div>

            <div className="p-3 bg-slate-50 rounded-lg space-y-3">
              <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Patella</p>
              <BrandInput label="Brand" value={implantData.patella_brand} onChange={(v) => updateField('patella_brand', v)} readOnly={readOnly} />
              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-600">Type</label>
                <div className="flex gap-2">
                  {['asymmetric', 'symmetric'].map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => !readOnly && updateField('patella_type', type)}
                      disabled={readOnly}
                      className={`px-3 py-1 text-xs font-medium rounded border transition-colors ${
                        implantData.patella_type === type
                          ? 'bg-blue-50 border-blue-200 text-blue-700'
                          : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                      } ${readOnly ? 'cursor-not-allowed opacity-60' : ''}`}
                    >
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <SizeInput
                label="Size"
                templatedValue={implantData.patella_size_templated}
                finalValue={implantData.patella_size_final}
                onTemplatedChange={(v) => updateField('patella_size_templated', v)}
                onFinalChange={(v) => updateField('patella_size_final', v)}
                readOnly={readOnly}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
