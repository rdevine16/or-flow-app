// lib/SubNavContext.tsx
'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

// Export this so other files can use it
export interface SubNavItem {
  id: string
  label: string
  href: string
  icon?: ReactNode
}

interface SubNavContextType {
  items: SubNavItem[]
  title: string
  activeId: string | null
  isVisible: boolean
  setSubNav: (config: { title: string; items: SubNavItem[]; activeId?: string }) => void
  clearSubNav: () => void
  setActiveId: (id: string) => void
}

const SubNavContext = createContext<SubNavContextType | null>(null)

export function SubNavProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<SubNavItem[]>([])
  const [title, setTitle] = useState('')
  const [activeId, setActiveIdState] = useState<string | null>(null)

  const setSubNav = useCallback(({ 
    title: newTitle, 
    items: newItems, 
    activeId: newActiveId 
  }: { 
    title: string
    items: SubNavItem[]
    activeId?: string 
  }) => {
    setTitle(newTitle)
    setItems(newItems)
    if (newActiveId) setActiveIdState(newActiveId)
  }, [])

  const clearSubNav = useCallback(() => {
    setTitle('')
    setItems([])
    setActiveIdState(null)
  }, [])

  const setActiveId = useCallback((id: string) => {
    setActiveIdState(id)
  }, [])

  const isVisible = items.length > 0

  return (
    <SubNavContext.Provider value={{
      items,
      title,
      activeId,
      isVisible,
      setSubNav,
      clearSubNav,
      setActiveId,
    }}>
      {children}
    </SubNavContext.Provider>
  )
}

export function useSubNav() {
  const context = useContext(SubNavContext)
  if (!context) {
    // Return safe defaults instead of throwing - prevents crash if provider is missing
    return {
      items: [] as SubNavItem[],
      title: '',
      activeId: null,
      isVisible: false,
      setSubNav: () => {},
      clearSubNav: () => {},
      setActiveId: () => {},
    }
  }
  return context
}