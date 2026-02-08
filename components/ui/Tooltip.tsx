// components/ui/Tooltip.tsx
// Professional tooltip component for ORbit
// Replaces ugly browser title tooltips with beautiful, accessible tooltips

'use client'

import React, { useState, useRef, useEffect, ReactNode, cloneElement, isValidElement } from 'react'
import { tokens } from '@/lib/design-tokens'

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

  // Clone child to add event handlers and ref
  const trigger = isValidElement(children)
    ? cloneElement(children as React.ReactElement<any>, {
        ref: triggerRef,
        onMouseEnter: showTooltip,
        onMouseLeave: hideTooltip,
        onFocus: showTooltip,
        onBlur: hideTooltip,
      })
    : children

  if (!content || disabled) {
    return <>{children}</>
  }

  return (
    <>
      {trigger}
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
                <kbd className="px-1.5 py-0.5 bg-slate-700 text-slate-200 text-[10px] rounded font-mono">
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
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
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

