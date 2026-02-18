// components/ui/Tooltip.tsx
// Professional tooltip component for ORbit
// Replaces ugly browser title tooltips with beautiful, accessible tooltips

'use client'

import React, { useState, useRef, useEffect, ReactNode } from 'react'
import { tokens } from '@/lib/design-tokens'
import { HelpCircle, Info } from 'lucide-react'

/**
 * USAGE:
 * 
 * Basic:
 *   <Tooltip content="Delete case">
 *     <button>🗑️</button>
 *   </Tooltip>
 * 
 * With position:
 *   <Tooltip content="View details" position="bottom">
 *     <IconButton icon={<EyeIcon />} />
 *   </Tooltip>
 * 
 * Delayed:
 *   <Tooltip content="This shows after 500ms" delay={500}>
 *     <span>Hover me</span>
 *   </Tooltip>
 * 
 * With keyboard shortcut:
 *   <Tooltip content="Save" shortcut="⌘S">
 *     <Button>Save</Button>
 *   </Tooltip>
 */

// ============================================
// TYPES
// ============================================

export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right'

interface TooltipProps {
  content: ReactNode
  children: ReactNode
  position?: TooltipPosition
  delay?: number
  disabled?: boolean
  shortcut?: string
  maxWidth?: number
}

// ============================================
// TOOLTIP COMPONENT
// ============================================

export function Tooltip({
  content,
  children,
  position = 'top',
  delay = 200,
  disabled = false,
  shortcut,
  maxWidth = 200,
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [calculatedPosition, setCalculatedPosition] = useState<TooltipPosition>(position)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const triggerRef = useRef<HTMLElement | null>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  // Calculate position to avoid viewport edges
  useEffect(() => {
    if (!isVisible || !triggerRef.current || !tooltipRef.current) return

    const trigger = triggerRef.current.getBoundingClientRect()
    const tooltip = tooltipRef.current.getBoundingClientRect()
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight,
    }

    let newPosition = position

    // Check if tooltip would overflow viewport
    if (position === 'top' && trigger.top - tooltip.height < 10) {
      newPosition = 'bottom'
    } else if (position === 'bottom' && trigger.bottom + tooltip.height > viewport.height - 10) {
      newPosition = 'top'
    } else if (position === 'left' && trigger.left - tooltip.width < 10) {
      newPosition = 'right'
    } else if (position === 'right' && trigger.right + tooltip.width > viewport.width - 10) {
      newPosition = 'left'
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCalculatedPosition(newPosition)
  }, [isVisible, position])

  const showTooltip = () => {
    if (disabled) return
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true)
    }, delay)
  }

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    setIsVisible(false)
  }

  if (!content || disabled) {
    return <>{children}</>
  }

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
        style={{ display: 'inline-block' }}
      >
        {children}
      </span>
      {isVisible && (
        <TooltipContent
          ref={tooltipRef}
          content={content}
          triggerRef={triggerRef}
          position={calculatedPosition}
          shortcut={shortcut}
          maxWidth={maxWidth}
        />
      )}
    </>
  )
}

// ============================================
// TOOLTIP CONTENT
// ============================================

interface TooltipContentProps {
  content: ReactNode
  triggerRef: React.RefObject<HTMLElement | null>
  position: TooltipPosition
  shortcut?: string
  maxWidth: number
}

const TooltipContent = React.forwardRef<HTMLDivElement, TooltipContentProps>(
  ({ content, triggerRef, position, shortcut, maxWidth }, ref) => {
    const [coords, setCoords] = useState({ top: 0, left: 0 })

    useEffect(() => {
      if (!triggerRef.current) return

      const trigger = triggerRef.current.getBoundingClientRect()
      const gap = 8 // Space between trigger and tooltip

      let top = 0
      let left = 0

      switch (position) {
        case 'top':
          top = trigger.top - gap + window.scrollY
          left = trigger.left + trigger.width / 2 + window.scrollX
          break
        case 'bottom':
          top = trigger.bottom + gap + window.scrollY
          left = trigger.left + trigger.width / 2 + window.scrollX
          break
        case 'left':
          top = trigger.top + trigger.height / 2 + window.scrollY
          left = trigger.left - gap + window.scrollX
          break
        case 'right':
          top = trigger.top + trigger.height / 2 + window.scrollY
          left = trigger.right + gap + window.scrollX
          break
      }

      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCoords({ top, left })
    }, [triggerRef, position])

    const positionClasses = {
      top: '-translate-x-1/2 -translate-y-full',
      bottom: '-translate-x-1/2',
      left: '-translate-x-full -translate-y-1/2',
      right: '-translate-y-1/2',
    }

    const arrowClasses = {
      top: 'bottom-[-4px] left-1/2 -translate-x-1/2 border-t-slate-900 border-x-transparent border-b-transparent',
      bottom: 'top-[-4px] left-1/2 -translate-x-1/2 border-b-slate-900 border-x-transparent border-t-transparent',
      left: 'right-[-4px] top-1/2 -translate-y-1/2 border-l-slate-900 border-y-transparent border-r-transparent',
      right: 'left-[-4px] top-1/2 -translate-y-1/2 border-r-slate-900 border-y-transparent border-l-transparent',
    }

    return (
      <div
        ref={ref}
        role="tooltip"
        className={`
          fixed pointer-events-none
          ${positionClasses[position]}
          animate-in fade-in duration-150
        `}
        style={{
          top: coords.top,
          left: coords.left,
          zIndex: tokens.zIndex.tooltip,
          maxWidth: `${maxWidth}px`,
        }}
      >
        {/* Tooltip box */}
        <div className="relative">
          <div className="bg-slate-900 text-white text-xs font-medium px-2.5 py-1.5 rounded-lg shadow-lg">
            <div className="flex items-center gap-2">
              <span>{content}</span>
              {shortcut && (
                <kbd className="px-1.5 py-0.5 bg-slate-700 text-slate-200 text-xs rounded font-mono">
                  {shortcut}
                </kbd>
              )}
            </div>
          </div>

          {/* Arrow */}
          <div
            className={`absolute w-0 h-0 border-4 ${arrowClasses[position]}`}
            style={{ borderStyle: 'solid' }}
          />
        </div>
      </div>
    )
  }
)
TooltipContent.displayName = 'TooltipContent'

// ============================================
// TOOLTIP VARIANTS
// ============================================

/**
 * Icon button with tooltip
 * Common pattern for action buttons
 */
interface TooltipIconButtonProps {
  tooltip: string
  icon: ReactNode
  onClick?: () => void
  variant?: 'default' | 'danger' | 'primary'
  shortcut?: string
  disabled?: boolean
  'aria-label': string
}

export function TooltipIconButton({
  tooltip,
  icon,
  onClick,
  variant = 'default',
  shortcut,
  disabled,
  'aria-label': ariaLabel,
}: TooltipIconButtonProps) {
  const variantClasses = {
    default: 'text-slate-400 hover:text-slate-600 hover:bg-slate-100',
    danger: 'text-slate-400 hover:text-red-600 hover:bg-red-50',
    primary: 'text-blue-600 hover:text-blue-700 hover:bg-blue-50',
  }

  return (
    <Tooltip content={tooltip} shortcut={shortcut} disabled={disabled}>
      <button
        onClick={onClick}
        disabled={disabled}
        aria-label={ariaLabel}
        className={`
          p-2 rounded-lg transition-colors
          disabled:opacity-50 disabled:cursor-not-allowed
          ${variantClasses[variant]}
        `}
      >
        {icon}
      </button>
    </Tooltip>
  )
}

/**
 * Help icon with tooltip
 * Common pattern for form field help
 */
interface TooltipHelpProps {
  content: ReactNode
  maxWidth?: number
}

export function TooltipHelp({ content, maxWidth = 250 }: TooltipHelpProps) {
  return (
    <Tooltip content={content} position="top" maxWidth={maxWidth}>
      <button
        type="button"
        className="inline-flex items-center justify-center w-4 h-4 text-slate-400 hover:text-slate-600 transition-colors"
        aria-label="Help"
      >
        <HelpCircle className="w-4 h-4" />
      </button>
    </Tooltip>
  )
}

/**
 * Truncated text with tooltip
 * Shows full text on hover
 */
interface TooltipTruncateProps {
  text: string
  maxLength: number
  className?: string
}

export function TooltipTruncate({ text, maxLength, className = '' }: TooltipTruncateProps) {
  const needsTooltip = text.length > maxLength
  const displayText = needsTooltip ? `${text.slice(0, maxLength)}...` : text

  if (!needsTooltip) {
    return <span className={className}>{text}</span>
  }

  return (
    <Tooltip content={text} maxWidth={300}>
      <span className={className}>{displayText}</span>
    </Tooltip>
  )
}


// ============================================
// INFO TOOLTIP — Click-to-toggle (i) icon with
// fixed-position popover that escapes overflow-hidden
// ============================================

interface InfoTooltipProps {
  /** Tooltip body — string or JSX */
  text: ReactNode
  /** Max width in pixels */
  maxWidth?: number
  /** Icon size class */
  iconSize?: string
}

export function InfoTooltip({ text, maxWidth = 280, iconSize = 'w-3.5 h-3.5' }: InfoTooltipProps) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<'above' | 'below'>('below')
  const [coords, setCoords] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  // Calculate position when opened
  useEffect(() => {
    if (!open || !triggerRef.current) return

    const rect = triggerRef.current.getBoundingClientRect()
    const gap = 8
    const estimatedHeight = 80 // rough estimate; recalculated after render

    // Prefer below; flip above if near viewport bottom
    const showAbove = rect.bottom + estimatedHeight + gap > window.innerHeight
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPosition(showAbove ? 'above' : 'below')

    setCoords({
      top: showAbove
        ? rect.top + window.scrollY - gap
        : rect.bottom + window.scrollY + gap,
      left: rect.left + rect.width / 2 + window.scrollX,
    })
  }, [open])

  // Refine position after popover renders (actual height now known)
  useEffect(() => {
    if (!open || !popoverRef.current || !triggerRef.current) return

    const rect = triggerRef.current.getBoundingClientRect()
    const popRect = popoverRef.current.getBoundingClientRect()
    const gap = 8

    // Check if it overflows viewport bottom
    if (position === 'below' && popRect.bottom > window.innerHeight - 10) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPosition('above')
      setCoords(prev => ({
        ...prev,
        top: rect.top + window.scrollY - gap,
      }))
    }

    // Clamp horizontal so it doesn't overflow viewport edges
    const halfWidth = popRect.width / 2
    const centerX = rect.left + rect.width / 2
    if (centerX - halfWidth < 10) {
      setCoords(prev => ({ ...prev, left: halfWidth + 10 }))
    } else if (centerX + halfWidth > window.innerWidth - 10) {
      setCoords(prev => ({ ...prev, left: window.innerWidth - halfWidth - 10 }))
    }
  }, [open, position])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target as Node) &&
        popoverRef.current && !popoverRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open])

  return (
    <>
      <button
        ref={triggerRef}
        onClick={() => setOpen(!open)}
        className="text-slate-300 hover:text-slate-500 transition-colors focus:outline-none"
        aria-label="More info"
        type="button"
      >
        <Info className={iconSize} />
      </button>

      {open && (
        <div
          ref={popoverRef}
          className={`fixed z-[100] -translate-x-1/2 ${
            position === 'above' ? '-translate-y-full' : ''
          }`}
          style={{
            top: coords.top,
            left: coords.left,
            maxWidth: `${maxWidth}px`,
          }}
        >
          <div className="relative">
            <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3.5 py-2.5 text-xs leading-relaxed text-slate-600">
              {text}
            </div>
            {/* Arrow */}
            <div
              className={`absolute left-1/2 -translate-x-1/2 w-0 h-0 ${
                position === 'above'
                  ? 'bottom-[-5px] border-l-[5px] border-r-[5px] border-t-[5px] border-l-transparent border-r-transparent border-t-slate-200'
                  : 'top-[-5px] border-l-[5px] border-r-[5px] border-b-[5px] border-l-transparent border-r-transparent border-b-slate-200'
              }`}
              style={{ borderStyle: 'solid' }}
            />
            <div
              className={`absolute left-1/2 -translate-x-1/2 w-0 h-0 ${
                position === 'above'
                  ? 'bottom-[-4px] border-l-[5px] border-r-[5px] border-t-[5px] border-l-transparent border-r-transparent border-t-white'
                  : 'top-[-4px] border-l-[5px] border-r-[5px] border-b-[5px] border-l-transparent border-r-transparent border-b-white'
              }`}
              style={{ borderStyle: 'solid' }}
            />
          </div>
        </div>
      )}
    </>
  )
}