import { StorageKey } from '@/constants'
import { createContext, useContext, useState } from 'react'

type TCollapseLongNotesContext = {
  collapseLongNotes: boolean
  setCollapseLongNotes: (collapse: boolean) => void
}

const CollapseLongNotesContext = createContext<TCollapseLongNotesContext | undefined>(undefined)

export const useCollapseLongNotes = () => {
  const context = useContext(CollapseLongNotesContext)
  if (!context) {
    throw new Error('useCollapseLongNotes must be used within a CollapseLongNotesProvider')
  }
  return context
}

export function CollapseLongNotesProvider({ children }: { children: React.ReactNode }) {
  const [collapseLongNotes, setCollapseLongNotesState] = useState<boolean>(() => {
    const stored = window.localStorage.getItem(StorageKey.COLLAPSE_LONG_NOTES)
    return stored === null ? true : stored === 'true'
  })

  const setCollapseLongNotes = (collapse: boolean) => {
    setCollapseLongNotesState(collapse)
    window.localStorage.setItem(StorageKey.COLLAPSE_LONG_NOTES, collapse.toString())
  }

  return (
    <CollapseLongNotesContext.Provider value={{ collapseLongNotes, setCollapseLongNotes }}>
      {children}
    </CollapseLongNotesContext.Provider>
  )
}
