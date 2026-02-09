// components/refactor/ColorPickerSection.tsx
'use client'

import { useState } from 'react'
import { CheckIcon, ClipboardIcon } from '@heroicons/react/24/outline'

interface ColorOption {
  className: string
  displayName: string
  family: string
  shade: string
}

interface ColorPickerSectionProps {
  issue: {
    file: string
    line: number
    metadata?: {
      colorType: 'text'
      isConditional: boolean
      conditionVariable: string
      currentColors: {
        active: string
        inactive: string | null
      }
      suggestedColors: {
        active: ColorOption[]
        inactive: ColorOption[]
      }
    }
  }
  onFixed?: () => void
}

export function ColorPickerSection({ issue, onFixed }: ColorPickerSectionProps) {
  const metadata = issue.metadata
  if (!metadata || !metadata.currentColors) return null

  const [selectedActive, setSelectedActive] = useState(metadata.currentColors.active)
  const [selectedInactive, setSelectedInactive] = useState(metadata.currentColors.inactive || '')
  const [applying, setApplying] = useState(false)
  const [applied, setApplied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Generate the code based on current selections
  const generateCode = () => {
    if (metadata.isConditional) {
      return `className={\`font-medium \${${metadata.conditionVariable} ? '${selectedActive}' : '${selectedInactive}'}\`}`
    } else {
      return `className="${selectedActive}"`
    }
  }

  // Auto-apply the fix
  const handleApply = async () => {
    setApplying(true)
    setError(null)
    
    try {
      const response = await fetch('/api/refactor/apply-color', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file: issue.file,
          line: issue.line,
          oldActiveColor: metadata.currentColors.active,
          newActiveColor: selectedActive,
          oldInactiveColor: metadata.currentColors.inactive,
          newInactiveColor: selectedInactive,
          isConditional: metadata.isConditional,
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to apply fix')
      }

      setApplied(true)
      if (onFixed) onFixed()
      
      // Show success for 2 seconds
      setTimeout(() => setApplied(false), 2000)
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply fix')
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="p-6 bg-gradient-to-br from-purple-50 to-pink-50 border-b border-slate-200">
      <h4 className="font-semibold text-slate-900 flex items-center gap-2 mb-4">
        <span className="text-xl">🎨</span>
        Pick Your Colors
      </h4>

      <div className="space-y-6">
        {/* Active Color Selection */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-3">
            {metadata.isConditional ? 'Active State Color:' : 'Text Color:'}
          </label>
          <div className="grid grid-cols-4 gap-2">
            {metadata.suggestedColors.active.map((color) => (
              <button
                key={color.className}
                onClick={() => setSelectedActive(color.className)}
                className={`
                  px-3 py-3 rounded-lg text-xs font-mono
                  transition-all border-2 flex flex-col items-center gap-2
                  ${selectedActive === color.className
                    ? 'border-blue-500 bg-blue-50 shadow-md scale-105'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                  }
                `}
              >
                {/* Color swatch */}
                <div className="w-full h-8 rounded flex items-center justify-center bg-white border border-slate-300">
                  <span className={`${color.className} font-semibold text-sm`}>
                    Aa
                  </span>
                </div>
                <span className="text-xs truncate w-full text-center">
                  {color.displayName}
                </span>
              </button>
            ))}
          </div>
          
          {/* Current selection display */}
          <div className="mt-3 p-3 bg-white rounded-lg border border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Selected:</span>
              <div className="flex items-center gap-3">
                <span className={`${selectedActive} font-medium text-lg`}>
                  Sample Text
                </span>
                <code className="text-xs font-mono text-slate-700 bg-slate-100 px-2 py-1 rounded">
                  {selectedActive}
                </code>
              </div>
            </div>
          </div>
        </div>

        {/* Inactive Color Selection (if conditional) */}
        {metadata.isConditional && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-3">
              Inactive State Color:
            </label>
            <div className="grid grid-cols-4 gap-2">
              {metadata.suggestedColors.inactive.map((color) => (
                <button
                  key={color.className}
                  onClick={() => setSelectedInactive(color.className)}
                  className={`
                    px-3 py-3 rounded-lg text-xs font-mono
                    transition-all border-2 flex flex-col items-center gap-2
                    ${selectedInactive === color.className
                      ? 'border-blue-500 bg-blue-50 shadow-md scale-105'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                    }
                  `}
                >
                  {/* Color swatch */}
                  <div className="w-full h-8 rounded flex items-center justify-center bg-white border border-slate-300">
                    <span className={`${color.className} font-semibold text-sm`}>
                      Aa
                    </span>
                  </div>
                  <span className="text-xs truncate w-full text-center">
                    {color.displayName}
                  </span>
                </button>
              ))}
            </div>
            
            {/* Current selection display */}
            <div className="mt-3 p-3 bg-white rounded-lg border border-slate-200">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Selected:</span>
                <div className="flex items-center gap-3">
                  <span className={`${selectedInactive} font-medium text-lg`}>
                    Sample Text
                  </span>
                  <code className="text-xs font-mono text-slate-700 bg-slate-100 px-2 py-1 rounded">
                    {selectedInactive}
                  </code>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Generated Code Preview */}
        <div className="bg-white rounded-lg p-4 border-2 border-blue-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-blue-900">Generated Code:</span>
          </div>
          
          <div className="bg-slate-900 rounded-lg p-3 overflow-x-auto mb-3">
            <pre className="text-sm font-mono text-emerald-400">
              {generateCode()}
            </pre>
          </div>

          {/* Preview */}
          <div className="p-3 bg-slate-50 rounded-lg">
            <p className="text-xs text-slate-600 mb-2">Preview:</p>
            <div className="flex gap-4">
              <div>
                <p className="text-xs text-slate-500 mb-1">Active:</p>
                <p className={`${selectedActive} font-medium`}>Sample Text</p>
              </div>
              {metadata.isConditional && (
                <div>
                  <p className="text-xs text-slate-500 mb-1">Inactive:</p>
                  <p className={`${selectedInactive} font-medium`}>Sample Text</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Apply Button */}
        <div className="flex items-center justify-between">
          {error && (
            <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg flex-1 mr-3">
              {error}
            </div>
          )}
          
          <button
            onClick={handleApply}
            disabled={applying || applied}
            className={`
              px-6 py-3 rounded-lg font-medium transition-all flex items-center gap-2
              ${applied
                ? 'bg-green-600 text-white'
                : applying
                ? 'bg-blue-400 text-white cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
              }
            `}
          >
            {applying ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Applying...
              </>
            ) : applied ? (
              <>
                <CheckIcon className="w-5 h-5" />
                Applied!
              </>
            ) : (
              <>
                Apply Fix to Code
              </>
            )}
          </button>
        </div>

        {/* Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-xs text-blue-800">
            <strong>💡 Auto-Apply:</strong> This will update {issue.file} line {issue.line} with your selected colors.
            {metadata.isConditional && ' Make sure to select both active and inactive colors.'}
          </p>
        </div>
      </div>
    </div>
  )
}
