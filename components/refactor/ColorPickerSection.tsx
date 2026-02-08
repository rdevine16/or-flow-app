// components/refactor/ColorPickerSection.tsx
// Interactive color picker for hardcoded color issues

'use client'

import { useState } from 'react'
import { CheckIcon, ClipboardIcon } from '@heroicons/react/24/outline'

interface ColorToken {
  className: string
  type: 'text' | 'bg' | 'border'
  color: string
  category: string
  hex?: string
}

interface ColorPickerSectionProps {
  issue: {
    metadata?: {
      colorType: 'text' | 'bg' | 'border'
      isConditional: boolean
      conditionVariable: string
      currentColors: {
        active: string
        inactive: string | null
      }
      availableColors: {
        active: ColorToken[]
        inactive: ColorToken[]
      }
    }
  }
}

export function ColorPickerSection({ issue }: ColorPickerSectionProps) {
  const metadata = issue.metadata
  if (!metadata || !metadata.currentColors) return null

  const [selectedActive, setSelectedActive] = useState(metadata.currentColors.active)
  const [selectedInactive, setSelectedInactive] = useState(metadata.currentColors.inactive || '')
  const [copied, setCopied] = useState(false)

  const generateCode = () => {
    if (metadata.isConditional) {
      return `className={\`font-medium \${${metadata.conditionVariable} ? '${selectedActive}' : '${selectedInactive}'}\`}`
    } else {
      return `className="${selectedActive}"`
    }
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(generateCode())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
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
            Active State Color:
          </label>
          <div className="grid grid-cols-4 gap-2">
            {metadata.availableColors.active.slice(0, 12).map((token) => (
              <button
                key={token.className}
                onClick={() => setSelectedActive(token.className)}
                className={`
                  px-3 py-2 rounded-lg text-sm font-mono
                  transition-all border-2
                  ${selectedActive === token.className
                    ? 'border-blue-500 bg-blue-50 shadow-md scale-105'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                  }
                `}
              >
                <div className="flex items-center gap-2">
                  {/* Color swatch */}
                  <div className={`w-4 h-4 rounded ${token.className} border border-slate-300`} />
                  <span className="text-xs truncate">{token.className.replace('text-', '')}</span>
                </div>
              </button>
            ))}
          </div>
          
          {/* Show current selection */}
          <div className="mt-3 p-3 bg-white rounded-lg border border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Selected:</span>
              <div className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded ${selectedActive} border border-slate-300`} />
                <code className="text-sm font-mono text-slate-900">{selectedActive}</code>
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
              {metadata.availableColors.inactive.slice(0, 12).map((token) => (
                <button
                  key={token.className}
                  onClick={() => setSelectedInactive(token.className)}
                  className={`
                    px-3 py-2 rounded-lg text-sm font-mono
                    transition-all border-2
                    ${selectedInactive === token.className
                      ? 'border-blue-500 bg-blue-50 shadow-md scale-105'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                    }
                  `}
                >
                  <div className="flex items-center gap-2">
                    {/* Color swatch */}
                    <div className={`w-4 h-4 rounded ${token.className} border border-slate-300`} />
                    <span className="text-xs truncate">{token.className.replace('text-', '')}</span>
                  </div>
                </button>
              ))}
            </div>
            
            {/* Show current selection */}
            <div className="mt-3 p-3 bg-white rounded-lg border border-slate-200">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Selected:</span>
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded ${selectedInactive} border border-slate-300`} />
                  <code className="text-sm font-mono text-slate-900">{selectedInactive}</code>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Generated Code */}
        <div className="bg-white rounded-lg p-4 border-2 border-blue-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-blue-900">Generated Code:</span>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {copied ? (
                <>
                  <CheckIcon className="w-4 h-4" />
                  Copied!
                </>
              ) : (
                <>
                  <ClipboardIcon className="w-4 h-4" />
                  Copy Code
                </>
              )}
            </button>
          </div>
          
          <div className="bg-slate-900 rounded-lg p-3 overflow-x-auto">
            <pre className="text-sm font-mono text-emerald-400">
              {generateCode()}
            </pre>
          </div>

          {/* Preview */}
          <div className="mt-3 p-3 bg-slate-50 rounded-lg">
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

        {/* Tips */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-xs text-blue-800">
            <strong>💡 Tip:</strong> Choose colors from the same family (e.g., slate-900 and slate-400) 
            for consistent visual hierarchy. Darker shades (700-900) work well for active states.
          </p>
        </div>
      </div>
    </div>
  )
}