import { createContext, useContext, useState } from 'react'
import storage from '@/services/local-storage.service'

type TDisableAvatarAnimationsContext = {
  disableAvatarAnimations: boolean
  setDisableAvatarAnimations: (enabled: boolean) => void
}

const DisableAvatarAnimationsContext = createContext<TDisableAvatarAnimationsContext | undefined>(undefined)

export const useDisableAvatarAnimations = () => {
  const context = useContext(DisableAvatarAnimationsContext)
  if (!context) {
    // Return default values when used outside provider (e.g., in LoginDialog)
    return {
      disableAvatarAnimations: false,
      setDisableAvatarAnimations: () => {}
    }
  }
  return context
}

export function DisableAvatarAnimationsProvider({ children }: { children: React.ReactNode }) {
  const [disableAvatarAnimations, setDisableAvatarAnimationsState] = useState<boolean>(
    storage.getDisableAvatarAnimations()
  )

  const setDisableAvatarAnimations = (enabled: boolean) => {
    storage.setDisableAvatarAnimations(enabled)
    setDisableAvatarAnimationsState(enabled)
  }

  return (
    <DisableAvatarAnimationsContext.Provider value={{ disableAvatarAnimations, setDisableAvatarAnimations }}>
      {children}
    </DisableAvatarAnimationsContext.Provider>
  )
}
