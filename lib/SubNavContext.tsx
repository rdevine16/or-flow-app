// lib/SubNavContext.tsx
// Context for pages to register their sub-navigation (Panel 2 in Supabase-style layout)

'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

interface SubNavItem {
  id: string
  label: string
  href: string
  icon?: ReactNode
}

interface SubNavContextType {
  // The items to show in the sub-nav
  items: SubNavItem[]
  // Title shown at top of sub-nav
  title: string
  // Currently active item id
  activeId: string | null
  // Whether sub-nav should be visible
  isVisible: boolean
  // Methods for pages to register their sub-nav
  setSubNav: (config: { title: string; items: SubNavItem[]; activeId?: string }) => void
  clearSubNav: () => void
  setActiveId: (id: string) => void
}

const SubNavContext = createContext<SubNavContextType>({
  items: [],
  title: '',
  activeId: null,
  isVisible: false,
  setSubNav: () => {},
  clearSubNav: () => {},
  setActiveId: () => {},
})

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
    throw new Error('useSubNav must be used within a SubNavProvider')
  }
  return context
}

// Hook for pages to easily set up their sub-nav
export function useRegisterSubNav(config: {
  title: string
  items: SubNavItem[]
  activeId: string
}) {
  const { setSubNav, clearSubNav } = useSubNav()
  
  // Register on mount, clear on unmount
  // Using useEffect in the consuming component
  return { setSubNav, clearSubNav, config }
}
