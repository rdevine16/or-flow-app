'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

type LabelMap = Map<string, string>

interface RegisterActions {
  register: (key: string, label: string) => void
  unregister: (key: string) => void
}

/** Read-only context: the current dynamic label map */
const LabelsContext = createContext<LabelMap>(new Map())

/** Write-only context: stable register/unregister functions */
const RegisterContext = createContext<RegisterActions>({
  register: () => {},
  unregister: () => {},
})

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const labelsRef = useRef<LabelMap>(new Map())
  const [labels, setLabels] = useState<LabelMap>(new Map())

  const register = useCallback((key: string, label: string) => {
    if (labelsRef.current.get(key) !== label) {
      const next = new Map(labelsRef.current)
      next.set(key, label)
      labelsRef.current = next
      setLabels(next)
    }
  }, [])

  const unregister = useCallback((key: string) => {
    if (labelsRef.current.has(key)) {
      const next = new Map(labelsRef.current)
      next.delete(key)
      labelsRef.current = next
      setLabels(next)
    }
  }, [])

  const actions = useMemo(() => ({ register, unregister }), [register, unregister])

  return (
    <RegisterContext.Provider value={actions}>
      <LabelsContext.Provider value={labels}>
        {children}
      </LabelsContext.Provider>
    </RegisterContext.Provider>
  )
}

/** Read dynamic label map (consumed by Header) */
export function useBreadcrumbContext(): LabelMap {
  return useContext(LabelsContext)
}

/**
 * Register a dynamic label for a breadcrumb segment.
 * Call from pages that need custom labels (e.g., case detail → "Case #1042").
 * Cleans up on unmount.
 *
 * IMPORTANT: This hook must be called from a component rendered INSIDE
 * <BreadcrumbProvider> (i.e., as a child/descendant of DashboardLayout's
 * children). Calling it from a page component's top level won't work because
 * the page is the PARENT of DashboardLayout. Use <BreadcrumbLabel> instead
 * if you need a render-based alternative.
 */
export function useBreadcrumbLabel(key: string, label: string | undefined): void {
  const { register, unregister } = useContext(RegisterContext)

  useEffect(() => {
    if (label !== undefined) {
      register(key, label)
    }
    return () => {
      unregister(key)
    }
  }, [key, label, register, unregister])
}

/**
 * Render-based alternative to useBreadcrumbLabel.
 * Place this as a child of <DashboardLayout> so it sits inside the BreadcrumbProvider.
 *
 * Usage:
 *   <DashboardLayout>
 *     <BreadcrumbLabel routeKey="/cases/[id]" label={caseData ? `Case #${caseData.case_number}` : undefined} />
 *     {/* page content *\/}
 *   </DashboardLayout>
 */
export function BreadcrumbLabel({ routeKey, label }: { routeKey: string; label: string | undefined }) {
  useBreadcrumbLabel(routeKey, label)
  return null
}
