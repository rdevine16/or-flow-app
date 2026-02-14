// components/ui/ProcedureIcon.tsx
// Renders a Lucide icon based on procedure category name.
// Used in the cases table to visually distinguish procedure types.

'use client'

import { createElement } from 'react'
import { getProcedureIcon } from '@/lib/constants/procedureIcons'

interface ProcedureIconProps {
  categoryName: string | null | undefined
  size?: number
  className?: string
}

export default function ProcedureIcon({
  categoryName,
  size = 20,
  className = 'text-slate-500',
}: ProcedureIconProps) {
  return createElement(getProcedureIcon(categoryName), { width: size, height: size, className })
}
