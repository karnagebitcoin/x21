import { DEFAULT_LAYOUT_MODE, LAYOUT_MODE, StorageKey } from '@/constants'
import { TLayoutMode } from '@/types'
import { createContext, ReactNode, useContext, useEffect, useState } from 'react'

interface ILayoutModeContext {
  layoutMode: TLayoutMode
  setLayoutMode: (mode: TLayoutMode) => void
}

const LayoutModeContext = createContext<ILayoutModeContext | undefined>(undefined)

export function LayoutModeProvider({ children }: { children: ReactNode }) {
  const [layoutMode, _setLayoutMode] = useState<TLayoutMode>(() => {
    const stored = window.localStorage.getItem(StorageKey.LAYOUT_MODE)
    return (stored as TLayoutMode) || DEFAULT_LAYOUT_MODE
  })

  useEffect(() => {
    window.localStorage.setItem(StorageKey.LAYOUT_MODE, layoutMode)
  }, [layoutMode])

  const setLayoutMode = (mode: TLayoutMode) => {
    if (mode === LAYOUT_MODE.BOXED || mode === LAYOUT_MODE.FULL_WIDTH || mode === LAYOUT_MODE.ISLAND) {
      _setLayoutMode(mode)
    }
  }

  return (
    <LayoutModeContext.Provider value={{ layoutMode, setLayoutMode }}>
      {children}
    </LayoutModeContext.Provider>
  )
}

export function useLayoutMode() {
  const context = useContext(LayoutModeContext)
  if (!context) {
    throw new Error('useLayoutMode must be used within a LayoutModeProvider')
  }
  return context
}
