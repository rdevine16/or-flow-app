// components/ui/FloatingActionButton.tsx
// Expandable floating action button with action menu

'use client'

import { useState, useEffect, useRef } from 'react'

export interface FABAction {
  id: string
  label: string
  icon: 'megaphone' | 'plus' | 'clipboard' | 'user-plus' | 'clock' | 'chart'
  onClick: () => void
  disabled?: boolean
}

interface FloatingActionButtonProps {
  actions: FABAction[]
  label?: string
}

export default function FloatingActionButton({ 
  actions,
  label = 'Quick Actions'
}: FloatingActionButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Close on escape
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  const icons = {
    plus: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
    ),
    megaphone: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
      </svg>
    ),
    clipboard: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
    'user-plus': (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
      </svg>
    ),
    clock: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    chart: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  }

  const handleActionClick = (action: FABAction) => {
    if (action.disabled) return
    setIsOpen(false)
    action.onClick()
  }

  return (
    <div className="fixed bottom-8 right-8 z-50" ref={menuRef}>
      {/* Action Menu */}
      {isOpen && (
        <div className="absolute bottom-16 right-0 mb-2 animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden min-w-[220px]">
            {/* Menu Header */}
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
            </div>
            
            {/* Menu Items */}
            <div className="py-1">
              {actions.map((action, index) => (
                <button
                  key={action.id}
                  onClick={() => handleActionClick(action)}
                  disabled={action.disabled}
                  className={`w-full px-4 py-3 flex items-center gap-3 text-left transition-all
                    ${action.disabled 
                      ? 'opacity-50 cursor-not-allowed bg-slate-50' 
                      : 'hover:bg-blue-50 active:bg-blue-100'
                    }
                    ${index !== actions.length - 1 ? 'border-b border-slate-100' : ''}
                  `}
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors
                    ${action.disabled 
                      ? 'bg-slate-200 text-slate-400' 
                      : 'bg-blue-100 text-blue-600 group-hover:bg-blue-200'
                    }`}
                  >
                    {icons[action.icon]}
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${action.disabled ? 'text-slate-400' : 'text-slate-900'}`}>
                      {action.label}
                    </p>
                  </div>
                  <svg 
                    className={`w-4 h-4 ${action.disabled ? 'text-slate-300' : 'text-slate-400'}`} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ))}
            </div>
          </div>
          
          {/* Arrow pointing to FAB */}
          <div className="absolute -bottom-2 right-6 w-4 h-4 bg-white border-r border-b border-slate-200 transform rotate-45" />
        </div>
      )}

      {/* FAB Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-14 h-14 rounded-full shadow-lg hover:shadow-xl 
                   flex items-center justify-center
                   transition-all duration-200 ease-out
                   hover:scale-105 active:scale-95
                   focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                   ${isOpen 
                     ? 'bg-slate-800 hover:bg-slate-700 rotate-45' 
                     : 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600'
                   }`}
        aria-label={label}
        aria-expanded={isOpen}
      >
        <svg 
          className={`w-6 h-6 text-white transition-transform duration-200 ${isOpen ? 'rotate-0' : ''}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>
    </div>
  )
}
