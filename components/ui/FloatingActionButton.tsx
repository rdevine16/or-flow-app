// components/ui/FloatingActionButton.tsx
// Enterprise-style floating action button for quick actions

'use client'

import { useState } from 'react'

interface FloatingActionButtonProps {
  onClick: () => void
  icon?: 'plus' | 'megaphone'
  label?: string
}

export default function FloatingActionButton({ 
  onClick, 
  icon = 'plus',
  label = 'Actions'
}: FloatingActionButtonProps) {
  const [isHovered, setIsHovered] = useState(false)

  const icons = {
    plus: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
    ),
    megaphone: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
      </svg>
    )
  }

  return (
    <div className="fixed bottom-8 right-8 z-50 flex flex-col items-end gap-3">
      {/* Tooltip on hover */}
      {isHovered && label && (
        <div className="px-3 py-1.5 bg-slate-900 text-white text-sm font-medium rounded-lg shadow-lg animate-fade-in">
          {label}
        </div>
      )}

      {/* FAB Button */}
      <button
        onClick={onClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="w-14 h-14 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 
                   text-white rounded-full shadow-lg hover:shadow-xl 
                   flex items-center justify-center
                   transition-all duration-200 ease-out
                   hover:scale-105 active:scale-95
                   focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        aria-label={label}
      >
        {icons[icon]}
      </button>
    </div>
  )
}
