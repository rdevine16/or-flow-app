// components/ui/FloatingActionButton.tsx
// Expandable floating action button with action menu

'use client'

import { useState, useEffect, useRef } from 'react'
import { BarChart3, ClipboardList, Clock, Megaphone, Plus, UserPlus, X } from 'lucide-react'

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
      <Plus className="w-5 h-5" />
    ),
    megaphone: (
      <Megaphone className="w-5 h-5" />
    ),
    clipboard: (
      <ClipboardList className="w-5 h-5" />
    ),
    'user-plus': (
      <UserPlus className="w-5 h-5" />
    ),
    clock: (
      <Clock className="w-5 h-5" />
    ),
    chart: (
      <BarChart3 className="w-5 h-5" />
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
                  <ChevronRight className={`w-4 h-4 ${action.disabled ? 'text-slate-300' : 'text-slate-400'}`} />
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
        <Plus className={`w-6 h-6 text-white transition-transform duration-200 ${isOpen ? 'rotate-45' : ''}`} />
      </button>
    </div>
  )
}
