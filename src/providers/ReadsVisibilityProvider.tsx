import storage from '@/services/local-storage.service'
import { createContext, useContext, useState } from 'react'

type TReadsVisibilityContext = {
  hideReadsInNavigation: boolean
  setHideReadsInNavigation: (hide: boolean) => void
  hideReadsInProfiles: boolean
  setHideReadsInProfiles: (hide: boolean) => void
}

const ReadsVisibilityContext = createContext<TReadsVisibilityContext | undefined>(undefined)

export const useReadsVisibility = () => {
  const context = useContext(ReadsVisibilityContext)
  if (!context) {
    throw new Error('useReadsVisibility must be used within a ReadsVisibilityProvider')
  }
  return context
}

export function ReadsVisibilityProvider({ children }: { children: React.ReactNode }) {
  const [hideReadsInNavigation, setHideReadsInNavigationState] = useState(
    storage.getHideReadsInNavigation()
  )
  const [hideReadsInProfiles, setHideReadsInProfilesState] = useState(
    storage.getHideReadsInProfiles()
  )

  const setHideReadsInNavigation = (hide: boolean) => {
    setHideReadsInNavigationState(hide)
    storage.setHideReadsInNavigation(hide)
  }

  const setHideReadsInProfiles = (hide: boolean) => {
    setHideReadsInProfilesState(hide)
    storage.setHideReadsInProfiles(hide)
  }

  return (
    <ReadsVisibilityContext.Provider
      value={{
        hideReadsInNavigation,
        setHideReadsInNavigation,
        hideReadsInProfiles,
        setHideReadsInProfiles
      }}
    >
      {children}
    </ReadsVisibilityContext.Provider>
  )
}
